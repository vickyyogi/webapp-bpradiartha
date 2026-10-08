import type { Metadata } from "next";
import { db } from "@/lib/db";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const request = await db.purchaseRequest.findUnique({
    where: { id },
    select: { title: true, requestNumber: true },
  });

  return {
    title: request
      ? `${request.requestNumber} - ${request.title}`
      : "Detail Pengajuan (PR)",
  };
}

export default function PurchasingRequestDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
