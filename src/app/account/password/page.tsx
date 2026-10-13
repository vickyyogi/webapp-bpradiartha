import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck, ArrowLeft } from "lucide-react";
import { getSessionUser } from "@/lib/session-user";
import { AccountSecurityClient } from "./AccountSecurityClient";

export const metadata: Metadata = {
  title: "Keamanan Akun",
  description: "Ganti kata sandi dan akhiri sesi di seluruh perangkat.",
  robots: { index: false, follow: false },
};

/**
 * Halaman keamanan akun (Tahap 1B-3).
 *
 * Berada di luar grup (dashboard) supaya akun yang wajib mengganti sandi tetap
 * dapat membuka halaman ini (di dalam grup, layout akan mengalihkannya ke sini
 * dan terjadi putaran). Sesi tetap diwajibkan oleh src/proxy.ts.
 */
export default async function AccountPasswordPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-6 bg-muted/20">
      <div className="w-full max-w-lg space-y-4">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 px-3 py-1 rounded-full text-[11px] font-medium text-primary">
            <ShieldCheck className="h-3.5 w-3.5" />
            Keamanan Akun
          </div>
          <h1 className="text-lg font-extrabold tracking-tight text-foreground">PT BPR Adiartha Utama</h1>
          <p className="text-[11px] text-muted-foreground">
            Masuk sebagai <span className="font-semibold text-foreground">{user.email}</span>
          </p>
        </div>

        <AccountSecurityClient mustChangePassword={user.mustChangePassword} email={user.email} />

        <div className="text-center">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke Dasbor
          </Link>
        </div>
      </div>
    </div>
  );
}
