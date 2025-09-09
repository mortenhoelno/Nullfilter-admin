// components/PromptStudioFull.js — FULL KONFIG-STUDIO (med lagring via API)
// Bruker /api/persona/get og /api/persona/save.
// Fallback: in-memory lagring på server hvis Supabase ikke er tilgjengelig.

import { useEffect, useMemo, useState } from "react";
import personaConfig from "../config/personaConfig";

const BOT_IDS = Object.keys(personaConfig || {});

function Field({ label, children }) {
  return (
    <label className="block">
      <div className="text-sm font-medium text-gray-700 mb-1">{label}</div>
      {children}
    </label>
  );
}

export default function PromptStudioFull() {
  const [botId, setBotId] = useState(BOT_IDS[0] || "nullfilter");
  const defaults = useMemo(() => personaConfig?.[botId] || {}, [botId]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const [form, setForm] = useState({
    model: "",
    systemPrompt: "",
    themeColor: "",
    crisisText: "",
    pinMode: "",
    pinDocNumbers: "",
    tokenBudget: { pinnedMax: 2000, ragMax: 1800, replyMax: 1200 },
  });

  async function load() {
    setLoading(true);
    setMsg("");
    try {
      const res = await fetch(`/api/persona/get?botId=${encodeURIComponent(botId)}`);
      const json = await res.json();
      const d = json?.data || {};
      const merged = {
        model: d.model ?? defaults.model ?? "",
        systemPrompt: d.systemPrompt ?? defaults.systemPrompt ?? "",
        themeColor: d.themeColor ?? defaults.themeColor ?? "blue",
        crisisText: d.crisisText ?? defaults.crisisText ?? "",
        pinMode: d.pinMode ?? defaults.pinMode ?? "all",
        pinDocNumbers: (d.pinDocNumbers ?? defaults.pinDocNumbers ?? []).join(","),
        tokenBudget: {
          pinnedMax: d?.tokenBudget?.pinnedMax ?? defaults?.tokenBudget?.pinnedMax ?? 2000,
          ragMax: d?.tokenBudget?.ragMax ?? defaults?.tokenBudget?.ragMax ?? 1800,
          replyMax: d?.tokenBudget?.replyMax ?? defaults?.tokenBudget?.replyMax ?? 1200,
        },
      };
      setForm(merged);
      if (json?.note) setMsg(json.note);
    } catch (e) {
      setMsg(`Kunne ikke hente – bruker defaults. (${String(e)})`);
      setForm({
        model: defaults.model ?? "",
        systemPrompt: defaults.systemPrompt ?? "",
        themeColor: defaults.themeColor ?? "blue",
        crisisText: defaults.crisisText ?? "",
        pinMode: defaults.pinMode ?? "all",
        pinDocNumbers: (defaults.pinDocNumbers ?? []).join(","),
        tokenBudget: {
          pinnedMax: defaults?.tokenBudget?.pinnedMax ?? 2000,
          ragMax: defaults?.tokenBudget?.ragMax ?? 1800,
          replyMax: defaults?.tokenBudget?.replyMax ?? 1200,
        },
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botId]);

  async function save() {
    setSaving(true);
    setMsg("");
    try {
      const patch = {
        model: form.model,
        systemPrompt: form.systemPrompt,
        themeColor: form.themeColor,
        crisisText: form.crisisText,
        pinMode: form.pinMode,
        pinDocNumbers: form.pinDocNumbers
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .map((s) => Number(s))
          .filter((n) => Number.isFinite(n)),
        tokenBudget: {
          pinnedMax: Number(form.tokenBudget.pinnedMax || 0),
          ragMax: Number(form.tokenBudget.ragMax || 0),
          replyMax: Number(form.tokenBudget.replyMax || 0),
        },
      };
      const res = await fetch("/api/persona/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botId, patch }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      setMsg(json?.message || "Lagret ✅");
    } catch (e) {
      setMsg(`Kunne ikke lagre: ${String(e?.message || e)}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="bg-white rounded-2xl shadow p-5">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-semibold">🎛️ Prompt-studio (konfig)</h2>
        <div className="flex items-center gap-2">
          <Field label="Bot">
            <select
              className="border rounded-lg px-2 py-1 text-sm"
              value={botId}
              onChange={(e) => setBotId(e.target.value)}
            >
              {BOT_IDS.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </Field>
          <button
            onClick={load}
            className="px-3 py-2 rounded-xl bg-gray-200 hover:bg-gray-300 text-sm"
            disabled={loading}
          >
            Oppdater
          </button>
        </div>
      </div>

      <p className="text-xs text-gray-500 mb-4">
        Endrer bot-oppsett permanent via API. Hvis Supabase ikke er satt opp, lagres i minnet på server (dev-vennlig).
      </p>

      {msg && <div className="mb-3 text-xs text-gray-600">{msg}</div>}

      {loading ? (
        <div className="text-gray-500">Laster data…</div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Modell">
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={form.model}
              onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
              placeholder="gpt-4o"
            />
          </Field>

          <Field label="Theme color">
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={form.themeColor}
              onChange={(e) => setForm((f) => ({ ...f, themeColor: e.target.value }))}
              placeholder="blue | green | …"
            />
          </Field>

          <Field label="Pin mode">
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={form.pinMode}
              onChange={(e) => setForm((f) => ({ ...f, pinMode: e.target.value }))}
              placeholder="all | none | selected"
            />
          </Field>

          <Field label="Pin doc numbers (kommaseparert)">
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={form.pinDocNumbers}
              onChange={(e) => setForm((f) => ({ ...f, pinDocNumbers: e.target.value }))}
              placeholder="1,50"
            />
          </Field>

          <Field label="System prompt">
            <textarea
              className="w-full border rounded-lg px-3 py-2 text-sm min-h-[120px]"
              value={form.systemPrompt}
              onChange={(e) => setForm((f) => ({ ...f, systemPrompt: e.target.value }))}
            />
          </Field>

          <Field label="Crisis text">
            <textarea
              className="w-full border rounded-lg px-3 py-2 text-sm min-h-[120px]"
              value={form.crisisText}
              onChange={(e) => setForm((f) => ({ ...f, crisisText: e.target.value }))}
            />
          </Field>

          <div className="grid grid-cols-3 gap-3 md:col-span-2">
            <Field label="Token budget – pinnedMax">
              <input
                type="number"
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={form.tokenBudget.pinnedMax}
                onChange={(e) =>
                  setForm((f) => ({ ...f, tokenBudget: { ...f.tokenBudget, pinnedMax: Number(e.target.value) } }))
                }
                min={0}
              />
            </Field>

            <Field label="Token budget – ragMax">
              <input
                type="number"
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={form.tokenBudget.ragMax}
                onChange={(e) =>
                  setForm((f) => ({ ...f, tokenBudget: { ...f.tokenBudget, ragMax: Number(e.target.value) } }))
                }
                min={0}
              />
            </Field>

            <Field label="Token budget – replyMax">
              <input
                type="number"
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={form.tokenBudget.replyMax}
                onChange={(e) =>
                  setForm((f) => ({ ...f, tokenBudget: { ...f.tokenBudget, replyMax: Number(e.target.value) } }))
                }
                min={0}
              />
            </Field>
          </div>

          <div className="md:col-span-2 flex items-center gap-3">
            <button
              onClick={save}
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-60"
            >
              {saving ? "Lagrer…" : "Lagre endringer"}
            </button>
            <div className="text-xs text-gray-500">Overstyrer personaConfig (fallback hvis tom).</div>
          </div>
        </div>
      )}
    </section>
  );
}
