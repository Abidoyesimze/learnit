// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IIdentity} from "./interfaces/IIdentity.sol";
import {IRewardsPool} from "./interfaces/IRewardsPool.sol";
import {IdentityLib} from "./IdentityLib.sol";

/// @title StreakVault
/// @notice 7-day commitment challenges. Verified users stake G$; the backend signer marks who finished.
///         Finishers get their stake back plus a pro-rata share of the forfeits. The rest of the forfeits
///         go to the RewardsPool and a configurable UBI address. This is a commitment contract, not a bet.
contract StreakVault is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN_ROLE");
    bytes32 public constant SIGNER_ROLE = keccak256("SIGNER_ROLE");
    uint256 public constant LENGTH = 7 days;
    uint256 public constant JOIN_WINDOW = 1 days; // can join until the first day is over
    uint256 public constant SETTLE_DELAY = 1 days; // anyone may settle this long after the end

    struct Cohort {
        uint64 start;
        uint64 end;
        uint128 min;
        uint128 max;
        uint256 totalStaked; // amounts actually received
        uint256 finishedStake;
        uint256 finisherPool; // forfeits owed to finishers, pro rata to stake
        bool settled;
    }

    IERC20 public immutable token;
    IIdentity public immutable identity;
    IRewardsPool public rewardsPool;
    address public ubiAddress;
    uint16 public finishersBps = 7000;
    uint16 public rewardsBps = 2000;
    uint16 public ubiBps = 1000;

    uint256 public nextCohortId = 1;
    mapping(uint256 id => Cohort) public cohorts;
    mapping(uint256 id => mapping(address user => uint256)) public stakeOf;
    mapping(uint256 id => mapping(address user => bool)) public finished;
    mapping(uint256 id => mapping(address user => bool)) public withdrawn;
    mapping(uint256 id => mapping(address root => bool)) public rootStaked; // one stake per human per cohort

    event CohortCreated(uint256 indexed id, uint64 start, uint64 end, uint128 min, uint128 max);
    event Staked(uint256 indexed id, address indexed user, address indexed root, uint256 requested, uint256 received);
    event FinishedMarked(uint256 indexed id, address indexed user);
    event Settled(uint256 indexed id, uint256 forfeits, uint256 finisherPool, uint256 toRewards, uint256 toUbi);
    event Forfeited(uint256 indexed id, uint256 totalForfeited);
    event Withdrawn(uint256 indexed id, address indexed user, uint256 payout);
    event SplitUpdated(uint16 finishersBps, uint16 rewardsBps, uint16 ubiBps);
    event UbiAddressUpdated(address ubiAddress);
    event RewardsPoolUpdated(address rewardsPool);

    error BadParams();
    error NotVerified();
    error VerificationEndsBeforeCohort();
    error JoinClosed();
    error AlreadyStaked();
    error OutOfBounds();
    error NotStaked();
    error AlreadyFinished();
    error NotEnded();
    error AlreadySettled();
    error NotSettled();
    error NotFinisher();
    error AlreadyWithdrawn();
    error CannotSettleYet();
    error ZeroAddress();

    constructor(IERC20 token_, IIdentity identity_, IRewardsPool pool, address ubi, address admin, address guardian, address signer_) {
        if (address(token_) == address(0) || address(identity_) == address(0) || admin == address(0) || ubi == address(0)) revert ZeroAddress();
        token = token_;
        identity = identity_;
        rewardsPool = pool;
        ubiAddress = ubi;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(GUARDIAN_ROLE, guardian);
        _grantRole(SIGNER_ROLE, signer_);
    }

    // ---------------------------------------------------------------- cohorts

    function createCohort(uint64 start, uint128 min, uint128 max) external onlyRole(DEFAULT_ADMIN_ROLE) returns (uint256 id) {
        if (start < block.timestamp || min == 0 || max < min) revert BadParams();
        id = nextCohortId++;
        cohorts[id] = Cohort(start, start + uint64(LENGTH), min, max, 0, 0, 0, false);
        emit CohortCreated(id, start, start + uint64(LENGTH), min, max);
    }

    // ---------------------------------------------------------------- staking

    /// @param amount G$ to pull (approve first). The recorded stake is what the vault actually received after any fee.
    function stake(uint256 id, uint256 amount) external nonReentrant whenNotPaused {
        Cohort storage c = cohorts[id];
        if (c.start == 0) revert BadParams();
        if (block.timestamp >= uint256(c.start) + JOIN_WINDOW) revert JoinClosed();
        if (stakeOf[id][msg.sender] != 0) revert AlreadyStaked();

        (address root, uint256 expiry) = IdentityLib.rootAndExpiry(identity, msg.sender);
        if (root == address(0) || expiry <= block.timestamp) revert NotVerified();
        if (expiry < c.end) revert VerificationEndsBeforeCohort();
        if (rootStaked[id][root]) revert AlreadyStaked();
        if (amount < c.min || amount > c.max) revert OutOfBounds();

        uint256 before = token.balanceOf(address(this));
        token.safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = token.balanceOf(address(this)) - before;
        if (received == 0 || received > c.max) revert OutOfBounds();

        rootStaked[id][root] = true;
        stakeOf[id][msg.sender] = received;
        c.totalStaked += received;
        emit Staked(id, msg.sender, root, amount, received);
    }

    // ---------------------------------------------------------------- results

    /// @notice Signer marks who completed every day. Callable in batches after the end, before settlement.
    function markFinished(uint256 id, address[] calldata users) external onlyRole(SIGNER_ROLE) {
        Cohort storage c = cohorts[id];
        if (c.start == 0) revert BadParams();
        if (block.timestamp < c.end) revert NotEnded();
        if (c.settled) revert AlreadySettled();
        for (uint256 i; i < users.length; ++i) {
            address u = users[i];
            uint256 s = stakeOf[id][u];
            if (s == 0) revert NotStaked();
            if (finished[id][u]) revert AlreadyFinished();
            finished[id][u] = true;
            c.finishedStake += s;
            emit FinishedMarked(id, u);
        }
    }

    /// @notice Splits the forfeits: finishers (pro rata), RewardsPool, UBI address. Signer any time after the end,
    ///         anyone SETTLE_DELAY after the end.
    function settle(uint256 id) external nonReentrant {
        Cohort storage c = cohorts[id];
        if (c.start == 0) revert BadParams();
        if (block.timestamp < c.end) revert NotEnded();
        if (c.settled) revert AlreadySettled();
        if (!hasRole(SIGNER_ROLE, msg.sender) && block.timestamp < uint256(c.end) + SETTLE_DELAY) revert CannotSettleYet();

        c.settled = true;
        uint256 forfeits = c.totalStaked - c.finishedStake;
        uint256 toFinishers = c.finishedStake == 0 ? 0 : forfeits * finishersBps / 10_000;
        uint256 toRewards = forfeits * rewardsBps / 10_000;
        uint256 toUbi = forfeits - toFinishers - toRewards; // remainder, so nothing is left behind unless there are no finishers
        c.finisherPool = toFinishers;
        emit Forfeited(id, forfeits);

        if (toRewards > 0 && address(rewardsPool) != address(0)) {
            token.forceApprove(address(rewardsPool), toRewards);
            rewardsPool.deposit(toRewards);
        } else {
            toUbi += toRewards;
            toRewards = 0;
        }
        if (toUbi > 0) token.safeTransfer(ubiAddress, toUbi);
        emit Settled(id, forfeits, toFinishers, toRewards, toUbi);
    }

    function withdraw(uint256 id) external nonReentrant {
        Cohort storage c = cohorts[id];
        if (!c.settled) revert NotSettled();
        if (!finished[id][msg.sender]) revert NotFinisher();
        if (withdrawn[id][msg.sender]) revert AlreadyWithdrawn();
        withdrawn[id][msg.sender] = true;
        uint256 s = stakeOf[id][msg.sender];
        uint256 payout = s + (c.finishedStake == 0 ? 0 : s * c.finisherPool / c.finishedStake);
        token.safeTransfer(msg.sender, payout);
        emit Withdrawn(id, msg.sender, payout);
    }

    function payoutOf(uint256 id, address user) external view returns (uint256) {
        Cohort storage c = cohorts[id];
        if (!c.settled || !finished[id][user] || withdrawn[id][user]) return 0;
        uint256 s = stakeOf[id][user];
        return s + (c.finishedStake == 0 ? 0 : s * c.finisherPool / c.finishedStake);
    }

    // ---------------------------------------------------------------- admin

    function setSplit(uint16 finishers, uint16 rewards, uint16 ubi) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (uint256(finishers) + rewards + ubi != 10_000) revert BadParams();
        finishersBps = finishers;
        rewardsBps = rewards;
        ubiBps = ubi;
        emit SplitUpdated(finishers, rewards, ubi);
    }

    function setUbiAddress(address a) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (a == address(0)) revert ZeroAddress();
        ubiAddress = a;
        emit UbiAddressUpdated(a);
    }

    function setRewardsPool(IRewardsPool p) external onlyRole(DEFAULT_ADMIN_ROLE) {
        rewardsPool = p;
        emit RewardsPoolUpdated(address(p));
    }

    function pause() external onlyRole(GUARDIAN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(GUARDIAN_ROLE) {
        _unpause();
    }
}
