import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { MfaSetupClientView } from "./MfaSetupClientView";

export const metadata = {
  title: "Pendaftaran MFA — BPR Adiartha Reksacitra",
};

/**
 * Halaman pendaftaran MFA (Tahap 1B).
 *
 * Sengaja berada di luar grup (dashboard) supaya pengguna yang WAJIB memakai MFA
 * tetapi belum mendaftar tetap bisa membuka halaman ini — bukan terjebak
 * pengalihan berputar di layout dasbor.
 */
export default async function MfaSetupPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
      <MfaSetupClientView userEmail={session.user.email} />
    </main>
  );
}
