import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Pengadaan (Purchasing)",
    template: "%s | BPR Adiartha Reksacitra",
  },
};

export default function PurchasingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
