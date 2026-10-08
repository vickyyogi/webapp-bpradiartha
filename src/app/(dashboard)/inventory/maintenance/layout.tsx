import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pemeliharaan Aset",
};

export default function InventoryMaintenanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
