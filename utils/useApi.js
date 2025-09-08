// utils/useApi.js — NY FIL
// Bruk: const api = useApi(); await api.post("/api/rag/chat", body);

import { useToast } from "./toast";

export function useApi() {
  const { toast } = useToast();

  async function request(method, url, body, init = {}) {
    try {
      const resp = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", ...(init.headers || {}) },
        body: body ? JSON.stringify(body) : undefined,
        ...init,
      });
      const isJson = (resp.headers.get("content-type") || "").includes("application/json");
      const data = isJson ? await resp.json() : await resp.text();
      if (!resp.ok) {
        const msg = (data && (data.error || data.message)) || `HTTP ${resp.status}`;
        toast(`Noe gikk galt: ${msg}`, { type: "error" });
        throw new Error(msg);
      }
      return data;
    } catch (err) {
      toast(`Nettverksfeil: ${String(err?.message || err)}`, { type: "error" });
      throw err;
    }
  }

  return {
    get: (url, init) => request("GET", url, null, init),
    post: (url, body, init) => request("POST", url, body, init),
  };
}
