import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Stok Barang & ATK",
    template: "%s | BPR Adiartha Reksacitra",
  },
};

export default function InventoryItemsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
