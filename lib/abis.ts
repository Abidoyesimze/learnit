import { parseAbi } from "viem";

export const rewardsPoolAbi = parseAbi([
  "struct Voucher { address root; uint256 amount; uint256 nonce; uint256 expiry; }",
  "function claim(Voucher v, bytes sig)",
  "function claimBatch(Voucher[] vs, bytes[] sigs)",
  "function nonceUsed(address root, uint256 nonce) view returns (bool)",
  "function dailyCap() view returns (uint256)",
  "function claimedOnDay(address root, uint256 day) view returns (uint256)",
]);

export const streakVaultAbi = parseAbi([
  "function stake(uint256 id, uint256 amount)",
  "function withdraw(uint256 id)",
  "function cohorts(uint256 id) view returns (uint64 start, uint64 end, uint128 min, uint128 max, uint256 totalStaked, uint256 finishedStake, uint256 finisherPool, bool settled)",
  "function nextCohortId() view returns (uint256)",
  "function stakeOf(uint256 id, address user) view returns (uint256)",
  "function finished(uint256 id, address user) view returns (bool)",
  "function withdrawn(uint256 id, address user) view returns (bool)",
  "function payoutOf(uint256 id, address user) view returns (uint256)",
  "event Staked(uint256 indexed id, address indexed user, address indexed root, uint256 requested, uint256 received)",
]);
