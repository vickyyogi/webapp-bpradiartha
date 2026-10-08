import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Pesanan Pembelian (PO)",
    template: "%s | BPR Adiartha Reksacitra",
  },
};

export default function PurchasingOrdersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
