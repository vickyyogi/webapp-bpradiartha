import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { requireAuthAndPermission } from "@/lib/permissions";
import { LeadStatus } from "@prisma/client";

export async function GET (req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authCheck = await requireAuthAndPermission("crm.lead.view");
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
    const status = searchParams.get("status");
    const search = searchParams.get("search");

    const whereClause = {
      organizationId: currentUser.organizationId,
    };

    if (status && Object.values(LeadStatus).includes(status as LeadStatus)) {
      whereClause.status = status as LeadStatus;
    }

    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
        { productInterest: { contains: search, mode: "insensitive" } },
        { source: { contains: search, mode: "insensitive" } },
      ];
    }

    const leads = await db.lead.findMany({
      where: whereClause,
      include: {
        branch: { select: { id: true, name: true, code: true } },
        assignedOfficer: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: leads });
  } catch (error) {
    console.error("Error fetching leads:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function POST (req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authCheck = await requireAuthAndPermission("crm.lead.create");
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
      phone,
      address,
      source,
      productInterest,
      status,
      assignedOfficerId,
      branchId,
      notes,
    } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { error: "Nama calon nasabah wajib diisi" },
        { status: 400 }
      );
    }

    if (!source || typeof source !== "string" || !source.trim()) {
      return NextResponse.json(
        { error: "Sumber prospek (lead source) wajib dipilih" },
        { status: 400 }
      );
    }

    const validatedStatus =
      status && Object.values(LeadStatus).includes(status as LeadStatus)
        ? (status as LeadStatus)
        : LeadStatus.NEW;

    const lead = await db.lead.create({
      data: {
        organizationId: currentUser.organizationId,
        branchId: branchId || currentUser.branchId,
        name: name.trim(),
        phone: phone?.trim() || null,
        address: address?.trim() || null,
        source: source.trim(),
        productInterest: productInterest?.trim() || null,
        status: validatedStatus,
        assignedOfficerId: assignedOfficerId || null,
        notes: notes?.trim() || null,
      },
      include: {
        branch: { select: { id: true, name: true } },
        assignedOfficer: { select: { id: true, fullName: true } },
      },
    });

    return NextResponse.json({ success: true, data: lead }, { status: 201 });
  } catch (error) {
    console.error("Error creating lead:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
