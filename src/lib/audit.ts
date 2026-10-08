import { db } from "@/lib/db";
import { NextRequest } from "next/server";

export interface LogAuditParams {
  organizationId: string;
  userId?: string | null;
  action:
    | "CREATE"
    | "UPDATE"
    | "DELETE"
    | "APPROVE"
    | "REJECT"
    | "LOGIN"
    | "LOGOUT"
    | "UPLOAD"
    | "DOWNLOAD"
    | "STATUS_CHANGE"
    | "ASSIGN"
    | "TRANSFER"
    | "DISPOSAL"
    | string;
  entityType:
    | "CREDIT_APPLICATION"
    | "LEAD"
    | "PURCHASE_REQUEST"
    | "PURCHASE_ORDER"
    | "GOODS_RECEIPT"
    | "INVENTORY_ITEM"
    | "ASSET"
    | "DOCUMENT"
    | "USER"
    | "ROLE"
    | string;
  entityId: string;
  oldValues?: any;
  newValues?: any;
  ipAddress?: string | null;
  userAgent?: string | null;
  notes?: string | null;
}

export async function logAudit(params: LogAuditParams) {
  try {
    return await db.auditLog.create({
      data: {
        organizationId: params.organizationId,
        userId: params.userId || null,
        action: params.action,
        entityType: params.entityType,
        entityId: String(params.entityId),
        oldValues: params.oldValues ? JSON.parse(JSON.stringify(params.oldValues)) : undefined,
        newValues: params.newValues ? JSON.parse(JSON.stringify(params.newValues)) : undefined,
        ipAddress: params.ipAddress || null,
        userAgent: params.userAgent || null,
        notes: params.notes || null,
      },
    });
  } catch (error) {
    console.error("Failed to write audit log:", error);
    // Audit log should not crash main request, return null
    return null;
  }
}

export function extractClientInfo(req: NextRequest) {
  const forwarded = req.headers.get("x-forwarded-for");
  const ipAddress = forwarded ? forwarded.split(",")[0].trim() : req.headers.get("x-real-ip") || "127.0.0.1";
  const userAgent = req.headers.get("user-agent") || "Unknown";
  return { ipAddress, userAgent };
}
