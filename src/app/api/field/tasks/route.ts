import { NextRequest, NextResponse } from "next/server";
import { Prisma, FieldTaskPriority, FieldTaskStatus, FieldTaskType } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuthAndPermission } from "@/lib/permissions";
import { buildScopeFilter, isBranchAllowed, toScopeUser } from "@/lib/access-scope";

const FIELD_ASSIGNMENT_FIELDS = ["assignedOfficerId"];

async function ensureAssignable(
  organizationId: string,
  branchAllowed: (branchId?: string | null) => boolean,
  assigneeId: string | null | undefined
): Promise<string | null> {
  if (!assigneeId) return null;
  const assignee = await db.user.findFirst({
    where: { id: assigneeId, organizationId, isActive: true },
    select: { id: true, branchId: true },
  });
  if (!assignee) return "Petugas yang ditugaskan tidak ditemukan pada organisasi Anda.";
  if (!branchAllowed(assignee.branchId)) return "Petugas yang ditugaskan berada di luar cabang Anda.";
  return null;
}

export async function GET (req: NextRequest) {
  try {
    const authCheck = await requireAuthAndPermission("field.task.view");
    if (!authCheck.authorized) {
      return authCheck.response;
    }
    const scopeUser = toScopeUser(authCheck.user!);

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const taskType = searchParams.get("taskType");
    const officerId = searchParams.get("officerId");
    const search = searchParams.get("search");

    const whereClause: Prisma.FieldTaskWhereInput = {
      ...(buildScopeFilter(scopeUser, { assignmentFields: FIELD_ASSIGNMENT_FIELDS }) as Prisma.FieldTaskWhereInput),
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
    const authCheck = await requireAuthAndPermission("field.task.create");
    if (!authCheck.authorized) {
      return authCheck.response;
    }
    const currentUser = authCheck.user!;
    const scopeUser = toScopeUser(currentUser);

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

    if (branchId && !isBranchAllowed(scopeUser, branchId)) {
      return NextResponse.json(
        { error: "Anda tidak berwenang membuat tugas pada cabang tersebut.", code: "BRANCH_FORBIDDEN" },
        { status: 403 }
      );
    }

    const assigneeErr = await ensureAssignable(currentUser.organizationId, (b) => isBranchAllowed(scopeUser, b), assignedOfficerId);
    if (assigneeErr) {
      return NextResponse.json({ error: assigneeErr, code: "ASSIGNEE_FORBIDDEN" }, { status: 403 });
    }

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
