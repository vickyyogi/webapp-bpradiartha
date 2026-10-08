import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuthAndPermission, requireAnyPermission } from "@/lib/permissions";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authCheck = await requireAuthAndPermission("admin.permission.view");
    if (!authCheck.authorized) {
      return authCheck.response;
    }

    const permissions = await db.permission.findMany({
      orderBy: { code: "asc" },
    });

    return NextResponse.json(permissions);
  } catch (error) {
    console.error("Error fetching permissions:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

const SEED_PERMISSIONS = [
  { code: "credit.application.view", name: "Lihat Pengajuan Kredit" },
  { code: "credit.application.create", name: "Buat Pengajuan Kredit" },
  { code: "credit.application.edit", name: "Edit Pengajuan Kredit" },
  { code: "credit.application.verify", name: "Verifikasi Pengajuan Kredit" },
  { code: "credit.analysis.create", name: "Buat Analisa Kredit" },
  { code: "credit.analysis.review", name: "Review Analisa Kredit" },
  { code: "credit.application.approve", name: "Setujui Pengajuan Kredit" },
  { code: "credit.application.reject", name: "Tolak Pengajuan Kredit" },
  { code: "inventory.asset.view", name: "Lihat Aset Inventaris" },
  { code: "inventory.asset.create", name: "Buat Aset Inventaris" },
  { code: "inventory.asset.transfer", name: "Transfer Aset Inventaris" },
  { code: "purchase.request.create", name: "Buat Permintaan Pembelian" },
  { code: "purchase.request.approve", name: "Setujui Permintaan Pembelian" },
  { code: "purchase.order.create", name: "Buat Pesanan Pembelian" },
  { code: "report.credit.view", name: "Lihat Laporan Kredit" },
  { code: "report.performance.view", name: "Lihat Laporan Kinerja" },
  { code: "audit.log.view", name: "Lihat Log Audit" },
  { code: "admin.user.manage", name: "Kelola Pengguna" },
  { code: "admin.role.manage", name: "Kelola Peran" },
  { code: "admin.master.manage", name: "Kelola Data Master" },
  { code: "admin.cms.manage", name: "Kelola CMS" },
];

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const authCheck = await requireAnyPermission(["admin.super"]);
    if (!authCheck.authorized) {
      return authCheck.response;
    }

    const created = [];
    for (const perm of SEED_PERMISSIONS) {
      const existing = await db.permission.findUnique({
        where: { code: perm.code },
      });
      if (!existing) {
        const newPerm = await db.permission.create({
          data: { code: perm.code, name: perm.name },
        });
        created.push(newPerm);
      }
    }

    return NextResponse.json({ message: "Permissions seeded", createdCount: created.length });
  } catch (error) {
    console.error("Error seeding permissions:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
