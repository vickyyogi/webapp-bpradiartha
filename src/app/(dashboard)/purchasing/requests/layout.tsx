import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Pengajuan Pembelian (PR)",
    template: "%s | BPR Adiartha Reksacitra",
  },
};

export default function PurchasingRequestsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
