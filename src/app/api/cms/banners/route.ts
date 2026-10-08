import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { requireAuthAndPermission } from "@/lib/permissions";
import { logAudit, extractClientInfo } from "@/lib/audit";

export async function GET (req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const activeOnly = searchParams.get("activeOnly") === "true";

    const where = {};
    if (activeOnly) {
      where.isActive = true;
    }

    const banners = await db.cmsBanner.findMany({
      where,
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json(banners);
  } catch (error) {
    console.error("GET /api/cms/banners error:", error);
    return NextResponse.json({ error: "Failed to fetch banners" }, { status: 500 });
  }
}

export async function POST (req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authCheck = await requireAuthAndPermission("cms.banner.manage");
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
    const { title, subtitle, imageUrl, ctaText, ctaLink, sortOrder, isActive } = body;

    if (!title) {
      return NextResponse.json({ error: "Judul banner wajib diisi" }, { status: 400 });
    }

    const banner = await db.cmsBanner.create({
      data: {
        organizationId: currentUser.organizationId,
        title,
        subtitle: subtitle || null,
        imageUrl: imageUrl || null,
        ctaText: ctaText || null,
        ctaLink: ctaLink || null,
        sortOrder: Number(sortOrder) || 0,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
      },
    });

    const clientInfo = extractClientInfo(req);
    await logAudit({
      organizationId: currentUser.organizationId,
      userId: currentUser.id,
      action: "CREATE",
      entityType: "CMS_BANNER",
      entityId: banner.id,
      newValues: banner,
      ipAddress: clientInfo.ipAddress,
      userAgent: clientInfo.userAgent,
      notes: `Membuat banner CMS: "${banner.title}"`,
    });

    return NextResponse.json(banner, { status: 201 });
  } catch (error) {
    console.error("POST /api/cms/banners error:", error);
    return NextResponse.json({ error: "Failed to create banner" }, { status: 500 });
  }
}
