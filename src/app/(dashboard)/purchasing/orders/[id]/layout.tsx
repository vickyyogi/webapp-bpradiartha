import type { Metadata } from "next";
import { db } from "@/lib/db";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const order = await db.purchaseOrder.findUnique({
    where: { id },
    select: { poNumber: true, vendor: { select: { name: true } } },
  });

  const vendorName = order?.vendor?.name;
  return {
    title: order
      ? `${order.poNumber}${vendorName ? ` - ${vendorName}` : ""}`
      : "Detail Pesanan (PO)",
  };
}

export default function PurchasingOrderDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
