import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CMS & Konten Website",
};

export default function AdminCmsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
