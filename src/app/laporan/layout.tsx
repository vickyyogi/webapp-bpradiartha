import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Laporan & Publikasi",
    template: "%s | BPR Adiartha Reksacitra",
  },
  description:
    "Laporan keuangan, tata kelola, dan publikasi resmi BPR Adiartha Reksacitra.",
};

export default function LaporanLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
