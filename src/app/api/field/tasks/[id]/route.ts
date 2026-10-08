import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { requireAuthAndPermission, requireAnyPermission } from "@/lib/permissions";
import { FieldTaskPriority, FieldTaskStatus, FieldTaskType } from "@prisma/client";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authCheck = await requireAnyPermission(["credit.survey.view", "field.task.view"]);
    if (!authCheck.authorized) {
      return authCheck.response;
    }

    const { id } = await params;
    const task = await db.fieldTask.findUnique({
      where: { id },
      include: {
        assignedOfficer: { select: { id: true, fullName: true, email: true, phone: true } },
        branch: { select: { id: true, name: true, code: true } },
        creditApplication: { select: { id: true, applicationNumber: true, status: true, requestedAmount: true } },
        lead: { select: { id: true, name: true, phone: true } },
      },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: task });
  } catch (error) {
    console.error("Error fetching field task detail:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
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

    const authCheck = await requireAuthAndPermission("field.task.update");
    if (!authCheck.authorized) {
      return authCheck.response;
    }

    const { id } = await params;
    const body = await req.json();
    const {
      title,
      description,
      taskType,
      priority,
      status,
      assignedOfficerId,
      customerName,
      customerPhone,
      customerAddress,
      dueDate,
      resultNotes,
    } = body;

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (taskType !== undefined && Object.values(FieldTaskType).includes(taskType as FieldTaskType)) {
      updateData.taskType = taskType as FieldTaskType;
    }
    if (priority !== undefined && Object.values(FieldTaskPriority).includes(priority as FieldTaskPriority)) {
      updateData.priority = priority as FieldTaskPriority;
    }
    if (assignedOfficerId !== undefined) updateData.assignedOfficerId = assignedOfficerId;
    if (customerName !== undefined) updateData.customerName = customerName;
    if (customerPhone !== undefined) updateData.customerPhone = customerPhone;
    if (customerAddress !== undefined) updateData.customerAddress = customerAddress;
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;
    if (resultNotes !== undefined) updateData.resultNotes = resultNotes;

    if (status !== undefined && Object.values(FieldTaskStatus).includes(status as FieldTaskStatus)) {
      updateData.status = status as FieldTaskStatus;
      if (status === "COMPLETED") {
        updateData.completedAt = new Date();
      }
    }

    const updated = await db.fieldTask.update({
      where: { id },
      data: updateData,
      include: {
        assignedOfficer: { select: { id: true, fullName: true, email: true } },
        branch: { select: { id: true, name: true, code: true } },
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("Error updating field task:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authCheck = await requireAnyPermission(["field.task.update"]);
    if (!authCheck.authorized) {
      return authCheck.response;
    }

    const { id } = await params;
    await db.fieldTask.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: "Task deleted successfully" });
  } catch (error) {
    console.error("Error deleting field task:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
