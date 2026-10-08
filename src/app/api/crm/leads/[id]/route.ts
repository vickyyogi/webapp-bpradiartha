import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { requireAuthAndPermission, requireAnyPermission } from "@/lib/permissions";
import { LeadStatus } from "@prisma/client";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authCheck = await requireAnyPermission(["crm.lead.view"]);
    if (!authCheck.authorized) {
      return authCheck.response;
    }

    const { id } = await params;
    const lead = await db.lead.findUnique({
      where: { id },
      include: {
        branch: { select: { id: true, name: true, code: true } },
        assignedOfficer: { select: { id: true, fullName: true, email: true } },
      },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead tidak ditemukan" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: lead });
  } catch (error) {
    console.error("Error fetching lead detail:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authCheck = await requireAuthAndPermission("crm.lead.update");
    if (!authCheck.authorized) {
      return authCheck.response;
    }

    const { id } = await params;
    const body = await req.json();

    const existingLead = await db.lead.findUnique({ where: { id } });
    if (!existingLead) {
      return NextResponse.json({ error: "Lead tidak ditemukan" }, { status: 404 });
    }

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

    const dataToUpdate = {};
    if (name !== undefined) dataToUpdate.name = name.trim();
    if (phone !== undefined) dataToUpdate.phone = phone ? phone.trim() : null;
    if (address !== undefined) dataToUpdate.address = address ? address.trim() : null;
    if (source !== undefined) dataToUpdate.source = source.trim();
    if (productInterest !== undefined) dataToUpdate.productInterest = productInterest ? productInterest.trim() : null;
    if (status !== undefined && Object.values(LeadStatus).includes(status as LeadStatus)) {
      dataToUpdate.status = status as LeadStatus;
    }
    if (assignedOfficerId !== undefined) {
      dataToUpdate.assignedOfficerId = assignedOfficerId || null;
    }
    if (branchId !== undefined) {
      dataToUpdate.branchId = branchId || null;
    }
    if (notes !== undefined) dataToUpdate.notes = notes ? notes.trim() : null;

    const updatedLead = await db.lead.update({
      where: { id },
      data: dataToUpdate,
      include: {
        branch: { select: { id: true, name: true } },
        assignedOfficer: { select: { id: true, fullName: true } },
      },
    });

    return NextResponse.json({ success: true, data: updatedLead });
  } catch (error) {
    console.error("Error updating lead:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authCheck = await requireAuthAndPermission("crm.lead.delete");
    if (!authCheck.authorized) {
      return authCheck.response;
    }

    const { id } = await params;
    const existingLead = await db.lead.findUnique({ where: { id } });
    if (!existingLead) {
      return NextResponse.json({ error: "Lead tidak ditemukan" }, { status: 404 });
    }

    await db.lead.delete({ where: { id } });

    return NextResponse.json({ success: true, message: "Lead berhasil dihapus" });
  } catch (error) {
    console.error("Error deleting lead:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
