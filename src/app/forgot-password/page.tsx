import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck, ArrowLeft } from "lucide-react";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Lupa Kata Sandi",
  description: "Pemulihan akses akun staf PT BPR Adiartha Utama melalui tautan email.",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-6 bg-muted/20">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 px-3 py-1 rounded-full text-[11px] font-medium text-primary">
            <ShieldCheck className="h-3.5 w-3.5" />
            Keamanan Akun
          </div>
          <h1 className="text-lg font-extrabold tracking-tight text-foreground">PT BPR Adiartha Utama</h1>
        </div>

        <ForgotPasswordForm />

        <div className="text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke Beranda
          </Link>
        </div>
      </div>
    </div>
  );
}
