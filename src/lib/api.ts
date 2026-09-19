import { useCallback } from "react";
import { useAuth } from "../context/AuthContext";

const DEFAULT_PRODUCTION_API_BASE = "https://procurement-api-131528757755.asia-southeast1.run.app";

export function getApiBaseUrl() {
  const configured = (import.meta.env.VITE_API_BASE_URL || "").trim().replace(/\/+$/, "");
  if (configured) return configured;
  if (import.meta.env.DEV) return "";
  return DEFAULT_PRODUCTION_API_BASE;
}

export function resolveApiUrl(input: string) {
  if (/^https?:\/\//i.test(input)) return input;
  const normalized = input.startsWith("/") ? input : `/${input}`;
  const base = getApiBaseUrl();
  return base ? `${base}${normalized}` : normalized;
}

export function resolveAssetUrl(value: string | null | undefined) {
  if (!value) return "";
  if (/^https?:\/\//i.test(value) || value.startsWith("data:")) return value;
  return resolveApiUrl(value);
}

export function useApi() {
  const { getIdToken } = useAuth();

  return useCallback(async (input: RequestInfo, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? resolveApiUrl(input) : input;
    const token = await getIdToken(true);
    const headers = new Headers(init?.headers || {});
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    if (init?.body && typeof FormData !== 'undefined' && init.body instanceof FormData) {
      headers.delete('Content-Type');
    }
    return fetch(url, { ...init, headers });
  }, [getIdToken]);
}
