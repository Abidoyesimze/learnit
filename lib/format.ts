import { formatUnits } from "viem";
export const fmtGD = (wei: string | bigint, dp = 2) => Number(formatUnits(BigInt(wei), 18)).toLocaleString("en", { maximumFractionDigits: dp, minimumFractionDigits: dp });
export const short = (a: string) => `${a.slice(0, 6)}...${a.slice(-4)}`;
