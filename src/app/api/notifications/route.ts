import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { notificationService } from "@/lib/notifications";

export async function GET (req: NextRequest) {
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

    const { searchParams } = new URL(req.url);
    const limit = Math.min(50, Number(searchParams.get("limit")) || 20);

    const [notifications, unreadCount] = await Promise.all([
      notificationService.getUserNotifications(currentUser.id, limit),
      notificationService.getUnreadCount(currentUser.id),
    ]);

    return NextResponse.json({
      notifications,
      unreadCount,
    });
  } catch (error) {
    console.error("GET /api/notifications error:", error);
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 });
  }
}

export async function POST (req: NextRequest) {
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

    const body = await req.json();

    if (body.action === "MARK_ALL_READ") {
      await notificationService.markAllAsRead(currentUser.id);
      return NextResponse.json({ success: true, message: "Semua notifikasi ditandai telah dibaca" });
    }

    if (body.action === "SEND") {
      const { userId, title, message, type, linkUrl, channels } = body;
      if (!userId || !title || !message) {
        return NextResponse.json({ error: "userId, title, and message are required" }, { status: 400 });
      }

      await notificationService.send({
        organizationId: currentUser.organizationId,
        userId,
        title,
        message,
        type: type || "INFO",
        linkUrl,
        channels: channels || ["IN_APP"],
      });

      return NextResponse.json({ success: true, message: "Notifikasi berhasil dikirim" });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("POST /api/notifications error:", error);
    return NextResponse.json({ error: "Failed to process notification action" }, { status: 500 });
  }
}
