import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Berita & Kegiatan",
    template: "%s | BPR Adiartha Reksacitra",
  },
  description:
    "Informasi terbaru seputar kegiatan operasional, promo, dan edukasi finansial BPR Adiartha Reksacitra.",
};

export default function BeritaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
