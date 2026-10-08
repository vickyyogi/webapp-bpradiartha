import type { Metadata } from "next";
import { db } from "@/lib/db";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const item = await db.inventoryItem.findUnique({
    where: { id },
    select: { name: true, itemCode: true },
  });

  return {
    title: item ? `${item.name} (${item.itemCode})` : "Detail Barang",
  };
}

export default function InventoryItemDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
