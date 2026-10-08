import type { Metadata } from "next";
import { db } from "@/lib/db";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const asset = await db.asset.findUnique({
    where: { id },
    select: { name: true, assetNumber: true },
  });

  return {
    title: asset ? `${asset.name} (${asset.assetNumber})` : "Detail Aset",
  };
}

export default function InventoryAssetDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
