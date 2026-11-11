// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IIdentity} from "./interfaces/IIdentity.sol";
import {IRewardsPool} from "./interfaces/IRewardsPool.sol";
import {IdentityLib} from "./IdentityLib.sol";

/// @title StreakVaultUpgradeable
/// @notice Upgradeable twin of StreakVault, with two additions: cohorts can run 7, 14 or 30 days
///         (admin picks per cohort), and finishers of longer cohorts can earn an extra bonus on top of
///         the usual forfeit-sharing, at an admin-tunable rate per length (the "bonding curve" - whatever
///         shape the admin sets across the three supported lengths). The bonus is paid only from a
///         dedicated, separately funded reserve; it can never dip into stakers' own principal or the
///         forfeit pool.
///
///         Settlement rules (review items L-02 and "payout settings can change after users stake"):
///         - A cohort's split and bonus rate are locked when it is created. Later setSplit/setBonusBps
///           calls only affect cohorts created afterwards.
///         - Each stake sets aside its own worst-case bonus from the reserve, so the promised bonus is
///           fully backed before the deposit is accepted and settle() never depends on the reserve.
///         - Nobody can settle until the signer has confirmed the results are complete
///           (finalizeResults). An unmarked staker is only ever treated as a forfeit after that.
///         - If results are not confirmed within RESULTS_DEADLINE of the end, anyone can void the
///           cohort and every staker takes their own stake back.
///         - settle() and withdraw() never call the RewardsPool or the UBI address. Their share waits
///           in the vault until distribute() sends it, so a bad destination cannot hold up finishers.
/// @dev Upgrade authority is DEFAULT_ADMIN_ROLE directly, no timelock - same deliberate tradeoff as
///      RewardsPoolUpgradeable.
contract StreakVaultUpgradeable is
    Initializable,
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable,
    UUPSUpgradeable
{
    using SafeERC20 for IERC20;

    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN_ROLE");
    bytes32 public constant SIGNER_ROLE = keccak256("SIGNER_ROLE");
    uint256 public constant JOIN_WINDOW = 1 days; // can join until the first day is over, regardless of total length
    uint256 public constant RESULTS_DEADLINE = 7 days; // results not confirmed this long after the end: anyone may void, all stakes refunded
    uint16 public constant MAX_BONUS_BPS = 5000; // 50% sanity cap against a fat-fingered setBonusBps call

    struct Cohort {
        uint64 start;
        uint64 end;
        uint128 min;
        uint128 max;
        uint256 totalStaked; // amounts actually received
        uint256 finishedStake;
        uint256 finisherPool; // forfeits + length bonus owed to finishers, pro rata to stake
        bool settled;
    }

    /// @dev Payout terms of one cohort, fixed before anyone stakes in it.
    struct Terms {
        bool locked;
        uint16 finishersBps;
        uint16 rewardsBps;
        uint16 bonusBps;
        uint256 bonusReserved; // G$ taken out of bonusReserve for this cohort's stakers, until it settles or is voided
    }

    IERC20 public token;
    IIdentity public identity;
    IRewardsPool public rewardsPool;
    address public ubiAddress;
    uint16 public finishersBps;
    uint16 public rewardsBps;
    uint16 public ubiBps;

    uint256 public nextCohortId;
    mapping(uint256 id => Cohort) public cohorts;
    mapping(uint256 id => mapping(address user => uint256)) public stakeOf;
    mapping(uint256 id => mapping(address user => bool)) public finished;
    mapping(uint256 id => mapping(address user => bool)) public withdrawn;
    mapping(uint256 id => mapping(address root => bool)) public rootStaked; // one stake per human per cohort

    /// @notice Bonus rate (bps of finished stake) paid from bonusReserve on top of forfeit-sharing, by
    ///         cohort length in days. Only 7, 14 and 30 are ever read; 7 defaults to 0 (unchanged payout).
    mapping(uint32 lengthDays => uint16 bps) public bonusBpsFor;
    /// @notice G$ set aside specifically to fund the length bonus above. Funded separately from the pool
    ///         itself (fundBonusReserve) so a cohort's bonus can never be paid out of stakers' principal.
    uint256 public bonusReserve;

    // Added in the settlement-review upgrade. New state goes here, above __gap, never in the middle.
    mapping(uint256 id => Terms) public termsOf;
    /// @notice True once the signer has confirmed that every finisher of the cohort is marked.
    mapping(uint256 id => bool) public resultsFinal;
    /// @notice True if results never arrived and the cohort was cancelled: every staker withdraws their own stake.
    mapping(uint256 id => bool) public voided;
    /// @notice Forfeit shares waiting to be sent on by distribute().
    uint256 public pendingRewards;
    uint256 public pendingUbi;

    event CohortCreated(uint256 indexed id, uint64 start, uint64 end, uint128 min, uint128 max);
    event Staked(uint256 indexed id, address indexed user, address indexed root, uint256 requested, uint256 received);
    event FinishedMarked(uint256 indexed id, address indexed user);
    event TermsLocked(uint256 indexed id, uint16 finishersBps, uint16 rewardsBps, uint16 bonusBps);
    event ResultsFinalized(uint256 indexed id, uint256 finishedStake);
    event Voided(uint256 indexed id);
    event Distributed(uint256 toRewards, uint256 toUbi);
    event Settled(uint256 indexed id, uint256 forfeits, uint256 finisherPool, uint256 toRewards, uint256 toUbi);
    event Forfeited(uint256 indexed id, uint256 totalForfeited);
    event BonusPaid(uint256 indexed id, uint256 amount);
    event BonusFunded(address indexed from, uint256 received);
    event BonusBpsUpdated(uint32 lengthDays, uint16 bps);
    event Withdrawn(uint256 indexed id, address indexed user, uint256 payout);
    event SplitUpdated(uint16 finishersBps, uint16 rewardsBps, uint16 ubiBps);
    event UbiAddressUpdated(address ubiAddress);
    event RewardsPoolUpdated(address rewardsPool);

    error BadParams();
    error UnsupportedLength();
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
    error ResultsNotFinal();
    error ResultsAlreadyFinal();
    error ResultsMismatch();
    error IsVoided();
    error CannotVoidYet();
    error InsufficientBonusReserve();
    error BonusCapExceeded();
    error ZeroAddress();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(IERC20 token_, IIdentity identity_, IRewardsPool pool, address ubi, address admin, address guardian, address signer_)
        external
        initializer
    {
        if (address(token_) == address(0) || address(identity_) == address(0) || admin == address(0) || ubi == address(0)) revert ZeroAddress();
        __AccessControl_init();
        __ReentrancyGuard_init();
        __Pausable_init();
        __UUPSUpgradeable_init();

        token = token_;
        identity = identity_;
        rewardsPool = pool;
        ubiAddress = ubi;
        finishersBps = 7000;
        rewardsBps = 2000;
        ubiBps = 1000;
        nextCohortId = 1;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(GUARDIAN_ROLE, guardian);
        _grantRole(SIGNER_ROLE, signer_);
    }

    // ---------------------------------------------------------------- cohorts

    function createCohort(uint64 start, uint32 lengthDays, uint128 min, uint128 max) external onlyRole(DEFAULT_ADMIN_ROLE) returns (uint256 id) {
        if (start < block.timestamp || min == 0 || max < min) revert BadParams();
        if (!_supportedLength(lengthDays)) revert UnsupportedLength();
        id = nextCohortId++;
        uint64 end = start + uint64(lengthDays) * 1 days;
        cohorts[id] = Cohort(start, end, min, max, 0, 0, 0, false);
        emit CohortCreated(id, start, end, min, max);
        _terms(id);
    }

    /// @dev A cohort's terms, locking them from the current settings on first use. New cohorts lock in
    ///      createCohort. The lazy path only serves cohorts created before this upgrade, which lock on
    ///      their next stake or at settlement.
    function _terms(uint256 id) internal returns (Terms storage t) {
        t = termsOf[id];
        if (!t.locked) {
            Cohort storage c = cohorts[id];
            t.locked = true;
            t.finishersBps = finishersBps;
            t.rewardsBps = rewardsBps;
            t.bonusBps = bonusBpsFor[uint32((c.end - c.start) / 1 days)];
            emit TermsLocked(id, t.finishersBps, t.rewardsBps, t.bonusBps);
        }
    }

    function _supportedLength(uint32 lengthDays) internal pure returns (bool) {
        return lengthDays == 7 || lengthDays == 14 || lengthDays == 30;
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

        // Set aside the most this stake can earn as a bonus (rounded up), so the promise is funded
        // now, while the staker can still walk away, and not checked for the first time at settlement.
        Terms storage t = _terms(id);
        if (t.bonusBps > 0) {
            uint256 need = (received * t.bonusBps + 9_999) / 10_000;
            if (need > bonusReserve) revert InsufficientBonusReserve();
            bonusReserve -= need;
            t.bonusReserved += need;
        }

        rootStaked[id][root] = true;
        stakeOf[id][msg.sender] = received;
        c.totalStaked += received;
        emit Staked(id, msg.sender, root, amount, received);
    }

    // ---------------------------------------------------------------- bonus reserve

    /// @notice Anyone can top up the bonus reserve (sponsors, the project treasury). Kept separate from
    ///         the vault's stake accounting: this G$ only ever funds the length bonus, never counted as
    ///         anyone's stake or forfeit.
    function fundBonusReserve(uint256 amount) external nonReentrant {
        uint256 before = token.balanceOf(address(this));
        token.safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = token.balanceOf(address(this)) - before;
        bonusReserve += received;
        emit BonusFunded(msg.sender, received);
    }

    /// @notice Applies to cohorts created after this call. Existing cohorts keep the rate they were created with.
    function setBonusBps(uint32 lengthDays, uint16 bps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (!_supportedLength(lengthDays)) revert UnsupportedLength();
        if (bps > MAX_BONUS_BPS) revert BonusCapExceeded();
        bonusBpsFor[lengthDays] = bps;
        emit BonusBpsUpdated(lengthDays, bps);
    }

    // ---------------------------------------------------------------- results

    /// @notice Signer marks who completed every day. Callable in batches after the end, until the results
    ///         are confirmed with finalizeResults.
    function markFinished(uint256 id, address[] calldata users) external onlyRole(SIGNER_ROLE) {
        Cohort storage c = cohorts[id];
        if (c.start == 0) revert BadParams();
        if (block.timestamp < c.end) revert NotEnded();
        if (c.settled) revert AlreadySettled();
        if (voided[id]) revert IsVoided();
        if (resultsFinal[id]) revert ResultsAlreadyFinal();
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

    /// @notice Signer confirms that every finisher has been marked. Until this is called nobody can
    ///         settle, so a missing or half-sent result can never turn a finisher into a forfeit.
    /// @param expectedFinishedStake Total stake of all finishers as worked out off-chain. It must equal
    ///        what has been marked on-chain, which catches a batch that never landed.
    function finalizeResults(uint256 id, uint256 expectedFinishedStake) external onlyRole(SIGNER_ROLE) {
        Cohort storage c = cohorts[id];
        if (c.start == 0) revert BadParams();
        if (block.timestamp < c.end) revert NotEnded();
        if (c.settled) revert AlreadySettled();
        if (voided[id]) revert IsVoided();
        if (resultsFinal[id]) revert ResultsAlreadyFinal();
        if (c.finishedStake != expectedFinishedStake) revert ResultsMismatch();
        resultsFinal[id] = true;
        emit ResultsFinalized(id, expectedFinishedStake);
    }

    /// @notice Cancels a cohort whose results were never confirmed. Anyone can call it RESULTS_DEADLINE
    ///         after the end. Every staker, marked or not, then withdraws exactly their own stake.
    function voidCohort(uint256 id) external {
        Cohort storage c = cohorts[id];
        if (c.start == 0) revert BadParams();
        if (c.settled) revert AlreadySettled();
        if (voided[id]) revert IsVoided();
        if (resultsFinal[id]) revert ResultsAlreadyFinal();
        if (block.timestamp < uint256(c.end) + RESULTS_DEADLINE) revert CannotVoidYet();
        voided[id] = true;
        Terms storage t = termsOf[id];
        bonusReserve += t.bonusReserved; // no bonus is paid on a voided cohort
        t.bonusReserved = 0;
        emit Voided(id);
    }

    /// @notice Works out the payout of a cohort whose results are confirmed: the forfeits are split
    ///         between finishers (pro rata), the RewardsPool and the UBI address, and the length bonus
    ///         is added to the finishers' share. Anyone can call it. It uses the terms locked for this
    ///         cohort and only moves numbers inside the vault, so no setting can make it fail.
    function settle(uint256 id) external nonReentrant {
        Cohort storage c = cohorts[id];
        if (c.start == 0) revert BadParams();
        if (c.settled) revert AlreadySettled();
        if (!resultsFinal[id]) revert ResultsNotFinal(); // implies ended and not voided

        Terms storage t = _terms(id);
        c.settled = true;
        uint256 forfeits = c.totalStaked - c.finishedStake;
        uint256 toFinishers = c.finishedStake == 0 ? 0 : forfeits * t.finishersBps / 10_000;
        uint256 toRewards = forfeits * t.rewardsBps / 10_000;
        uint256 toUbi = forfeits - toFinishers - toRewards; // remainder, so nothing is left behind unless there are no finishers

        uint256 bonus = c.finishedStake * t.bonusBps / 10_000;
        uint256 reserved = t.bonusReserved;
        t.bonusReserved = 0;
        if (bonus <= reserved) {
            bonusReserve += reserved - bonus; // forfeited stakes earn no bonus; their share goes back
        } else {
            // Only reachable for stakes made before this upgrade, which set nothing aside. Pay what
            // the reserve can cover instead of reverting.
            uint256 extra = bonus - reserved;
            if (extra > bonusReserve) extra = bonusReserve;
            bonusReserve -= extra;
            bonus = reserved + extra;
        }
        if (bonus > 0) emit BonusPaid(id, bonus);

        c.finisherPool = toFinishers + bonus;
        pendingRewards += toRewards;
        pendingUbi += toUbi;
        emit Forfeited(id, forfeits);
        emit Settled(id, forfeits, c.finisherPool, toRewards, toUbi);
    }

    /// @notice Sends the forfeit shares collected by settle() to the RewardsPool and the UBI address.
    ///         Anyone can call it. Kept apart from settle() so that a destination which rejects the
    ///         transfer only delays this call, never a finisher's withdrawal. If it fails, fix the
    ///         destination (setRewardsPool / setUbiAddress) and call it again.
    function distribute() external nonReentrant {
        uint256 toRewards = pendingRewards;
        uint256 toUbi = pendingUbi;
        pendingRewards = 0;
        pendingUbi = 0;
        if (address(rewardsPool) == address(0)) {
            toUbi += toRewards;
            toRewards = 0;
        }
        if (toRewards > 0) {
            token.forceApprove(address(rewardsPool), toRewards);
            rewardsPool.deposit(toRewards);
        }
        if (toUbi > 0) token.safeTransfer(ubiAddress, toUbi);
        emit Distributed(toRewards, toUbi);
    }

    /// @notice Finishers of a settled cohort take their stake plus their share. Stakers of a voided
    ///         cohort take their stake back.
    function withdraw(uint256 id) external nonReentrant {
        uint256 payout = _payout(id, msg.sender);
        if (payout == 0) {
            if (withdrawn[id][msg.sender]) revert AlreadyWithdrawn();
            if (voided[id]) revert NotStaked();
            if (!cohorts[id].settled) revert NotSettled();
            revert NotFinisher();
        }
        withdrawn[id][msg.sender] = true;
        token.safeTransfer(msg.sender, payout);
        emit Withdrawn(id, msg.sender, payout);
    }

    function payoutOf(uint256 id, address user) external view returns (uint256) {
        return _payout(id, user);
    }

    /// @dev What `user` can withdraw from the cohort right now; 0 if nothing (yet, or any more).
    function _payout(uint256 id, address user) internal view returns (uint256) {
        if (withdrawn[id][user]) return 0;
        uint256 s = stakeOf[id][user];
        if (voided[id]) return s;
        Cohort storage c = cohorts[id];
        if (!c.settled || !finished[id][user]) return 0;
        return s + s * c.finisherPool / c.finishedStake; // finishedStake > 0: this user finished
    }

    // ---------------------------------------------------------------- admin

    /// @notice Applies to cohorts created after this call. Existing cohorts keep the split they were created with.
    function setSplit(uint16 finishers, uint16 rewards, uint16 ubi) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (uint256(finishers) + rewards + ubi != 10_000) revert BadParams();
        finishersBps = finishers;
        rewardsBps = rewards;
        ubiBps = ubi;
        emit SplitUpdated(finishers, rewards, ubi);
    }

    /// @notice Where distribute() sends the UBI share. Not locked per cohort on purpose: if a destination
    ///         stops accepting transfers the admin must be able to replace it, and since settle() and
    ///         withdraw() never touch it, changing it cannot hold up stakers.
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

    function _authorizeUpgrade(address) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    /// @dev Reserved storage slots so future upgrades can add state without corrupting layout.
    uint256[45] private __gap; // 50 minus the 5 slots added above
}
