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

    const authCheck = await requireAuthAndPermission("admin.role.update");
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
    const { name, description, permissionIds } = body;

    const existingRole = await db.role.findUnique({ where: { id } });
    if (!existingRole) {
      return NextResponse.json({ error: "Peran tidak ditemukan" }, { status: 404 });
    }

    // Delete existing permissions then recreate
    await db.rolePermission.deleteMany({
      where: { roleId: id },
    });

    const updatedRole = await db.role.update({
      where: { id },
      data: {
        name,
        description: description || null,
        permissions: {
          create: Array.isArray(permissionIds)
            ? permissionIds.map((permId: string) => ({
                permissionId: permId,
              }))
            : [],
        },
      },
      include: {
        permissions: {
          include: { permission: true },
        },
      },
    });

    const clientInfo = extractClientInfo(req);
    await logAudit({
      organizationId: currentUser.organizationId,
      userId: currentUser.id,
      action: "UPDATE",
      entityType: "ROLE",
      entityId: id,
      oldValues: { name: existingRole.name, description: existingRole.description },
      newValues: { name, description, permissionIds },
      ipAddress: clientInfo.ipAddress,
      userAgent: clientInfo.userAgent,
      notes: `Mengubah peran: ${existingRole.code}`,
    });

    return NextResponse.json(updatedRole);
  } catch (error) {
    console.error("PUT /api/admin/roles/[id] error:", error);
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

    const authCheck = await requireAuthAndPermission("admin.role.update");
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

    const existingRole = await db.role.findUnique({
      where: { id },
      include: {
        _count: {
          select: { users: true },
        },
      },
    });

    if (!existingRole) {
      return NextResponse.json({ error: "Peran tidak ditemukan" }, { status: 404 });
    }

    if (existingRole.isSystem) {
      return NextResponse.json({ error: "Peran sistem tidak dapat dihapus" }, { status: 400 });
    }

    if (existingRole._count.users > 0) {
      return NextResponse.json({ error: "Peran masih digunakan oleh pengguna" }, { status: 400 });
    }

    await db.rolePermission.deleteMany({
      where: { roleId: id },
    });

    await db.role.delete({
      where: { id },
    });

    const clientInfo = extractClientInfo(req);
    await logAudit({
      organizationId: currentUser.organizationId,
      userId: currentUser.id,
      action: "DELETE",
      entityType: "ROLE",
      entityId: id,
      oldValues: { code: existingRole.code, name: existingRole.name },
      ipAddress: clientInfo.ipAddress,
      userAgent: clientInfo.userAgent,
      notes: `Menghapus peran: ${existingRole.code}`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/admin/roles/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
