// components/PromptStudio.js — NY
import { useEffect, useMemo, useState } from "react";
import personaConfig from "../config/personaConfig";
import { useApi } from "../utils/useApi";
import { useToast } from "../utils/toast";

const BOT_IDS = Object.keys(personaConfig || {});

function TextArea({ label, value, onChange, rows = 5 }) {
  return (
    <label className="block">
      <div className="text-sm font-medium text-gray-700 mb-1">{label}</div>
      <textarea
        className="w-full border rounded-lg px-3 py-2 text-sm"
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function Input({ label, value, onChange, type = "text", placeholder }) {
  return (
    <label className="block">
      <div className="text-sm font-medium text-gray-700 mb-1">{label}</div>
      <input
        type={type}
        className="w-full border rounded-lg px-3 py-2 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

function NumberInput({ label, value, onChange, min = 0 }) {
  return (
    <label className="block">
      <div className="text-sm font-medium text-gray-700 mb-1">{label}</div>
      <input
        type="number"
        min={min}
        className="w-full border rounded-lg px-3 py-2 text-sm"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

export default function PromptStudio() {
  const api = useApi();
  const { toast } = useToast();

  const [botId, setBotId] = useState(BOT_IDS[0] || "nullfilter");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Redigerbare felter
  const defaults = useMemo(() => personaConfig?.[botId] || {}, [botId]);
  const [form, setForm] = useState({
    model: "",
    systemPrompt: "",
    themeColor: "",
    crisisText: "",
    pinMode: "",
    pinDocNumbers: "",
    tokenBudget: { pinnedMax: 0, ragMax: 0, replyMax: 0 },
  });

  // Hent gjeldende fra API (DB override) → fallback til personaConfig
  async function load() {
    setLoading(true);
    try {
      const data = await api.get(`/api/persona/get?botId=${encodeURIComponent(botId)}`);
      const merged = {
        model: data?.model ?? defaults?.model ?? "",
        systemPrompt: data?.systemPrompt ?? defaults?.systemPrompt ?? "",
        themeColor: data?.themeColor ?? defaults?.themeColor ?? "blue",
        crisisText: data?.crisisText ?? defaults?.crisisText ?? "",
        pinMode: data?.pinMode ?? defaults?.pinMode ?? "all",
        pinDocNumbers: (data?.pinDocNumbers ?? defaults?.pinDocNumbers ?? []).join(","),
        tokenBudget: {
          pinnedMax: data?.tokenBudget?.pinnedMax ?? defaults?.tokenBudget?.pinnedMax ?? 2000,
          ragMax: data?.tokenBudget?.ragMax ?? defaults?.tokenBudget?.ragMax ?? 1800,
          replyMax: data?.tokenBudget?.replyMax ?? defaults?.tokenBudget?.replyMax ?? 1200,
        },
      };
      setForm(merged);
    } catch {
      // useApi toaster feilen allerede
      setForm({
        model: defaults?.model ?? "",
        systemPrompt: defaults?.systemPrompt ?? "",
        themeColor: defaults?.themeColor ?? "blue",
        crisisText: defaults?.crisisText ?? "",
        pinMode: defaults?.pinMode ?? "all",
        pinDocNumbers: (defaults?.pinDocNumbers ?? []).join(","),
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
      await api.post("/api/persona/save", { botId, patch });
      toast("Lagret 🎉", { type: "success" });
    } catch {
      // toast allerede fra useApi
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="bg-white rounded-2xl shadow p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">🎛️ Prompt-studio</h2>
        <div className="flex items-center gap-2">
          <label className="text-sm">
            Bot:
            <select
              className="ml-2 border rounded-lg px-2 py-1 text-sm"
              value={botId}
              onChange={(e) => setBotId(e.target.value)}
            >
              {BOT_IDS.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={load}
            className="px-3 py-2 rounded-xl bg-gray-200 hover:bg-gray-300 text-sm"
            disabled={loading}
          >
            Oppdater
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-gray-500">Laster data…</div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          <Input label="Modell" value={form.model} onChange={(v) => setForm((f) => ({ ...f, model: v }))} />
          <Input
            label="Theme color"
            value={form.themeColor}
            onChange={(v) => setForm((f) => ({ ...f, themeColor: v }))}
            placeholder="blue | green | …"
          />
          <Input
            label="Pin mode"
            value={form.pinMode}
            onChange={(v) => setForm((f) => ({ ...f, pinMode: v }))}
            placeholder="all | none | selected"
          />
          <Input
            label="Pin doc numbers (kommaseparert)"
            value={form.pinDocNumbers}
            onChange={(v) => setForm((f) => ({ ...f, pinDocNumbers: v }))}
            placeholder="1,50"
          />
          <TextArea
            label="System prompt"
            value={form.systemPrompt}
            onChange={(v) => setForm((f) => ({ ...f, systemPrompt: v }))}
            rows={8}
          />
          <TextArea
            label="Crisis text"
            value={form.crisisText}
            onChange={(v) => setForm((f) => ({ ...f, crisisText: v }))}
            rows={8}
          />

          <div className="grid grid-cols-3 gap-3 md:col-span-2">
            <NumberInput
              label="Token budget – pinnedMax"
              value={form.tokenBudget.pinnedMax}
              onChange={(v) => setForm((f) => ({ ...f, tokenBudget: { ...f.tokenBudget, pinnedMax: v } }))}
              min={0}
            />
            <NumberInput
              label="Token budget – ragMax"
              value={form.tokenBudget.ragMax}
              onChange={(v) => setForm((f) => ({ ...f, tokenBudget: { ...f.tokenBudget, ragMax: v } }))}
              min={0}
            />
            <NumberInput
              label="Token budget – replyMax"
              value={form.tokenBudget.replyMax}
              onChange={(v) => setForm((f) => ({ ...f, tokenBudget: { ...f.tokenBudget, replyMax: v } }))}
              min={0}
            />
          </div>

          <div className="md:col-span-2 flex items-center gap-3">
            <button
              onClick={save}
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-60"
            >
              {saving ? "Lagrer…" : "Lagre endringer"}
            </button>
            <div className="text-xs text-gray-500">
              Endringer lagres i DB og overstyrer personaConfig (fallback hvis tom).
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
