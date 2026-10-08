import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { requireAuthAndPermission } from "@/lib/permissions";
import { logAudit, extractClientInfo } from "@/lib/audit";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function GET (req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const activeOnly = searchParams.get("activeOnly") === "true";
    const category = searchParams.get("category");

    const where = {};
    if (activeOnly) {
      where.isActive = true;
    }
    if (category && category !== "ALL") {
      where.category = category;
    }

    const products = await db.cmsProduct.findMany({
      where,
      orderBy: [
        { sortOrder: "asc" },
        { createdAt: "asc" },
      ],
    });

    return NextResponse.json(products);
  } catch (error) {
    console.error("GET /api/cms/products error:", error);
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 });
  }
}

export async function POST (req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authCheck = await requireAuthAndPermission("cms.media.manage");
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
    const {
      name,
      category,
      description,
      features,
      icon,
      badge,
      ctaText,
      ctaLink,
      sortOrder,
      isActive,
    } = body;

    if (!name || !description) {
      return NextResponse.json(
        { error: "Nama produk dan deskripsi wajib diisi" },
        { status: 400 }
      );
    }

    let slug = body.slug ? slugify(body.slug) : slugify(name);
    if (!slug) {
      slug = `product-${Date.now()}`;
    }

    // Ensure slug uniqueness within organization
    const existing = await db.cmsProduct.findFirst({
      where: { organizationId: currentUser.organizationId, slug },
    });
    if (existing) {
      slug = `${slug}-${Math.floor(Math.random() * 1000)}`;
    }

    // Format features as JSON string
    let formattedFeatures = "[]";
    if (Array.isArray(features)) {
      formattedFeatures = JSON.stringify(features);
    } else if (typeof features === "string") {
      try {
        JSON.parse(features);
        formattedFeatures = features;
      } catch {
        // If it's a newline-separated string
        const lines = features.split("\n").map((l: string) => l.trim()).filter(Boolean);
        formattedFeatures = JSON.stringify(lines);
      }
    }

    const product = await db.cmsProduct.create({
      data: {
        organizationId: currentUser.organizationId,
        name,
        slug,
        category: category || "KREDIT",
        description,
        features: formattedFeatures,
        icon: icon || "Briefcase",
        badge: badge || null,
        ctaText: ctaText || "Ajukan Sekarang",
        ctaLink: ctaLink || "#form-pengajuan",
        sortOrder: Number(sortOrder) || 0,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
        isDefault: false,
      },
    });

    const clientInfo = extractClientInfo(req);
    await logAudit({
      organizationId: currentUser.organizationId,
      userId: currentUser.id,
      action: "CREATE",
      entityType: "CMS_PRODUCT",
      entityId: product.id,
      newValues: product,
      ipAddress: clientInfo.ipAddress,
      userAgent: clientInfo.userAgent,
      notes: `Menambahkan produk & layanan CMS: "${product.name}"`,
    });

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    console.error("POST /api/cms/products error:", error);
    return NextResponse.json({ error: "Failed to create product" }, { status: 500 });
  }
}
