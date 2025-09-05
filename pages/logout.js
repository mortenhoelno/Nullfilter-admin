// pages/logout.js — NY FIL (LEGG TIL)
import { useEffect } from "react";
import { useRouter } from "next/router";
import { supabaseBrowser } from "../utils/supabaseClient";

export default function LogoutPage() {
  const router = useRouter();
  useEffect(() => {
    (async () => {
      const supabase = supabaseBrowser();
      await supabase.auth.signOut();
      router.replace("/login");
    })();
  }, [router]);
  return (
    <div className="min-h-screen grid place-items-center">
      <div>Logger ut…</div>
    </div>
  );
}
