// components/withAuth.js — NY FIL (LEGG TIL)
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabaseBrowser, authEnabled } from "../utils/supabaseClient";

export default function withAuth(Component) {
  function Wrapped(props) {
    const router = useRouter();
    const [ready, setReady] = useState(!authEnabled()); // hvis auth av, er vi "klare"
    const [error, setError] = useState("");

    useEffect(() => {
      if (!authEnabled()) return; // auth skrudd av, kjør rett igjennom

      const supabase = supabaseBrowser();

      // Sjekk aktiv session
      supabase.auth.getSession().then(({ data, error }) => {
        if (error) {
          setError(error.message);
          router.replace("/login");
          return;
        }
        const session = data?.session;
        if (!session) {
          router.replace("/login");
        } else {
          setReady(true);
        }
      });
    }, [router]);

    if (!ready) {
      return (
        <div className="min-h-screen grid place-items-center">
          <div className="text-center">
            <div className="animate-pulse text-xl font-semibold">Sjekker adgang…</div>
            {error ? <p className="text-red-600 mt-2">{error}</p> : null}
          </div>
        </div>
      );
    }

    return <Component {...props} />;
  }

  Wrapped.displayName = `withAuth(${Component.displayName || Component.name || "Component"})`;
  return Wrapped;
}
