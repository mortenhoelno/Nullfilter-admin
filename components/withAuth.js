// components/withAuth.js — FERDIG VERSJON (BYTT UT)
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabaseBrowser, authEnabled } from "../utils/supabaseClient";

export default function withAuth(Component) {
  function Wrapped(props) {
    const router = useRouter();
    const [ready, setReady] = useState(!authEnabled()); // hvis auth av, er vi "klare"
    const [error, setError] = useState("");

    useEffect(() => {
      if (!authEnabled()) return; // auth skrudd av → kjør rett igjennom

      const supabase = supabaseBrowser();

      // 1) Oppfang e-postlenker (invite / recovery / signup) via hash
      // Supabase legger ting som: #access_token=...&type=recovery|signup|invite
      try {
        if (typeof window !== "undefined" && window.location?.hash) {
          const hash = window.location.hash.startsWith("#")
            ? window.location.hash.slice(1)
            : window.location.hash;
          const qp = new URLSearchParams(hash);
          const linkType = (qp.get("type") || "").toLowerCase();

          if (linkType === "recovery" || linkType === "signup" || linkType === "invite") {
            // Tving bruker til å sette passord først
            router.replace("/reset-password");
            return;
          }
        }
      } catch {
        // ignorer parsing-feil
      }

      // 2) Lytt etter Supabase-auth event for passord-recovery (belt & braces)
      const { data: sub } = supabase.auth.onAuthStateChange((event) => {
        if (event === "PASSWORD_RECOVERY") {
          router.replace("/reset-password");
        }
      });

      // 3) Vanlig session-sjekk
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

      return () => {
        sub?.subscription?.unsubscribe?.();
      };
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
