import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuthAndPermission, requireAnyPermission } from "@/lib/permissions";
import { buildAuditLogData, extractClientInfo } from "@/lib/audit";
import { normalizeLoanProductAttributes } from "@/lib/credit-product";

export async function GET (req: NextRequest) {
  try {
    const authCheck = await requireAnyPermission(["admin.master_data.view"]);
    if (!authCheck.authorized) {
      return authCheck.response;
    }

    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const activeOnly = searchParams.get("activeOnly") === "true";

    const where: Prisma.MasterItemWhereInput = { organizationId: authCheck.user!.organizationId };
    if (category && category !== "ALL") {
      where.category = category;
    }
    if (activeOnly) {
      where.isActive = true;
    }

    const items = await db.masterItem.findMany({
      where,
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
    });

    return NextResponse.json(items);
  } catch (error) {
    console.error("GET /api/admin/master-data error:", error);
    return NextResponse.json({ error: "Failed to fetch master data" }, { status: 500 });
  }
}

export async function POST (req: NextRequest) {
  try {
    const authCheck = await requireAuthAndPermission("admin.master_data.manage");
    if (!authCheck.authorized) {
      return authCheck.response;
    }
    const currentUser = authCheck.user!;

    const body = await req.json();
    const { category, code, name, description, attributes, sortOrder, isActive } = body;

    if (!category || !code || !name) {
      return NextResponse.json({ error: "Kategori, kode, dan nama wajib diisi" }, { status: 400 });
    }

    // Tahap 9A (P1.1): atribut produk kredit (plafon, tenor, persyaratan
    // dokumen) dinormalkan & divalidasi sebelum disimpan.
    let normalizedAttributes = attributes || null;
    if (category === "LOAN_PRODUCT") {
      const normalized = normalizeLoanProductAttributes(attributes);
      if (normalized.error) {
        return NextResponse.json({ error: normalized.error }, { status: 400 });
      }
      normalizedAttributes = normalized.attributes;
    }

    // Check code uniqueness within org + category
    const existing = await db.masterItem.findUnique({
      where: {
        organizationId_category_code: {
          organizationId: currentUser.organizationId,
          category,
          code: code.trim().toUpperCase(),
        },
      },
    });

    if (existing) {
      return NextResponse.json({ error: `Kode '${code}' sudah terdaftar pada kategori '${category}'` }, { status: 400 });
    }

    const clientInfo = extractClientInfo(req);
    // Tahap 7 (P1.6): master data + audit ditulis atomik.
    const item = await db.$transaction(async (tx) => {
      const created = await tx.masterItem.create({
        data: {
          organizationId: currentUser.organizationId,
          category,
          code: code.trim().toUpperCase(),
          name,
          description: description || null,
          attributes: normalizedAttributes,
          sortOrder: Number(sortOrder) || 0,
          isActive: isActive !== undefined ? Boolean(isActive) : true,
        },
      });

      await tx.auditLog.create({
        data: buildAuditLogData({
          organizationId: currentUser.organizationId,
          userId: currentUser.id,
          action: "CREATE",
          entityType: "MASTER_DATA",
          entityId: created.id,
          newValues: created,
          notes: `Menambahkan Master Data [${created.category}]: ${created.code} - ${created.name}`,
          ...clientInfo,
        }),
      });

      return created;
    });

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/master-data error:", error);
    return NextResponse.json({ error: "Failed to create master item" }, { status: 500 });
  }
}
