// components/ToastHost.jsx
import { useEffect, useState } from "react";

/**
 * Minimal toast-host som lytter på window.dispatchEvent(new CustomEvent('toast', { detail }))
 * Bruk via utils/toast.js (kommer som neste fil).
 *
 * Typer:
 *  detail = { type?: 'success'|'error'|'info', message: string, duration?: number }
 */
export default function ToastHost() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    function onToast(e) {
      const { message, type = "info", duration = 4000 } = e.detail || {};
      if (!message) return;
      const id = Math.random().toString(36).slice(2);
      setToasts((prev) => [...prev, { id, message, type }]);

      // auto-remove
      const t = setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== id));
      }, duration);
      return () => clearTimeout(t);
    }
    window.addEventListener("toast", onToast);
    return () => window.removeEventListener("toast", onToast);
  }, []);

  const bgByType = {
    success: "bg-emerald-600",
    error: "bg-rose-600",
    info: "bg-slate-700",
  };

  return (
    <div className="fixed z-[9999] bottom-4 right-4 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto max-w-sm text-white shadow-lg rounded-lg px-4 py-3 ${bgByType[t.type] || bgByType.info}`}
        >
          <div className="flex items-start gap-3">
            <span className="mt-0.5">
              {t.type === "success" ? "✅" : t.type === "error" ? "⚠️" : "💡"}
            </span>
            <div className="text-sm leading-snug whitespace-pre-wrap">{t.message}</div>
            <button
              aria-label="Lukk"
              className="ml-auto opacity-80 hover:opacity-100"
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
            >
              ✖
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
