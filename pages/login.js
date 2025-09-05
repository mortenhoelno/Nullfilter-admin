// pages/login.js
import { useState } from "react";
import { supabase } from "../utils/supabaseClient";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
    } else {
      window.location.href = "/admin"; // redirect til admin
    }
    setLoading(false);
  }

  async function handleResetPassword() {
    if (!email) {
      setError("Skriv inn e-post først.");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + "/reset-password",
    });
    if (error) setError(error.message);
    else alert("Sjekk e-posten din for instruksjoner.");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded shadow-md w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-4">Logg inn</h1>
        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="email"
            placeholder="E-post"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border px-3 py-2 rounded"
          />
          <input
            type="password"
            placeholder="Passord"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border px-3 py-2 rounded"
          />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
          >
            {loading ? "Logger inn..." : "Logg inn"}
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
