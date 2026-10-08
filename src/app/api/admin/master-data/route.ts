import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { requireAuthAndPermission, requireAnyPermission } from "@/lib/permissions";
import { logAudit, extractClientInfo } from "@/lib/audit";

export async function GET (req: NextRequest) {
  try {
    const authCheck = await requireAnyPermission(["admin.master_data.view"]);
    if (!authCheck.authorized) {
      return authCheck.response;
    }

    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const activeOnly = searchParams.get("activeOnly") === "true";

    const where = {};
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
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authCheck = await requireAuthAndPermission("admin.master_data.manage");
    if (!authCheck.authorized) {
      return authCheck.response;
    }

    const currentUser = await db.user.findUnique({
      where: { email: session.user.email },
    });

    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await req.json();
    const { category, code, name, description, attributes, sortOrder, isActive } = body;

    if (!category || !code || !name) {
      return NextResponse.json({ error: "Kategori, kode, dan nama wajib diisi" }, { status: 400 });
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

    const item = await db.masterItem.create({
      data: {
        organizationId: currentUser.organizationId,
        category,
        code: code.trim().toUpperCase(),
        name,
        description: description || null,
        attributes: attributes || null,
        sortOrder: Number(sortOrder) || 0,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
      },
    });

    const clientInfo = extractClientInfo(req);
    await logAudit({
      organizationId: currentUser.organizationId,
      userId: currentUser.id,
      action: "CREATE",
      entityType: "MASTER_DATA",
      entityId: item.id,
      newValues: item,
      ipAddress: clientInfo.ipAddress,
      userAgent: clientInfo.userAgent,
      notes: `Menambahkan Master Data [${item.category}]: ${item.code} - ${item.name}`,
    });

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/master-data error:", error);
    return NextResponse.json({ error: "Failed to create master item" }, { status: 500 });
  }
}
