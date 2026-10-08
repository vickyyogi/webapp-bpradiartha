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

    const where = {};
    if (category && category !== "ALL") {
      where.category = category;
    }
    if (activeOnly) {
      where.isActive = true;
    }

    const faqs = await db.cmsFaq.findMany({
      where,
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json(faqs);
  } catch (error) {
    console.error("GET /api/cms/faqs error:", error);
    return NextResponse.json({ error: "Failed to fetch FAQs" }, { status: 500 });
  }
}

export async function POST (req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authCheck = await requireAuthAndPermission("cms.faq.manage");
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
    const { category, question, answer, sortOrder, isActive } = body;

    if (!question || !answer) {
      return NextResponse.json({ error: "Pertanyaan dan jawaban wajib diisi" }, { status: 400 });
    }

    const faq = await db.cmsFaq.create({
      data: {
        organizationId: currentUser.organizationId,
        category: category || "UMUM",
        question,
        answer,
        sortOrder: Number(sortOrder) || 0,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
      },
    });

    const clientInfo = extractClientInfo(req);
    await logAudit({
      organizationId: currentUser.organizationId,
      userId: currentUser.id,
      action: "CREATE",
      entityType: "CMS_FAQ",
      entityId: faq.id,
      newValues: faq,
      ipAddress: clientInfo.ipAddress,
      userAgent: clientInfo.userAgent,
      notes: `Menambahkan FAQ: "${faq.question}"`,
    });

    return NextResponse.json(faq, { status: 201 });
  } catch (error) {
    console.error("POST /api/cms/faqs error:", error);
    return NextResponse.json({ error: "Failed to create FAQ" }, { status: 500 });
  }
}
