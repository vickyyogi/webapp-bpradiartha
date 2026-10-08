import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Rekanan & Vendor",
};

export default function PurchasingVendorsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
