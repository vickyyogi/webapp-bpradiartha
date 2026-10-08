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

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rawId } = await params;
    const id = decodeURIComponent(rawId).trim();

    let report = null;

    if (UUID_REGEX.test(id)) {
      report = await db.cmsReport.findUnique({
        where: { id },
      });
    }

    if (!report) {
      report = await db.cmsReport.findFirst({
        where: {
          OR: [
            { slug: id },
            { slug: id.toLowerCase() },
            { fileName: id },
            { title: { equals: id, mode: "insensitive" } },
            { title: { contains: id.replace(/-/g, " "), mode: "insensitive" } },
          ],
        },
      });
    }

    if (!report) {
      return NextResponse.json({ error: "Laporan tidak ditemukan" }, { status: 404 });
    }

    return NextResponse.json(report);
  } catch (error) {
    console.error("GET /api/cms/reports/[id] error:", error);
    return NextResponse.json({ error: "Failed to fetch report" }, { status: 500 });
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

    const currentUser = await db.user.findUnique({
      where: { email: session.user.email },
    });

    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { id: rawId } = await params;
    const id = decodeURIComponent(rawId).trim();

    const existing = UUID_REGEX.test(id)
      ? await db.cmsReport.findUnique({ where: { id } })
      : await db.cmsReport.findFirst({ where: { slug: id } });

    if (!existing) {
      return NextResponse.json({ error: "Laporan tidak ditemukan" }, { status: 404 });
    }

    const body = await req.json();

    let newSlug = existing.slug;
    if (body.title && body.title !== existing.title && !body.slug) {
      newSlug = slugify(body.title);
    } else if (body.slug) {
      newSlug = slugify(body.slug);
    }

    const updated = await db.cmsReport.update({
      where: { id: existing.id },
      data: {
        title: body.title !== undefined ? body.title : existing.title,
        slug: newSlug,
        category: body.category !== undefined ? body.category : existing.category,
        period: body.period !== undefined ? body.period : existing.period,
        year: body.year !== undefined ? (body.year ? Number(body.year) : null) : existing.year,
        description: body.description !== undefined ? body.description : existing.description,
        fileUrl: body.fileUrl !== undefined ? body.fileUrl : existing.fileUrl,
        fileName: body.fileName !== undefined ? body.fileName : existing.fileName,
        fileSize: body.fileSize !== undefined ? (body.fileSize ? Number(body.fileSize) : null) : existing.fileSize,
        isActive: body.isActive !== undefined ? Boolean(body.isActive) : existing.isActive,
        sortOrder: body.sortOrder !== undefined ? Number(body.sortOrder) : existing.sortOrder,
        publishedAt: body.publishedAt ? new Date(body.publishedAt) : existing.publishedAt,
      },
    });

    const clientInfo = extractClientInfo(req);
    await logAudit({
      organizationId: currentUser.organizationId,
      userId: currentUser.id,
      action: "UPDATE",
      entityType: "CMS_REPORT",
      entityId: existing.id,
      oldValues: existing,
      newValues: updated,
      ipAddress: clientInfo.ipAddress,
      userAgent: clientInfo.userAgent,
      notes: `Memperbarui Laporan Publikasi: "${updated.title}"`,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PUT /api/cms/reports/[id] error:", error);
    return NextResponse.json({ error: "Gagal memperbarui laporan" }, { status: 500 });
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

    const currentUser = await db.user.findUnique({
      where: { email: session.user.email },
    });

    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { id: rawId } = await params;
    const id = decodeURIComponent(rawId).trim();

    const existing = UUID_REGEX.test(id)
      ? await db.cmsReport.findUnique({ where: { id } })
      : await db.cmsReport.findFirst({ where: { slug: id } });

    if (!existing) {
      return NextResponse.json({ error: "Laporan tidak ditemukan" }, { status: 404 });
    }

    await db.cmsReport.delete({ where: { id: existing.id } });

    const clientInfo = extractClientInfo(req);
    await logAudit({
      organizationId: currentUser.organizationId,
      userId: currentUser.id,
      action: "DELETE",
      entityType: "CMS_REPORT",
      entityId: existing.id,
      oldValues: existing,
      ipAddress: clientInfo.ipAddress,
      userAgent: clientInfo.userAgent,
      notes: `Menghapus Laporan Publikasi: "${existing.title}"`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/cms/reports/[id] error:", error);
    return NextResponse.json({ error: "Gagal menghapus laporan" }, { status: 500 });
  }
}
