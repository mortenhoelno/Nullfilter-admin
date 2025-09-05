// pages/login.js — FERDIG VERSJON (BYTT UT)
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { supabaseBrowser, authEnabled } from "../utils/supabaseClient";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authEnabled()) {
      // Auth slått av -> ingen vits å være her
      router.replace("/admin");
    }
  }, [router]);

  async function handleLogin(e) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const supabase = supabaseBrowser();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      router.replace("/admin");
    } catch (e) {
      setErr(e.message || "Kunne ikke logge inn.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword() {
    setErr("");
    if (!email) {
      setErr("Skriv inn e-post først.");
      return;
    }
    try {
      const supabase = supabaseBrowser();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login`,
      });
      if (error) throw error;
      alert("Passord-epost sendt (hvis adressen finnes).");
    } catch (e) {
      setErr(e.message || "Feil ved sending av reset-epost.");
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-gray-50">
      <div className="w-full max-w-sm bg-white p-6 rounded-2xl shadow">
        <h1 className="text-2xl font-bold mb-2">Logg inn</h1>
        <p className="text-sm text-gray-600 mb-6">
          Bare husk: riktig passord &gt; feil passord. (Rakettforskning, jeg vet.)
        </p>
        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="email"
            className="w-full rounded-xl border p-3"
            placeholder="E-post"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <input
            type="password"
            className="w-full rounded-xl border p-3"
            placeholder="Passord"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          {err ? <div className="text-sm text-red-600">{err}</div> : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl border p-3 font-semibold hover:bg-gray-100"
          >
            {loading ? "Logger inn…" : "Logg inn"}
          </button>
        </form>
        <button
          onClick={handleResetPassword}
          className="mt-4 text-sm text-blue-600 hover:underline"
        >
          Glemt passord?
        </button>
      </div>
    </div>
  );
}
