// middleware.js — beskytter admin-sider
import { NextResponse } from "next/server";
import { supabase } from "./utils/auth";

export async function middleware(req) {
  const { data: { user } } = await supabase.auth.getUser();

  // Ikke logget inn
  if (!user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Hent profil for rolle
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const isAdmin = profile?.role === "admin";

  // Hvis bruker prøver å nå /admin uten admin-rolle
  if (req.nextUrl.pathname.startsWith("/admin") && !isAdmin) {
    return NextResponse.redirect(new URL("/chat-nullfilter", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"], // kun admin-sider beskyttes
};
