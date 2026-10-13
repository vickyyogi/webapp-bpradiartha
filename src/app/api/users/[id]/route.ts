import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { requireAuthAndPermission } from "@/lib/permissions";
import { logAudit, extractClientInfo } from "@/lib/audit";
import { hashPassword, validatePasswordPolicy } from "@/lib/password";

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

    // Tahap 1A (P0.1): bila sandi diubah, ia wajib memenuhi kebijakan, disimpan sebagai
    // hash bcrypt, dan waktu perubahan dicatat agar sesi lama dicabut (lihat callback jwt).
    if (password) {
      const policy = validatePasswordPolicy(password, { email: email ?? undefined });
      if (!policy.ok) {
        return NextResponse.json({ error: policy.message }, { status: 400 });
      }
    }

    const existing = await db.user.findFirst({
      where: { id, organizationId: currentUser.organizationId },
      include: { userRoles: { select: { roleId: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Pengguna tidak ditemukan." }, { status: 404 });
    }

    // Mutasi pegawai / perubahan role / penonaktifan → cabut sesi lama segera.
    const roleChanged =
      roleIds !== undefined &&
      (() => {
        const before = new Set(existing.userRoles.map((ur) => ur.roleId));
        const after = new Set<string>(roleIds);
        return before.size !== after.size || [...before].some((r) => !after.has(r));
      })();
    const branchChanged = branchId !== undefined && (branchId || null) !== existing.branchId;
    const deactivated = isActive === false && existing.isActive;
    const revokeSessions = roleChanged || branchChanged || deactivated;

    const dataToUpdate = {
      email,
      fullName,
      phone: phone || null,
      employeeNumber: employeeNumber || null,
      branchId: branchId || null,
      departmentId: departmentId || null,
      isActive,
      ...(revokeSessions ? { sessionsValidFrom: new Date() } : {}),
      ...(password
        ? { passwordHash: await hashPassword(password), passwordChangedAt: new Date() }
        : {}),
    };

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
