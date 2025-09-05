// pages/reset-password.js — FERDIG VERSJON
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabaseBrowser } from "../utils/supabaseClient";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = supabaseBrowser();

  const [loading, setLoading] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [err, setErr] = useState("");
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [done, setDone] = useState(false);

  // Når du kommer hit via e-postlenke (invite/signup/recovery),
  // supabase-js setter normalt en session automatisk.
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        // Belt & braces: sjekk hash for type=recovery|signup|invite
        if (typeof window !== "undefined" && window.location?.hash) {
          const hash = window.location.hash.replace(/^#/, "");
          const qp = new URLSearchParams(hash);
          const linkType = (qp.get("type") || "").toLowerCase();
          if (["recovery", "signup", "invite"].includes(linkType)) {
            // supabase håndterer token i hash -> getSession skal gi session
          }
        }
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (mounted) setHasSession(!!data?.session);
      } catch (e) {
        if (mounted) setErr(e.message || "Kunne ikke hente sesjon.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [supabase]);

  async function handleSubmit(e) {
    e.preventDefault();
    setErr("");

    if (!pw1 || !pw2) return setErr("Skriv nytt passord to ganger.");
    if (pw1 !== pw2) return setErr("Passordene er ikke like.");
    if (pw1.length < 8) return setErr("Passord må være minst 8 tegn.");

    try {
      setLoading(true);
      const { error } = await supabase.auth.updateUser({ password: pw1 });
      if (error) throw error;
      setDone(true);
    } catch (e) {
      setErr(e.message || "Kunne ikke oppdatere passord.");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="text-gray-600">Laster…</div>
      </div>
    );
  }

  if (!hasSession && !done) {
    // Kom hit uten gyldig e-postlenke (eller utløpt lenke)
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow p-6">
          <h1 className="text-xl font-semibold mb-2">Lenken er utløpt eller ugyldig</h1>
          <p className="text-sm text-gray-600">
            Gå til siden for glemt passord og be om en ny lenke.
          </p>
          {err ? <p className="mt-3 text-sm text-rose-600">Detaljer: {err}</p> : null}
          <button
            onClick={() => router.replace("/forgot-password")}
            className="mt-4 px-4 py-2 rounded-xl bg-slate-900 text-white hover:opacity-90"
          >
            Gå til “Glemt passord”
          </button>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow p-6 text-center">
          <h1 className="text-xl font-semibold mb-2">Passord oppdatert ✅</h1>
          <p className="text-sm text-gray-600 mb-4">
            Du kan nå logge inn med ditt nye passord.
          </p>
          <button
            onClick={() => router.replace("/login")}
            className="px-4 py-2 rounded-xl bg-slate-900 text-white hover:opacity-90"
          >
            Gå til innlogging
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow p-6">
        <h1 className="text-xl font-semibold mb-2">Skriv inn nytt passord</h1>
        <p className="text-sm text-gray-600 mb-4">
          Denne siden brukes både første gang du blir invitert og når du skal resette passordet ditt.
        </p>

        {err ? (
          <div className="mb-3 p-3 rounded bg-rose-50 border border-rose-200 text-rose-700 text-sm">
            {err}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm mb-1">Nytt passord</label>
            <input
              type="password"
              value={pw1}
              onChange={(e) => setPw1(e.target.value)}
              className="w-full border rounded-xl px-3 py-2"
              autoComplete="new-password"
              required
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Gjenta nytt passord</label>
            <input
              type="password"
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              className="w-full border rounded-xl px-3 py-2"
              autoComplete="new-password"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2 rounded-xl bg-slate-900 text-white hover:opacity-90 disabled:opacity-60"
          >
            {loading ? "Oppdaterer…" : "Sett nytt passord"}
          </button>
        </form>
      </div>
    </div>
  );
}
