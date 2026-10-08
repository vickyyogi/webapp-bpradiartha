import { NextResponse, NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // Protect all routes except login, api, static files, and public routes
  if (
    path.startsWith("/api") ||
    path.startsWith("/_next") ||
    path === "/" ||
    path.startsWith("/berita") ||
    path.startsWith("/galeri") ||
    path.startsWith("/laporan") ||
    path.startsWith("/uploads") ||
    path.startsWith("/public") ||
    path.includes("favicon.ico") ||
    /\.(png|jpg|jpeg|gif|svg|webp|ico|woff|woff2|ttf|pdf)$/i.test(path)
  ) {
    return NextResponse.next();
  }

  // Use getToken for authentication check
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  if (path.startsWith("/login")) {
    if (token) {
      // Redirect logged in users trying to access login
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  }

  // If no token, redirect to login
  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
