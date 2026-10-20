import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { requireAuthAndPermission } from "@/lib/permissions";
import { buildAuditLogData, extractClientInfo } from "@/lib/audit";
import { hashPassword, validatePasswordPolicy } from "@/lib/password";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authCheck = await requireAuthAndPermission("admin.user.view");
    if (!authCheck.authorized) {
      return authCheck.response;
    }

    const currentUser = await db.user.findUnique({
      where: { email: session.user.email },
    });

    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const users = await db.user.findMany({
      where: { organizationId: currentUser.organizationId },
      include: {
        branch: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        userRoles: {
          include: {
            role: { select: { id: true, name: true, code: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error("GET /api/users error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST (req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authCheck = await requireAuthAndPermission("admin.user.create");
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
    const { email, fullName, password, phone, employeeNumber, branchId, departmentId, roleIds } = body;

    if (!email || !fullName || !password) {
      return NextResponse.json({ error: "Email, nama lengkap, dan password wajib diisi" }, { status: 400 });
    }

    // Tahap 1A (P0.1): sandi wajib memenuhi kebijakan dan selalu disimpan sebagai hash bcrypt.
    const policy = validatePasswordPolicy(password, { email });
    if (!policy.ok) {
      return NextResponse.json({ error: policy.message }, { status: 400 });
    }
    const passwordHash = await hashPassword(password);

    const clientInfo = extractClientInfo(req);
    const user = await db.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          organizationId: currentUser.organizationId,
          email,
          fullName,
          passwordHash,
          passwordChangedAt: new Date(),
          phone: phone || null,
          employeeNumber: employeeNumber || null,
          branchId: branchId || null,
          departmentId: departmentId || null,
          isActive: true,
          userRoles: {
            create: (roleIds || []).map((roleId: string) => ({
              roleId,
            })),
          },
        },
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

      await tx.auditLog.create({
        data: buildAuditLogData({
          organizationId: currentUser.organizationId,
          userId: currentUser.id,
          action: "CREATE",
          entityType: "USER",
          entityId: created.id,
          newValues: { email, fullName, phone, employeeNumber, branchId, departmentId, roleIds },
          ipAddress: clientInfo.ipAddress,
          userAgent: clientInfo.userAgent,
          notes: `Menambahkan pengguna: ${fullName} (${email})`,
        }),
      });

      return created;
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    console.error("POST /api/users error:", error);
    if ((error as { code?: string })?.code === "P2002") {
      return NextResponse.json({ error: "Email sudah terdaftar" }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
