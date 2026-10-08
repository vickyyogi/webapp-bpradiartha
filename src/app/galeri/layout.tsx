import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Galeri Foto",
  description:
    "Dokumentasi kegiatan, bakti sosial, survei lapangan, dan momen kebersamaan BPR Adiartha Reksacitra.",
};

export default function GaleriLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
