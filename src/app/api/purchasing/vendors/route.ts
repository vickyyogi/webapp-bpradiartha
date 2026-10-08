import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { requireAuthAndPermission } from "@/lib/permissions";

export async function GET (req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authCheck = await requireAuthAndPermission("vendor.view");
    if (!authCheck.authorized) {
      return authCheck.response;
    }

    const currentUser = await db.user.findUnique({
      where: { email: session.user.email },
    });

    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search");
    const category = searchParams.get("category");

    const whereClause = {
      organizationId: currentUser.organizationId,
      isActive: true,
    };

    if (category && category !== "ALL") {
      whereClause.category = category;
    }

    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { code: { contains: search, mode: "insensitive" } },
        { contactPerson: { contains: search, mode: "insensitive" } },
      ];
    }

    const vendors = await db.vendor.findMany({
      where: whereClause,
      include: {
        _count: { select: { purchaseOrders: true } },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ vendors });
  } catch (error) {
    console.error("GET /api/purchasing/vendors error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST (req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authCheck = await requireAuthAndPermission("vendor.create");
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
    const { code, name, category, contactPerson, phone, email, address, bankName, bankAccount, bankHolder } = body;

    if (!name || !category) {
      return NextResponse.json({ error: "Nama rekanan/vendor dan kategori wajib diisi." }, { status: 400 });
    }

    let finalCode = code;
    if (!finalCode) {
      const count = await db.vendor.count({
        where: { organizationId: currentUser.organizationId },
      });
      finalCode = `VND-${String(count + 1).padStart(3, "0")}`;
    }

    const vendor = await db.vendor.create({
      data: {
        organizationId: currentUser.organizationId,
        code: finalCode,
        name,
        category,
        contactPerson: contactPerson || null,
        phone: phone || null,
        email: email || null,
        address: address || null,
        bankName: bankName || null,
        bankAccount: bankAccount || null,
        bankHolder: bankHolder || null,
      },
    });

    return NextResponse.json({
      message: `Vendor ${vendor.name} berhasil didaftarkan.`,
      vendor,
    });
  } catch (error) {
    console.error("POST /api/purchasing/vendors error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
