// pages/forgot-password.js — FERDIG VERSJON
import { useState } from "react";
import { useRouter } from "next/router";
import { supabaseBrowser } from "../utils/supabaseClient";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setErr("");
    if (!email) {
      setErr("Skriv inn e-postadressen din.");
      return;
    }
    try {
      setLoading(true);
      const supabase = supabaseBrowser();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        // Viktig: lenken i e-posten skal lande på siden der man kan sette nytt passord
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSent(true);
    } catch (e) {
      setErr(e.message || "Kunne ikke sende e-post for passordreset.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="min-h-screen grid place-items-center bg-gray-50 p-6">
        <div className="w-full max-w-md bg-white rounded-2xl shadow p-6 text-center">
          <h1 className="text-xl font-semibold mb-2">Sjekk e-posten din 📬</h1>
          <p className="text-sm text-gray-600">
            Vi har sendt en lenke for å sette nytt passord til <b>{email}</b>.
            Klikk lenken, så kommer du til siden for å velge nytt passord.
          </p>
          <button
            onClick={() => router.replace("/login")}
            className="mt-4 px-4 py-2 rounded-xl bg-slate-900 text-white hover:opacity-90"
          >
            Tilbake til innlogging
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid place-items-center bg-gray-50 p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow p-6">
        <h1 className="text-xl font-semibold mb-2">Glemt passord</h1>
        <p className="text-sm text-gray-600 mb-4">
          Skriv inn e-postadressen din, så sender vi deg en lenke for å sette et nytt passord.
        </p>

        {err ? (
          <div className="mb-3 p-3 rounded bg-rose-50 border border-rose-200 text-rose-700 text-sm">
            {err}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm mb-1">E-post</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border rounded-xl px-3 py-2"
              autoComplete="email"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2 rounded-xl bg-slate-900 text-white hover:opacity-90 disabled:opacity-60"
          >
            {loading ? "Sender…" : "Send lenke"}
          </button>
        </form>

        <button
          onClick={() => router.replace("/login")}
          className="mt-4 text-sm text-blue-600 hover:underline"
        >
          Tilbake til innlogging
        </button>
      </div>
    </div>
  );
}
