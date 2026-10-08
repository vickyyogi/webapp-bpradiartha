import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { requireAuthAndPermission } from "@/lib/permissions";
import { logAudit, extractClientInfo } from "@/lib/audit";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const slide = await db.cmsHeroSlide.findUnique({ where: { id } });
    if (!slide) {
      return NextResponse.json({ error: "Gambar hero tidak ditemukan" }, { status: 404 });
    }
    return NextResponse.json(slide);
  } catch (error) {
    console.error("GET /api/cms/hero-slides/[id] error:", error);
    return NextResponse.json({ error: "Failed to fetch hero slide" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authCheck = await requireAuthAndPermission("cms.media.manage");
    if (!authCheck.authorized) {
      return authCheck.response;
    }

    const currentUser = await db.user.findUnique({ where: { email: session.user.email } });
    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { id } = await params;
    const existing = await db.cmsHeroSlide.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Gambar hero tidak ditemukan" }, { status: 404 });
    }

    const body = await req.json();
    const updated = await db.cmsHeroSlide.update({
      where: { id },
      data: {
        title: body.title !== undefined ? body.title : existing.title,
        altText: body.altText !== undefined ? body.altText : existing.altText,
        imageUrl: body.imageUrl !== undefined ? body.imageUrl : existing.imageUrl,
        sortOrder: body.sortOrder !== undefined ? Number(body.sortOrder) : existing.sortOrder,
        isActive: body.isActive !== undefined ? Boolean(body.isActive) : existing.isActive,
      },
    });

    const clientInfo = extractClientInfo(req);
    await logAudit({
      organizationId: currentUser.organizationId,
      userId: currentUser.id,
      action: "UPDATE",
      entityType: "CMS_HERO_SLIDE",
      entityId: id,
      oldValues: existing,
      newValues: updated,
      ipAddress: clientInfo.ipAddress,
      userAgent: clientInfo.userAgent,
      notes: `Memperbarui gambar hero: "${updated.title || updated.imageUrl}"`,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PUT /api/cms/hero-slides/[id] error:", error);
    return NextResponse.json({ error: "Failed to update hero slide" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authCheck = await requireAuthAndPermission("cms.media.manage");
    if (!authCheck.authorized) {
      return authCheck.response;
    }

    const currentUser = await db.user.findUnique({ where: { email: session.user.email } });
    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { id } = await params;
    const existing = await db.cmsHeroSlide.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Gambar hero tidak ditemukan" }, { status: 404 });
    }

    await db.cmsHeroSlide.delete({ where: { id } });

    const clientInfo = extractClientInfo(req);
    await logAudit({
      organizationId: currentUser.organizationId,
      userId: currentUser.id,
      action: "DELETE",
      entityType: "CMS_HERO_SLIDE",
      entityId: id,
      oldValues: existing,
      ipAddress: clientInfo.ipAddress,
      userAgent: clientInfo.userAgent,
      notes: `Menghapus gambar hero: "${existing.title || existing.imageUrl}"`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/cms/hero-slides/[id] error:", error);
    return NextResponse.json({ error: "Failed to delete hero slide" }, { status: 500 });
  }
}
