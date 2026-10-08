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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const year = searchParams.get("year");
    const activeOnly = searchParams.get("active");
    const search = searchParams.get("search");
    const limit = Math.min(100, Number(searchParams.get("limit")) || 50);

    const session = await getServerSession(authOptions);

    const where: any = {};

    // If not authenticated or activeOnly=true, only show active
    if (!session?.user?.email || activeOnly === "true") {
      where.isActive = true;
    } else if (activeOnly === "false") {
      where.isActive = false;
    }

    if (category && category !== "ALL") {
      where.category = category;
    }

    if (year && year !== "ALL") {
      where.year = Number(year);
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { period: { contains: search, mode: "insensitive" } },
      ];
    }

    const reports = await db.cmsReport.findMany({
      where,
      orderBy: [
        { sortOrder: "asc" },
        { year: "desc" },
        { publishedAt: "desc" },
        { createdAt: "desc" },
      ],
      take: limit,
    });

    return NextResponse.json(reports);
  } catch (error) {
    console.error("GET /api/cms/reports error:", error);
    return NextResponse.json({ error: "Failed to fetch reports" }, { status: 500 });
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
    const {
      title,
      category = "KEUANGAN",
      period,
      year,
      description,
      fileUrl,
      fileName,
      fileSize,
      isActive = true,
      sortOrder = 0,
      publishedAt,
    } = body;

    if (!title || !fileUrl) {
      return NextResponse.json(
        { error: "Judul laporan dan Berkas PDF wajib diisi" },
        { status: 400 }
      );
    }

    let slug = body.slug ? slugify(body.slug) : slugify(title);
    if (!slug) {
      slug = `laporan-${Date.now()}`;
    }

    // Ensure slug uniqueness within organization
    let uniqueSlug = slug;
    let counter = 1;
    while (
      await db.cmsReport.findUnique({
        where: {
          organizationId_slug: {
            organizationId: currentUser.organizationId,
            slug: uniqueSlug,
          },
        },
      })
    ) {
      uniqueSlug = `${slug}-${counter}`;
      counter++;
    }

    const parsedYear = year ? Number(year) : new Date().getFullYear();
    const parsedPublishedAt = publishedAt ? new Date(publishedAt) : new Date();

    const report = await db.cmsReport.create({
      data: {
        organizationId: currentUser.organizationId,
        title,
        slug: uniqueSlug,
        category,
        period: period || null,
        year: parsedYear,
        description: description || null,
        fileUrl,
        fileName: fileName || null,
        fileSize: fileSize ? Number(fileSize) : null,
        isActive: Boolean(isActive),
        sortOrder: Number(sortOrder) || 0,
        publishedAt: parsedPublishedAt,
      },
    });

    const clientInfo = extractClientInfo(req);
    await logAudit({
      organizationId: currentUser.organizationId,
      userId: currentUser.id,
      action: "CREATE",
      entityType: "CMS_REPORT",
      entityId: report.id,
      newValues: report,
      ipAddress: clientInfo.ipAddress,
      userAgent: clientInfo.userAgent,
      notes: `Membuat Laporan Publikasi Baru: "${report.title}" (${report.category})`,
    });

    return NextResponse.json(report, { status: 201 });
  } catch (error) {
    console.error("POST /api/cms/reports error:", error);
    return NextResponse.json({ error: "Gagal menyimpan laporan" }, { status: 500 });
  }
}
