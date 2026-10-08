import type { Metadata } from "next";
import { db } from "@/lib/db";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const decodedSlug = decodeURIComponent(slug).trim();

  const report = await db.cmsReport.findFirst({
    where: { slug: decodedSlug, isActive: true },
    select: { title: true, description: true },
  });

  return {
    title: report?.title ?? "Detail Laporan",
    description: report?.description ?? undefined,
  };
}

export default function LaporanDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
