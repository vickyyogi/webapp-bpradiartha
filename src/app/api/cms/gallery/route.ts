import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { requireAuthAndPermission } from "@/lib/permissions";
import { logAudit, extractClientInfo } from "@/lib/audit";

export async function GET (req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const activeOnly = searchParams.get("activeOnly") === "true";
    const limit = Math.min(100, Number(searchParams.get("limit")) || 50);

    const where = {};
    if (activeOnly) {
      where.isActive = true;
    }
    if (category && category !== "ALL") {
      where.category = category;
    }

    const galleries = await db.cmsGallery.findMany({
      where,
      orderBy: [
        { sortOrder: "asc" },
        { eventDate: "desc" },
        { createdAt: "desc" },
      ],
      take: limit,
    });

    return NextResponse.json(galleries);
  } catch (error) {
    console.error("GET /api/cms/gallery error:", error);
    return NextResponse.json({ error: "Failed to fetch gallery items" }, { status: 500 });
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
    const { title, description, imageUrl, category, eventDate, sortOrder, isActive } = body;

    if (!title || !imageUrl) {
      return NextResponse.json(
        { error: "Judul kegiatan dan foto/gambar wajib diisi" },
        { status: 400 }
      );
    }

    const galleryItem = await db.cmsGallery.create({
      data: {
        organizationId: currentUser.organizationId,
        title,
        description: description || null,
        imageUrl,
        category: category || "KEGIATAN",
        eventDate: eventDate ? new Date(eventDate) : new Date(),
        sortOrder: Number(sortOrder) || 0,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
      },
    });

    const clientInfo = extractClientInfo(req);
    await logAudit({
      organizationId: currentUser.organizationId,
      userId: currentUser.id,
      action: "CREATE",
      entityType: "CMS_GALLERY",
      entityId: galleryItem.id,
      newValues: galleryItem,
      ipAddress: clientInfo.ipAddress,
      userAgent: clientInfo.userAgent,
      notes: `Menambahkan foto galeri [${galleryItem.category}]: "${galleryItem.title}"`,
    });

    return NextResponse.json(galleryItem, { status: 201 });
  } catch (error) {
    console.error("POST /api/cms/gallery error:", error);
    return NextResponse.json({ error: "Failed to create gallery item" }, { status: 500 });
  }
}
