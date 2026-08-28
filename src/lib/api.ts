import { useCallback } from "react";
import { useAuth } from "../context/AuthContext";

export function useApi() {
  const { getIdToken } = useAuth();

  return useCallback(async (input: RequestInfo, init?: RequestInit): Promise<Response> => {
    const token = await getIdToken();
    const headers = new Headers(init?.headers || {});
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    return fetch(input, { ...init, headers });
  }, [getIdToken]);
}
