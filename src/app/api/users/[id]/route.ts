import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { requireAuthAndPermission } from "@/lib/permissions";
import { logAudit, extractClientInfo } from "@/lib/audit";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authCheck = await requireAuthAndPermission("admin.user.update");
    if (!authCheck.authorized) {
      return authCheck.response;
    }

    const currentUser = await db.user.findUnique({
      where: { email: session.user.email },
    });

    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { id } = await params;
    const body = await req.json();
    const { email, fullName, password, phone, employeeNumber, branchId, departmentId, isActive, roleIds } = body;

    const dataToUpdate = {
      email,
      fullName,
      phone: phone || null,
      employeeNumber: employeeNumber || null,
      branchId: branchId || null,
      departmentId: departmentId || null,
      isActive,
    };

    if (password) {
      // In production, implement proper password hashing!
      dataToUpdate.passwordHash = password;
    }

    const user = await db.$transaction(async (tx) => {
      if (roleIds !== undefined) {
        await tx.userRole.deleteMany({
          where: { userId: id },
        });

        if (roleIds.length > 0) {
          await tx.userRole.createMany({
            data: roleIds.map((roleId: string) => ({
              userId: id,
              roleId,
            })),
          });
        }
      }

      return await tx.user.update({
        where: { id, organizationId: currentUser.organizationId },
        data: dataToUpdate,
        include: {
          branch: { select: { id: true, name: true } },
          department: { select: { id: true, name: true } },
          userRoles: {
            include: {
              role: { select: { id: true, name: true, code: true } },
            },
          },
        },
      });
    });

    const clientInfo = extractClientInfo(req);
    await logAudit({
      organizationId: currentUser.organizationId,
      userId: currentUser.id,
      action: "UPDATE",
      entityType: "USER",
      entityId: user.id,
      newValues: { email, fullName, phone, employeeNumber, branchId, departmentId, isActive, roleIds },
      ipAddress: clientInfo.ipAddress,
      userAgent: clientInfo.userAgent,
      notes: `Mengubah data pengguna: ${fullName} (${email})`,
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error("PUT /api/users/[id] error:", error);
    if (error.code === "P2002") {
      return NextResponse.json({ error: "Email sudah terdaftar" }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
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

    const authCheck = await requireAuthAndPermission("admin.user.disable");
    if (!authCheck.authorized) {
      return authCheck.response;
    }

    const currentUser = await db.user.findUnique({
      where: { email: session.user.email },
    });

    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { id } = await params;

    const user = await db.user.update({
      where: { id, organizationId: currentUser.organizationId },
      data: { isActive: false },
    });

    const clientInfo = extractClientInfo(req);
    await logAudit({
      organizationId: currentUser.organizationId,
      userId: currentUser.id,
      action: "DELETE",
      entityType: "USER",
      entityId: user.id,
      ipAddress: clientInfo.ipAddress,
      userAgent: clientInfo.userAgent,
      notes: `Menonaktifkan pengguna: ${user.fullName} (${user.email})`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/users/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
