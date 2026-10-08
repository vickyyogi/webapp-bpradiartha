import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Laporan & Analitika",
};

export default function ReportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
