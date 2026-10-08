import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Aset Operasional",
    template: "%s | BPR Adiartha Reksacitra",
  },
};

export default function InventoryAssetsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
