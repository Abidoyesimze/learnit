import { parseAbi } from "viem";

export const rewardsPoolAbi = parseAbi([
  "struct Voucher { address root; uint256 amount; uint256 nonce; uint256 expiry; }",
  "function claim(Voucher v, bytes sig)",
  "function claimBatch(Voucher[] vs, bytes[] sigs)",
  "function nonceUsed(address root, uint256 nonce) view returns (bool)",
  "function paused() view returns (bool)",
  "function dailyCap() view returns (uint256)",
  "function weeklyCap() view returns (uint256)",
  "function dailyBudget() view returns (uint256)",
  "function spentOnDay(uint256 day) view returns (uint256)",
  "function signer() view returns (address)",
  "function pause()", "function unpause()",
  "function claimedOnDay(address root, uint256 day) view returns (uint256)",
  // custom errors, so a failed simulation decodes into a name we can explain
  "error NotVerified()", "error WrongRoot()", "error Expired()", "error NonceUsed()", "error BadSignature()",
  "error DailyCapExceeded()", "error WeeklyCapExceeded()", "error BudgetExceeded()", "error ZeroAmount()", "error LengthMismatch()", "error EnforcedPause()",
]);

export const streakVaultAbi = parseAbi([
  "function stake(uint256 id, uint256 amount)",
  "function withdraw(uint256 id)",
  "function cohorts(uint256 id) view returns (uint64 start, uint64 end, uint128 min, uint128 max, uint256 totalStaked, uint256 finishedStake, uint256 finisherPool, bool settled)",
  "function paused() view returns (bool)",
  "function nextCohortId() view returns (uint256)",
  "function stakeOf(uint256 id, address user) view returns (uint256)",
  "function finished(uint256 id, address user) view returns (bool)",
  "function withdrawn(uint256 id, address user) view returns (bool)",
  "function payoutOf(uint256 id, address user) view returns (uint256)",
  // admin: create challenges, pause, and check who holds which role
  "function createCohort(uint64 start, uint128 min, uint128 max) returns (uint256 id)",
  "function pause()", "function unpause()",
  "function hasRole(bytes32 role, address account) view returns (bool)",
  "function DEFAULT_ADMIN_ROLE() view returns (bytes32)", "function GUARDIAN_ROLE() view returns (bytes32)",
  "error AccessControlUnauthorizedAccount(address account, bytes32 neededRole)", "error ExpectedPause()",
  "error NotVerified()", "error VerificationEndsBeforeCohort()", "error JoinClosed()", "error AlreadyStaked()", "error OutOfBounds()", "error BadParams()",
  "error NotSettled()", "error NotFinisher()", "error AlreadyWithdrawn()", "error EnforcedPause()",
  "event Staked(uint256 indexed id, address indexed user, address indexed root, uint256 requested, uint256 received)",
]);
