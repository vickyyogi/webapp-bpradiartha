import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";

export async function GET (_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const currentUser = await db.user.findUnique({
      where: { email: session.user.email },
    });

    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const [branches, departments, roles] = await Promise.all([
      db.branch.findMany({
        where: { organizationId: currentUser.organizationId },
        select: { id: true, name: true, code: true },
        orderBy: { name: "asc" },
      }),
      db.department.findMany({
        where: { organizationId: currentUser.organizationId },
        select: { id: true, name: true, code: true },
        orderBy: { name: "asc" },
      }),
      db.role.findMany({
        select: { id: true, name: true, code: true },
        orderBy: { name: "asc" },
      }),
    ]);

    return NextResponse.json({ branches, departments, roles });
  } catch (error) {
    console.error("GET /api/admin/options error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
