"use client";
import { usePrivy } from "@privy-io/react-auth";
import { useCallback } from "react";

/** fetch wrapper that attaches the Privy access token. */
export function useApi() {
  const { getAccessToken } = usePrivy();
  return useCallback(
    async <T,>(path: string, init?: RequestInit): Promise<T> => {
      const token = await getAccessToken();
      const res = await fetch(path, {
        ...init,
        headers: { "content-type": "application/json", ...(init?.headers ?? {}), authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`);
      return res.json() as Promise<T>;
    },
    [getAccessToken],
  );
}
