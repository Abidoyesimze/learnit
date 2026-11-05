import { formatUnits } from "viem";
/** G$ amount. Whole amounts drop the decimals ("100"); others keep `dp` ("0.25"). Pass trim=false for aligned columns. */
export const fmtGD = (wei: string | bigint, dp = 2, trim = true) => {
  const n = Number(formatUnits(BigInt(wei), 18));
  return n.toLocaleString("en", { maximumFractionDigits: dp, minimumFractionDigits: trim && Number.isInteger(n) ? 0 : dp });
};
export const short = (a: string) => `${a.slice(0, 6)}...${a.slice(-4)}`;
