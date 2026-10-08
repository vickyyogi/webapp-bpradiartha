import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { requireAuthAndPermission } from "@/lib/permissions";
import { logAudit, extractClientInfo } from "@/lib/audit";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const activeOnly = searchParams.get("activeOnly") === "true";
    const limit = Math.min(50, Number(searchParams.get("limit")) || 20);

    const where: { isActive?: boolean } = {};
    if (activeOnly) where.isActive = true;

    const slides = await db.cmsHeroSlide.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      take: limit,
    });

    return NextResponse.json(slides);
  } catch (error) {
    console.error("GET /api/cms/hero-slides error:", error);
    return NextResponse.json({ error: "Failed to fetch hero slides" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
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
    const { title, altText, imageUrl, sortOrder, isActive } = body;

    if (!imageUrl) {
      return NextResponse.json({ error: "Gambar wajib diunggah terlebih dahulu" }, { status: 400 });
    }

    const slide = await db.cmsHeroSlide.create({
      data: {
        organizationId: currentUser.organizationId,
        title: title || null,
        altText: altText || null,
        imageUrl,
        sortOrder: Number(sortOrder) || 0,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
      },
    });

    const clientInfo = extractClientInfo(req);
    await logAudit({
      organizationId: currentUser.organizationId,
      userId: currentUser.id,
      action: "CREATE",
      entityType: "CMS_HERO_SLIDE",
      entityId: slide.id,
      newValues: slide,
      ipAddress: clientInfo.ipAddress,
      userAgent: clientInfo.userAgent,
      notes: `Menambahkan gambar hero: "${slide.title || slide.imageUrl}"`,
    });

    return NextResponse.json(slide, { status: 201 });
  } catch (error) {
    console.error("POST /api/cms/hero-slides error:", error);
    return NextResponse.json({ error: "Failed to create hero slide" }, { status: 500 });
  }
}
