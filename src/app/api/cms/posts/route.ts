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
    const category = searchParams.get("category");
    const status = searchParams.get("status");
    const limit = Math.min(100, Number(searchParams.get("limit")) || 20);

    const where = {};
    if (category && category !== "ALL") {
      where.category = category;
    }
    if (status && status !== "ALL") {
      where.status = status;
    }

    const posts = await db.cmsPost.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json(posts);
  } catch (error) {
    console.error("GET /api/cms/posts error:", error);
    return NextResponse.json({ error: "Failed to fetch posts" }, { status: 500 });
  }
}

export async function POST (req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authCheck = await requireAuthAndPermission("cms.post.create");
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
    const { title, category, excerpt, content, featuredImage, status, publishedAt } = body;

    if (!title || !content) {
      return NextResponse.json({ error: "Judul dan konten artikel wajib diisi" }, { status: 400 });
    }

    let slug = body.slug ? slugify(body.slug) : slugify(title);
    if (!slug) {
      slug = `post-${Date.now()}`;
    }

    // Ensure slug uniqueness within organization
    const existing = await db.cmsPost.findFirst({
      where: { organizationId: currentUser.organizationId, slug },
    });
    if (existing) {
      slug = `${slug}-${Math.floor(Math.random() * 1000)}`;
    }

    const post = await db.cmsPost.create({
      data: {
        organizationId: currentUser.organizationId,
        title,
        slug,
        category: category || "BERITA",
        excerpt: excerpt || null,
        content,
        featuredImage: featuredImage || null,
        status: status || "PUBLISHED",
        publishedAt: status === "PUBLISHED" ? (publishedAt ? new Date(publishedAt) : new Date()) : null,
        authorName: currentUser.fullName || "Admin",
      },
    });

    const clientInfo = extractClientInfo(req);
    await logAudit({
      organizationId: currentUser.organizationId,
      userId: currentUser.id,
      action: "CREATE",
      entityType: "CMS_POST",
      entityId: post.id,
      newValues: post,
      ipAddress: clientInfo.ipAddress,
      userAgent: clientInfo.userAgent,
      notes: `Membuat artikel CMS [${post.category}]: "${post.title}"`,
    });

    return NextResponse.json(post, { status: 201 });
  } catch (error) {
    console.error("POST /api/cms/posts error:", error);
    return NextResponse.json({ error: "Failed to create post" }, { status: 500 });
  }
}
