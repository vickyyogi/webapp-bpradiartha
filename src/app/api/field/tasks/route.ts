import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { requireAuthAndPermission } from "@/lib/permissions";
import { FieldTaskPriority, FieldTaskStatus, FieldTaskType } from "@prisma/client";

export async function GET (req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authCheck = await requireAuthAndPermission("field.task.view");
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
    const taskType = searchParams.get("taskType");
    const officerId = searchParams.get("officerId");
    const search = searchParams.get("search");

    const whereClause = {
      organizationId: currentUser.organizationId,
    };

    if (status && Object.values(FieldTaskStatus).includes(status as FieldTaskStatus)) {
      whereClause.status = status as FieldTaskStatus;
    }

    if (taskType && Object.values(FieldTaskType).includes(taskType as FieldTaskType)) {
      whereClause.taskType = taskType as FieldTaskType;
    }

    if (officerId) {
      whereClause.assignedOfficerId = officerId;
    }

    if (search) {
      whereClause.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { customerName: { contains: search, mode: "insensitive" } },
        { customerAddress: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    const tasks = await db.fieldTask.findMany({
      where: whereClause,
      include: {
        assignedOfficer: { select: { id: true, fullName: true, email: true, phone: true } },
        branch: { select: { id: true, name: true, code: true } },
        creditApplication: { select: { id: true, applicationNumber: true, status: true, requestedAmount: true } },
        lead: { select: { id: true, name: true, phone: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: tasks });
  } catch (error) {
    console.error("Error fetching field tasks:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST (req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authCheck = await requireAuthAndPermission("field.task.create");
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
      description,
      taskType,
      priority,
      assignedOfficerId,
      branchId,
      customerName,
      customerPhone,
      customerAddress,
      dueDate,
      creditApplicationId,
      leadId,
    } = body;

    const newTask = await db.fieldTask.create({
      data: {
        organizationId: currentUser.organizationId,
        branchId: branchId || currentUser.branchId,
        assignedOfficerId: assignedOfficerId || currentUser.id,
        taskType: taskType || FieldTaskType.SURVEY,
        priority: priority || FieldTaskPriority.MEDIUM,
        status: FieldTaskStatus.PENDING,
        title,
        description,
        customerName,
        customerPhone,
        customerAddress,
        dueDate: dueDate ? new Date(dueDate) : null,
        creditApplicationId: creditApplicationId || null,
        leadId: leadId || null,
      },
      include: {
        assignedOfficer: { select: { id: true, fullName: true, email: true } },
        branch: { select: { id: true, name: true, code: true } },
      },
    });

    return NextResponse.json({ success: true, data: newTask }, { status: 201 });
  } catch (error) {
    console.error("Error creating field task:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
