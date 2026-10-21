import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAnyPermission } from "@/lib/permissions";
import { buildScopeFilter, toScopeUser } from "@/lib/access-scope";
import { extractClientInfo, logAudit } from "@/lib/audit";
import { maskPhone } from "@/lib/privacy";
import { EXPORT_BATCH_SIZE, createCsvStream } from "@/lib/report-export";

const DOMAIN_PERMISSIONS: Record<string, { view: string; export: string }> = {
  CREDIT: { view: "report.credit.view", export: "report.credit.export" },
  FIELD: { view: "report.field.view", export: "report.field.export" },
  PURCHASING: { view: "report.purchasing.view", export: "report.purchasing.export" },
  INVENTORY: { view: "report.inventory.view", export: "report.inventory.export" },
  ASSET: { view: "report.inventory.view", export: "report.inventory.export" },
  ALL: { view: "report.management.view", export: "report.management.export" },
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseDate(value: string | null, endOfDay = false): Date | null {
  if (!value || !DATE_RE.test(value)) return null;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  if (endOfDay) date.setHours(23, 59, 59, 999);
  return date;
}

export async function GET (req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const domain = (searchParams.get("domain") || "ALL").toUpperCase();
    const format = searchParams.get("format");
    const startDate = parseDate(searchParams.get("startDate"));
    const endDate = parseDate(searchParams.get("endDate"), true);
    const branchId = searchParams.get("branchId");
    const product = searchParams.get("product")?.trim();
    const officerId = searchParams.get("officerId");
    const analystId = searchParams.get("analystId");

    const permissions = DOMAIN_PERMISSIONS[domain];
    if (!permissions) {
      return NextResponse.json({ error: "Domain laporan tidak dikenal." }, { status: 400 });
    }

    // Tahap 8 (P1.5): izin ekspor mengikuti domain laporan, bukan hanya izin
    // manajemen. Ekspor tetap butuh izin ekspor tersendiri (least privilege).
    const authCheck = await requireAnyPermission(
      format === "csv"
        ? [permissions.export, "report.management.export"]
        : [permissions.view, "report.management.view"]
    );
    if (!authCheck.authorized) {
      return authCheck.response;
    }
    const currentUser = authCheck.user!;
    const scopeUser = toScopeUser(currentUser);

    const dateFilter: Prisma.DateTimeFilter = {};
    if (startDate) dateFilter.gte = startDate;
    if (endDate) dateFilter.lte = endDate;
    const hasDate = Boolean(startDate || endDate);

    // Cakupan organisasi/cabang/penugasan tetap berlaku meski filter cabang
    // diminta klien; filter diminta hanya mempersempit cakupan, bukan menggantinya.
    const creditScope = buildScopeFilter(scopeUser, {
      assignmentFields: ["assignedMarketingOfficerId", "assignedAnalystId", "assignedSurveyOfficerId", "decisionMakerId"],
    }) as Prisma.CreditApplicationWhereInput;
    const fieldScope = buildScopeFilter(scopeUser, { assignmentFields: ["assignedOfficerId"] }) as Prisma.FieldTaskWhereInput;
    const prScope = buildScopeFilter(scopeUser, { assignmentFields: ["requesterId"] }) as Prisma.PurchaseRequestWhereInput;
    const poScope = buildScopeFilter(scopeUser, { assignmentFields: ["createdById"] }) as Prisma.PurchaseOrderWhereInput;
    const invScope = buildScopeFilter(scopeUser, { assignmentFields: [] }) as Prisma.InventoryItemWhereInput;
    const assetScope = buildScopeFilter(scopeUser, { assignmentFields: ["currentHolderId"] }) as Prisma.AssetWhereInput;

    const creditWhere: Prisma.CreditApplicationWhereInput = {
      ...creditScope,
      ...(hasDate ? { createdAt: dateFilter } : {}),
      ...(branchId ? { branchId } : {}),
      ...(product ? { product: { contains: product, mode: "insensitive" } } : {}),
      ...(officerId ? { assignedMarketingOfficerId: officerId } : {}),
      ...(analystId ? { assignedAnalystId: analystId } : {}),
    };
    const fieldWhere: Prisma.FieldTaskWhereInput = {
      ...fieldScope,
      ...(hasDate ? { createdAt: dateFilter } : {}),
      ...(branchId ? { branchId } : {}),
      ...(officerId ? { assignedOfficerId: officerId } : {}),
    };
    const prWhere: Prisma.PurchaseRequestWhereInput = {
      ...prScope,
      ...(hasDate ? { createdAt: dateFilter } : {}),
      ...(branchId ? { branchId } : {}),
    };
    const poWhere: Prisma.PurchaseOrderWhereInput = {
      ...poScope,
      ...(hasDate ? { createdAt: dateFilter } : {}),
      ...(branchId ? { branchId } : {}),
    };
    const invWhere: Prisma.InventoryItemWhereInput = {
      ...invScope,
      ...(branchId ? { branchId } : {}),
      isActive: true,
    };
    const assetWhere: Prisma.AssetWhereInput = {
      ...assetScope,
      ...(branchId ? { branchId } : {}),
    };

    // --- Ekspor CSV: kueri per batch, kirim sebagai stream ---
    if (format === "csv") {
      const filename = `laporan-bpr-${domain.toLowerCase()}-${new Date().toISOString().split("T")[0]}.csv`;
      let header: string[] = [];
      let rows: AsyncIterable<unknown[]> = (async function* () {})();
      let rowCount = 0;

      if (domain === "CREDIT") {
        rowCount = await db.creditApplication.count({ where: creditWhere });
        header = [
          "No. Aplikasi", "Cabang", "Pemohon", "Kontak", "Produk",
          "Marketing Officer", "Analis", "Nominal Diajukan", "Nominal Disetujui",
          "Nominal Realisasi", "Status", "Tanggal Pengajuan",
        ];
        rows = paginateCredit(creditWhere);
      } else if (domain === "FIELD") {
        rowCount = await db.fieldTask.count({ where: fieldWhere });
        header = ["Judul Tugas", "Jenis", "Petugas", "Cabang", "Status", "Lokasi", "Tanggal Tugas"];
        rows = paginateField(fieldWhere);
      } else if (domain === "PURCHASING") {
        rowCount = await db.purchaseOrder.count({ where: poWhere });
        header = ["No. PO", "Vendor", "Cabang", "Tanggal PO", "Syarat Bayar", "Subtotal", "PPN", "Total Nilai", "Status"];
        rows = paginatePurchaseOrders(poWhere);
      } else if (domain === "INVENTORY") {
        rowCount = await db.inventoryItem.count({ where: invWhere });
        header = ["Kode Barang", "Nama Barang", "Kategori", "Satuan", "Stok Saat Ini", "Batas Minimum", "Harga Satuan", "Nilai Total Stok"];
        rows = paginateInventory(invWhere);
      } else if (domain === "ASSET") {
        rowCount = await db.asset.count({ where: assetWhere });
        header = ["No. Aset", "Nama Aset", "Kategori", "No Seri", "Pemegang", "Cabang", "Lokasi", "Kondisi", "Status", "Harga Perolehan"];
        rows = paginateAssets(assetWhere);
      } else {
        // Ringkasan gabungan: hitung agregat tanpa memuat seluruh baris.
        const [creditCount, creditSum, realized, fieldCount, completedField, prCount, poCount, poSum, invCount, invValue, assetCount, assetSum] =
          await Promise.all([
            db.creditApplication.count({ where: creditWhere }),
            db.creditApplication.aggregate({ where: creditWhere, _sum: { requestedAmount: true, realizationAmount: true } }),
            db.creditApplication.count({ where: { ...creditWhere, status: "APPROVED" } }),
            db.fieldTask.count({ where: fieldWhere }),
            db.fieldTask.count({ where: { ...fieldWhere, status: "COMPLETED" } }),
            db.purchaseRequest.count({ where: prWhere }),
            db.purchaseOrder.count({ where: poWhere }),
            db.purchaseOrder.aggregate({ where: poWhere, _sum: { totalAmount: true } }),
            db.inventoryItem.count({ where: invWhere }),
            sumInventoryValue(invWhere),
            db.asset.count({ where: assetWhere }),
            db.asset.aggregate({ where: assetWhere, _sum: { purchasePrice: true } }),
          ]);
        const summary = [
          ["Aplikasi Kredit Total", creditCount, Number(creditSum._sum.requestedAmount || 0)],
          ["Kredit Disetujui", realized, Number(creditSum._sum.realizationAmount || 0)],
          ["Tugas Lapangan", fieldCount, 0],
          ["Tugas Lapangan Selesai", completedField, 0],
          ["Purchase Request", prCount, 0],
          ["Purchase Order", poCount, Number(poSum._sum.totalAmount || 0)],
          ["Item Inventaris", invCount, invValue],
          ["Aset Tetap", assetCount, Number(assetSum._sum.purchasePrice || 0)],
        ];
        rowCount = summary.length;
        header = ["Kategori Laporan", "Jumlah Data", "Nilai Akumulasi (Rp)"];
        rows = (async function* () {
          yield* summary;
        })();
      }

      // Tahap 7 (P1.6): ekspor berjejak audit. Metadata saja; isi CSV/PII tidak masuk log.
      await logAudit({
        organizationId: currentUser.organizationId,
        userId: currentUser.id,
        action: "EXPORT",
        entityType: "REPORT",
        entityId: filename,
        ...extractClientInfo(req),
        newValues: {
          format: "csv",
          domain,
          rowCount,
          filters: { startDate: searchParams.get("startDate"), endDate: searchParams.get("endDate"), branchId, product, officerId, analystId },
          pii: "masked",
        },
        notes: `Ekspor CSV laporan domain ${domain} (${rowCount} baris).`,
      });

      return new NextResponse(createCsvStream(header, rows), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "private, no-store, max-age=0",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    // --- Tampilan JSON ---
    const creditApps = await db.creditApplication.findMany({
      where: creditWhere,
      include: {
        customer: { select: { legalName: true, phone: true } },
        marketingOfficer: { select: { fullName: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    const fieldTasks = await db.fieldTask.findMany({
      where: fieldWhere,
      include: { assignedOfficer: { select: { fullName: true } } },
      orderBy: { createdAt: "desc" },
    });
    const purchaseRequests = await db.purchaseRequest.findMany({ where: prWhere, orderBy: { createdAt: "desc" } });
    const purchaseOrders = await db.purchaseOrder.findMany({
      where: poWhere,
      include: { vendor: { select: { name: true, category: true } } },
      orderBy: { createdAt: "desc" },
    });
    const inventoryItems = await db.inventoryItem.findMany({ where: invWhere, orderBy: { name: "asc" } });
    const assets = await db.asset.findMany({
      where: assetWhere,
      include: { currentHolder: { select: { fullName: true } } },
      orderBy: { createdAt: "desc" },
    });

    const creditPipelineSummary = {
      totalApplications: creditApps.length,
      totalRequestedAmount: creditApps.reduce((s, c) => s + Number(c.requestedAmount || 0), 0),
      totalApprovedAmount: creditApps.reduce((s, c) => s + Number(c.approvedAmount || 0), 0),
      totalRealizedAmount: creditApps.reduce((s, c) => s + Number(c.realizationAmount || 0), 0),
      byStatus: {
        SUBMITTED: creditApps.filter((c) => c.status === "SUBMITTED").length,
        VERIFICATION: creditApps.filter((c) => c.status === "VERIFICATION").length,
        ANALYSIS: creditApps.filter((c) => c.status === "ANALYSIS").length,
        SURVEY: creditApps.filter((c) => c.status === "SURVEY").length,
        REVIEW: creditApps.filter((c) => c.status === "REVIEW").length,
        DECISION: creditApps.filter((c) => c.status === "DECISION").length,
        APPROVED: creditApps.filter((c) => c.status === "APPROVED").length,
        REJECTED: creditApps.filter((c) => c.status === "REJECTED").length,
      },
    };

    const fieldProductivitySummary = {
      totalTasks: fieldTasks.length,
      completedTasks: fieldTasks.filter((t) => t.status === "COMPLETED").length,
      pendingTasks: fieldTasks.filter((t) => t.status === "PENDING" || t.status === "IN_PROGRESS").length,
      completionRate: fieldTasks.length > 0 ? Math.round((fieldTasks.filter((t) => t.status === "COMPLETED").length / fieldTasks.length) * 100) : 0,
    };

    const purchasingSummary = {
      totalPR: purchaseRequests.length,
      approvedPR: purchaseRequests.filter((p) => p.status === "APPROVED").length,
      totalPO: purchaseOrders.length,
      totalPOValue: purchaseOrders.reduce((s, p) => s + Number(p.totalAmount || 0), 0),
      completedPO: purchaseOrders.filter((p) => p.status === "COMPLETED").length,
    };

    const inventoryAssetSummary = {
      totalInventoryItems: inventoryItems.length,
      lowStockItemsCount: inventoryItems.filter((i) => i.currentStock <= i.minStock).length,
      inventoryValuation: inventoryItems.reduce((s, i) => s + Number(i.unitPrice || 0) * i.currentStock, 0),
      totalAssetsCount: assets.length,
      assignedAssetsCount: assets.filter((a) => a.status === "ASSIGNED").length,
      maintenanceAssetsCount: assets.filter((a) => a.status === "MAINTENANCE").length,
      assetTotalValuation: assets.reduce((s, a) => s + Number(a.purchasePrice || 0), 0),
    };

    return NextResponse.json({
      creditPipelineSummary,
      fieldProductivitySummary,
      purchasingSummary,
      inventoryAssetSummary,
      data: {
        // Tahap 8: kontak selalu dimasking pada tampilan laporan.
        creditApps: creditApps.slice(0, 10).map((c) => ({
          ...c,
          customer: c.customer ? { legalName: c.customer.legalName, phone: maskPhone(c.customer.phone) } : null,
        })),
        purchaseOrders: purchaseOrders.slice(0, 10),
        inventoryItems: inventoryItems.slice(0, 10),
        assets: assets.slice(0, 10),
      },
    });
  } catch (error) {
    console.error("GET /api/reports error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function* paginateCredit (where: Prisma.CreditApplicationWhereInput): AsyncIterable<unknown[]> {
  let cursor: string | undefined;
  for (;;) {
    const batch = await db.creditApplication.findMany({
      where,
      take: EXPORT_BATCH_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { id: "asc" },
      include: {
        customer: { select: { legalName: true, phone: true } },
        branch: { select: { name: true } },
        marketingOfficer: { select: { fullName: true } },
        analyst: { select: { fullName: true } },
      },
    });
    if (batch.length === 0) return;
    for (const c of batch) {
      yield [
        c.applicationNumber, c.branch?.name || "-", c.customer?.legalName || "-",
        maskPhone(c.customer?.phone), c.product || "-",
        c.marketingOfficer?.fullName || "-", c.analyst?.fullName || "-",
        c.requestedAmount ?? 0, c.approvedAmount ?? 0, c.realizationAmount ?? 0,
        c.status, new Date(c.createdAt).toLocaleDateString("id-ID"),
      ];
    }
    cursor = batch[batch.length - 1].id;
  }
}

async function* paginateField (where: Prisma.FieldTaskWhereInput): AsyncIterable<unknown[]> {
  let cursor: string | undefined;
  for (;;) {
    const batch = await db.fieldTask.findMany({
      where,
      take: EXPORT_BATCH_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { id: "asc" },
      include: { assignedOfficer: { select: { fullName: true } }, branch: { select: { name: true } } },
    });
    if (batch.length === 0) return;
    for (const t of batch) {
      yield [
        t.title, t.taskType, t.assignedOfficer?.fullName || "-", t.branch?.name || "-",
        t.status, t.customerAddress || "-", new Date(t.createdAt).toLocaleDateString("id-ID"),
      ];
    }
    cursor = batch[batch.length - 1].id;
  }
}

async function* paginatePurchaseOrders (where: Prisma.PurchaseOrderWhereInput): AsyncIterable<unknown[]> {
  let cursor: string | undefined;
  for (;;) {
    const batch = await db.purchaseOrder.findMany({
      where,
      take: EXPORT_BATCH_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { id: "asc" },
      include: { vendor: { select: { name: true } }, branch: { select: { name: true } } },
    });
    if (batch.length === 0) return;
    for (const p of batch) {
      yield [
        p.poNumber, p.vendor?.name || "-", p.branch?.name || "-",
        new Date(p.poDate).toLocaleDateString("id-ID"), p.paymentTerms || "-",
        p.subtotal ?? 0, p.taxAmount ?? 0, p.totalAmount ?? 0, p.status,
      ];
    }
    cursor = batch[batch.length - 1].id;
  }
}

async function* paginateInventory (where: Prisma.InventoryItemWhereInput): AsyncIterable<unknown[]> {
  let cursor: string | undefined;
  for (;;) {
    const batch = await db.inventoryItem.findMany({
      where,
      take: EXPORT_BATCH_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { id: "asc" },
    });
    if (batch.length === 0) return;
    for (const i of batch) {
      yield [
        i.itemCode, i.name, i.category, i.unit, i.currentStock, i.minStock,
        i.unitPrice ?? 0, Number(i.unitPrice || 0) * i.currentStock,
      ];
    }
    cursor = batch[batch.length - 1].id;
  }
}

async function* paginateAssets (where: Prisma.AssetWhereInput): AsyncIterable<unknown[]> {
  let cursor: string | undefined;
  for (;;) {
    const batch = await db.asset.findMany({
      where,
      take: EXPORT_BATCH_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { id: "asc" },
      include: { currentHolder: { select: { fullName: true } }, branch: { select: { name: true } } },
    });
    if (batch.length === 0) return;
    for (const a of batch) {
      yield [
        a.assetNumber, a.name, a.category, a.serialNumber || "-",
        a.currentHolder?.fullName || "-", a.branch?.name || "-", a.location || "-",
        a.condition, a.status, a.purchasePrice ?? 0,
      ];
    }
    cursor = batch[batch.length - 1].id;
  }
}

async function sumInventoryValue (where: Prisma.InventoryItemWhereInput): Promise<number> {
  let cursor: string | undefined;
  let total = 0;
  for (;;) {
    const batch = await db.inventoryItem.findMany({
      where,
      take: EXPORT_BATCH_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { id: "asc" },
      select: { id: true, unitPrice: true, currentStock: true },
    });
    if (batch.length === 0) return total;
    total += batch.reduce((s, i) => s + Number(i.unitPrice || 0) * i.currentStock, 0);
    cursor = batch[batch.length - 1].id;
  }
}
