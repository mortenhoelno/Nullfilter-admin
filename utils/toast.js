// utils/toast.js — NY FIL (mikro-hook for å snakke med ToastHost)
// Bruk: const { toast } = useToast(); toast("Lagret!"); toast("Noe gikk galt", { type: "error" });

import { useCallback } from "react";

export function useToast() {
  const toast = useCallback((message, opts = {}) => {
    // opts: { type: "info" | "error" | "success", durationMs?: number }
    const detail = { message, ...opts };
    window.dispatchEvent(new CustomEvent("toast", { detail }));
  }, []);

  return { toast };
}
