import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { requireAuthAndPermission } from "@/lib/permissions";
import { logAudit, extractClientInfo } from "@/lib/audit";

export async function GET (req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authCheck = await requireAuthAndPermission("admin.role.view");
    if (!authCheck.authorized) {
      return authCheck.response;
    }

    const roles = await db.role.findMany({
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(roles);
  } catch (error) {
    console.error("GET /api/admin/roles error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST (req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authCheck = await requireAuthAndPermission("admin.role.create");
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
    const { code, name, description, permissionIds } = body;

    if (!code || !name) {
      return NextResponse.json({ error: "Kode dan nama peran wajib diisi" }, { status: 400 });
    }

    const existingCode = await db.role.findUnique({
      where: { code },
    });

    if (existingCode) {
      return NextResponse.json({ error: "Kode peran sudah digunakan" }, { status: 400 });
    }

    const role = await db.role.create({
      data: {
        code,
        name,
        description: description || null,
        isSystem: false,
        permissions: {
          create: Array.isArray(permissionIds)
            ? permissionIds.map((id: string) => ({
                permissionId: id,
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
      action: "CREATE",
      entityType: "ROLE",
      entityId: role.id,
      newValues: { code, name, description, permissionIds },
      ipAddress: clientInfo.ipAddress,
      userAgent: clientInfo.userAgent,
      notes: `Menambahkan peran: ${code} - ${name}`,
    });

    return NextResponse.json(role, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/roles error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
