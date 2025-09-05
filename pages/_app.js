// pages/_app.js — med Supabase Auth
import { useEffect, useState } from "react";
import { supabase } from "../utils/auth"; // 👈 henter fra utils/auth.js
import "../styles/globals.css";

export default function MyApp({ Component, pageProps }) {
  const [user, setUser] = useState(null);

  // Når appen laster inn → hent bruker + lytt etter endringer
  useEffect(() => {
    // 1) Hent eksisterende session
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user ?? null);
    });

    // 2) Abonner på innloggingsstatus
    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    // 3) Rydd opp
    return () => {
      subscription?.subscription?.unsubscribe();
    };
  }, []);

  return <Component {...pageProps} user={user} />;
}
