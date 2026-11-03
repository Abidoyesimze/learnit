import { celo } from "viem/chains";

export const CHAIN = celo; // chainId 42220
export const CHAIN_ID = 42220;

const env = (v: string | undefined, fallback = "") => v ?? fallback;

export const ADDR = {
  gd: env(process.env.NEXT_PUBLIC_GOODDOLLAR_TOKEN_ADDRESS, "0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A") as `0x${string}`,
  identity: env(process.env.NEXT_PUBLIC_IDENTITY_ADDRESS, "0xC361A6E67822a0EDc17D899227dd9FC50BD62F42") as `0x${string}`,
  rewardsPool: env(process.env.NEXT_PUBLIC_REWARDS_POOL_ADDRESS) as `0x${string}`,
  streakVault: env(process.env.NEXT_PUBLIC_STREAK_VAULT_ADDRESS) as `0x${string}`,
};
export const RPC_URL = env(process.env.NEXT_PUBLIC_CELO_RPC_URL, "https://forno.celo.org");

export const identityAbi = [
  { type: "function", name: "isWhitelisted", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "getWhitelistedRoot", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "address" }] },
  { type: "function", name: "lastAuthenticated", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "authenticationPeriod", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;
