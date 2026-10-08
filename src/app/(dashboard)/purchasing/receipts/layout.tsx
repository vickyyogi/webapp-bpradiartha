import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Penerimaan Barang (GRN)",
};

export default function PurchasingReceiptsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
