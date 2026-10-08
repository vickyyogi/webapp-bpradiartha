import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Inventaris & Aset",
    template: "%s | BPR Adiartha Reksacitra",
  },
};

export default function InventoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
