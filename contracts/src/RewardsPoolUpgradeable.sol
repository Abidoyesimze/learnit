// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {EIP712Upgradeable} from "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IIdentity} from "./interfaces/IIdentity.sol";
import {IdentityLib} from "./IdentityLib.sol";

/// @title RewardsPoolUpgradeable
/// @notice Upgradeable twin of RewardsPool: holds G$ and pays it out against EIP-712 vouchers signed by
///         the LearnIt backend. Only GoodDollar-verified humans can claim, with daily/weekly caps per
///         whitelisted root and a global daily budget. Cannot mint G$; only moves what was deposited.
/// @dev Upgrade authority is DEFAULT_ADMIN_ROLE directly, no timelock. That is a deliberate, informed
///      choice: admin is a Safe multisig, accepted knowing one compromised signer could then replace
///      this contract's entire logic instantly. Raise the Safe's threshold accordingly.
contract RewardsPoolUpgradeable is
    Initializable,
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable,
    EIP712Upgradeable,
    UUPSUpgradeable
{
    using SafeERC20 for IERC20;

    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN_ROLE");
    bytes32 public constant VOUCHER_TYPEHASH =
        keccak256("Voucher(address root,uint256 amount,uint256 nonce,uint256 expiry)");

    struct Voucher {
        address root;
        uint256 amount;
        uint256 nonce;
        uint256 expiry;
    }

    IERC20 public token;
    IIdentity public identity;

    address public signer;
    uint256 public dailyCap; // per root
    uint256 public weeklyCap; // per root
    uint256 public dailyBudget; // global

    mapping(address root => mapping(uint256 nonce => bool)) public nonceUsed;
    mapping(address root => mapping(uint256 day => uint256)) public claimedOnDay;
    mapping(address root => mapping(uint256 week => uint256)) public claimedInWeek;
    mapping(uint256 day => uint256) public spentOnDay;

    event Deposited(address indexed from, uint256 received);
    event Claimed(address indexed root, address indexed to, uint256 amount, uint256 nonce);
    event SignerUpdated(address indexed oldSigner, address indexed newSigner);
    event CapsUpdated(uint256 dailyCap, uint256 weeklyCap);
    event DailyBudgetUpdated(uint256 dailyBudget);

    error NotVerified();
    error WrongRoot();
    error Expired();
    error NonceUsed();
    error BadSignature();
    error DailyCapExceeded();
    error WeeklyCapExceeded();
    error BudgetExceeded();
    error ZeroAmount();
    error LengthMismatch();
    error ZeroAddress();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @dev Admin is granted straight to `admin` (expected to be a Safe) - the deployer never holds
    ///      DEFAULT_ADMIN_ROLE at any point, unlike the original constructor-based deploy. Caps/budget are
    ///      therefore set here too, atomically with deployment, rather than needing a follow-up admin call.
    function initialize(
        IERC20 token_,
        IIdentity identity_,
        address admin,
        address guardian,
        address signer_,
        uint256 dailyCap_,
        uint256 weeklyCap_,
        uint256 dailyBudget_
    ) external initializer {
        if (address(token_) == address(0) || address(identity_) == address(0) || admin == address(0) || signer_ == address(0)) revert ZeroAddress();
        __AccessControl_init();
        __ReentrancyGuard_init();
        __Pausable_init();
        __EIP712_init("LearnItRewards", "1");
        __UUPSUpgradeable_init();

        token = token_;
        identity = identity_;
        signer = signer_;
        dailyCap = dailyCap_;
        weeklyCap = weeklyCap_;
        dailyBudget = dailyBudget_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(GUARDIAN_ROLE, guardian);
        emit SignerUpdated(address(0), signer_);
        emit CapsUpdated(dailyCap_, weeklyCap_);
        emit DailyBudgetUpdated(dailyBudget_);
    }

    // ---------------------------------------------------------------- funding

    /// @notice Anyone can fund the pool (sponsors, the StreakVault forfeit share).
    function deposit(uint256 amount) external nonReentrant {
        uint256 before = token.balanceOf(address(this));
        token.safeTransferFrom(msg.sender, address(this), amount);
        emit Deposited(msg.sender, token.balanceOf(address(this)) - before);
    }

    // ---------------------------------------------------------------- claiming

    function claim(Voucher calldata v, bytes calldata sig) external nonReentrant whenNotPaused {
        _claim(v, sig);
    }

    function claimBatch(Voucher[] calldata vs, bytes[] calldata sigs) external nonReentrant whenNotPaused {
        if (vs.length != sigs.length) revert LengthMismatch();
        for (uint256 i; i < vs.length; ++i) _claim(vs[i], sigs[i]);
    }

    function _claim(Voucher calldata v, bytes calldata sig) internal {
        if (v.amount == 0) revert ZeroAmount();
        if (block.timestamp > v.expiry) revert Expired();

        (address root, uint256 expiry) = IdentityLib.rootAndExpiry(identity, msg.sender);
        if (root == address(0) || expiry <= block.timestamp) revert NotVerified();
        if (root != v.root) revert WrongRoot();
        if (nonceUsed[root][v.nonce]) revert NonceUsed();
        if (ECDSA.recover(_hashTypedDataV4(_structHash(v)), sig) != signer) revert BadSignature();

        nonceUsed[root][v.nonce] = true;

        uint256 day = block.timestamp / 1 days;
        uint256 week = day / 7;
        uint256 d = claimedOnDay[root][day] + v.amount;
        uint256 w = claimedInWeek[root][week] + v.amount;
        uint256 s = spentOnDay[day] + v.amount;
        if (d > dailyCap) revert DailyCapExceeded();
        if (w > weeklyCap) revert WeeklyCapExceeded();
        if (s > dailyBudget) revert BudgetExceeded();
        claimedOnDay[root][day] = d;
        claimedInWeek[root][week] = w;
        spentOnDay[day] = s;

        token.safeTransfer(msg.sender, v.amount);
        emit Claimed(root, msg.sender, v.amount, v.nonce);
    }

    function _structHash(Voucher calldata v) internal pure returns (bytes32) {
        return keccak256(abi.encode(VOUCHER_TYPEHASH, v.root, v.amount, v.nonce, v.expiry));
    }

    function hashVoucher(Voucher calldata v) external view returns (bytes32) {
        return _hashTypedDataV4(_structHash(v));
    }

    // ---------------------------------------------------------------- admin

    /// @dev Changing the signer cancels every outstanding voucher (they no longer verify).
    function setSigner(address newSigner) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newSigner == address(0)) revert ZeroAddress();
        emit SignerUpdated(signer, newSigner);
        signer = newSigner;
    }

    function setCaps(uint256 daily, uint256 weekly_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        dailyCap = daily;
        weeklyCap = weekly_;
        emit CapsUpdated(daily, weekly_);
    }

    function setDailyBudget(uint256 budget) external onlyRole(DEFAULT_ADMIN_ROLE) {
        dailyBudget = budget;
        emit DailyBudgetUpdated(budget);
    }

    function pause() external onlyRole(GUARDIAN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(GUARDIAN_ROLE) {
        _unpause();
    }

    function _authorizeUpgrade(address) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    /// @dev Reserved storage slots so future upgrades can add state without corrupting layout.
    uint256[50] private __gap;
}
