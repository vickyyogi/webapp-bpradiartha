import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuthAndPermission } from "@/lib/permissions";
import { buildScopeFilter, toScopeUser } from "@/lib/access-scope";

export async function GET (req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const domain = searchParams.get("domain") || "ALL"; // ALL, CREDIT, FIELD, PURCHASING, INVENTORY, ASSET
    const format = searchParams.get("format"); // "csv" or json
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    // Ekspor CSV memuat data sensitif lintas entitas → butuh izin ekspor tersendiri.
    const requiredPermission = format === "csv" ? "report.management.export" : "report.management.view";
    const authCheck = await requireAuthAndPermission(requiredPermission);
    if (!authCheck.authorized) {
      return authCheck.response;
    }
    const currentUser = authCheck.user!;
    const scopeUser = toScopeUser(currentUser);

    const dateFilter: Prisma.DateTimeFilter = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter.lte = end;
    }
    const hasDate = Boolean(startDate || endDate);

    // Cakupan organisasi/cabang/penugasan untuk setiap entitas.
    const creditScope = buildScopeFilter(scopeUser, {
      assignmentFields: ["assignedMarketingOfficerId", "assignedAnalystId", "assignedSurveyOfficerId", "decisionMakerId"],
    }) as Prisma.CreditApplicationWhereInput;
    const fieldScope = buildScopeFilter(scopeUser, { assignmentFields: ["assignedOfficerId"] }) as Prisma.FieldTaskWhereInput;
    const prScope = buildScopeFilter(scopeUser, { assignmentFields: ["requesterId"] }) as Prisma.PurchaseRequestWhereInput;
    const poScope = buildScopeFilter(scopeUser, { assignmentFields: ["createdById"] }) as Prisma.PurchaseOrderWhereInput;
    const invScope = buildScopeFilter(scopeUser, { assignmentFields: [] }) as Prisma.InventoryItemWhereInput;
    const assetScope = buildScopeFilter(scopeUser, { assignmentFields: ["currentHolderId"] }) as Prisma.AssetWhereInput;

    // 1. Credit Data
    const creditApps = await db.creditApplication.findMany({
      where: { ...creditScope, ...(hasDate ? { createdAt: dateFilter } : {}) },
      include: {
        customer: { select: { legalName: true, phone: true } },
        marketingOfficer: { select: { fullName: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // 2. Field Tasks
    const fieldTasks = await db.fieldTask.findMany({
      where: { ...fieldScope, ...(hasDate ? { createdAt: dateFilter } : {}) },
      include: { assignedOfficer: { select: { fullName: true } } },
      orderBy: { createdAt: "desc" },
    });

    // 3. Purchasing (PR & PO)
    const purchaseRequests = await db.purchaseRequest.findMany({
      where: { ...prScope, ...(hasDate ? { createdAt: dateFilter } : {}) },
      include: {
        requester: { select: { fullName: true } },
        department: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const purchaseOrders = await db.purchaseOrder.findMany({
      where: { ...poScope, ...(hasDate ? { createdAt: dateFilter } : {}) },
      include: {
        vendor: { select: { name: true, category: true } },
        createdBy: { select: { fullName: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // 4. Inventory & Assets
    const inventoryItems = await db.inventoryItem.findMany({
      where: { ...invScope, isActive: true },
      orderBy: { name: "asc" },
    });

    const assets = await db.asset.findMany({
      where: { ...assetScope },
      include: { currentHolder: { select: { fullName: true } } },
      orderBy: { createdAt: "desc" },
    });

    // If CSV export requested
    if (format === "csv") {
      let csvContent = "";
      const filename = `laporan-bpr-${domain.toLowerCase()}-${new Date().toISOString().split("T")[0]}.csv`;

      if (domain === "CREDIT") {
        csvContent = "No. Aplikasi,Pemohon,Produk,Nominal Diajukan,Nominal Disetujui,Nominal Realisasi,Status,Tanggal Pengajuan\n";
        creditApps.forEach((c) => {
          csvContent += `"${c.applicationNumber}","${c.customer?.legalName || "-"}","${c.product || "-"}","${c.requestedAmount || 0}","${c.approvedAmount || 0}","${c.realizationAmount || 0}","${c.status}","${new Date(c.createdAt).toLocaleDateString("id-ID")}"\n`;
        });
      } else if (domain === "PURCHASING") {
        csvContent = "No. PO,Vendor,Tanggal PO,Syarat Bayar,Subtotal,PPN 11%,Total Nilai,Status\n";
        purchaseOrders.forEach((p) => {
          csvContent += `"${p.poNumber}","${p.vendor?.name || "-"}","${new Date(p.poDate).toLocaleDateString("id-ID")}","${p.paymentTerms || "-"}","${p.subtotal}","${p.taxAmount}","${p.totalAmount}","${p.status}"\n`;
        });
      } else if (domain === "INVENTORY") {
        csvContent = "Kode Barang,Nama Barang,Kategori,Satuan,Stok Saat Ini,Batas Minimum,Harga Satuan,Nilai Total Stok\n";
        inventoryItems.forEach((i) => {
          const totalVal = (i.unitPrice || 0) * i.currentStock;
          csvContent += `"${i.itemCode}","${i.name}","${i.category}","${i.unit}","${i.currentStock}","${i.minStock}","${i.unitPrice || 0}","${totalVal}"\n`;
        });
      } else if (domain === "ASSET") {
        csvContent = "No. Aset,Nama Aset,Kategori,No Seri,Pemegang,Lokasi,Kondisi,Status,Harga Perolehan\n";
        assets.forEach((a) => {
          csvContent += `"${a.assetNumber}","${a.name}","${a.category}","${a.serialNumber || "-"}","${a.currentHolder?.fullName || "-"}","${a.location || "-"}","${a.condition}","${a.status}","${a.purchasePrice || 0}"\n`;
        });
      } else {
        // Default combined summary
        csvContent = "Kategori Laporan,Jumlah Data,Nilai Akumulasi (Rp)\n";
        csvContent += `"Aplikasi Kredit Total","${creditApps.length}","${creditApps.reduce((s, c) => s + (c.requestedAmount || 0), 0)}"\n`;
        csvContent += `"Kredit Direalisasikan","${creditApps.filter((c) => c.status === "APPROVED" && c.realizationAmount).length}","${creditApps.reduce((s, c) => s + (c.realizationAmount || 0), 0)}"\n`;
        csvContent += `"Purchase Order Terbit","${purchaseOrders.length}","${purchaseOrders.reduce((s, p) => s + (p.totalAmount || 0), 0)}"\n`;
        csvContent += `"Total Nilai Aset Tetap","${assets.length}","${assets.reduce((s, a) => s + (a.purchasePrice || 0), 0)}"\n`;
        csvContent += `"Total Nilai Stok ATK","${inventoryItems.length}","${inventoryItems.reduce((s, i) => s + (i.unitPrice || 0) * i.currentStock, 0)}"\n`;
      }

      return new NextResponse(csvContent, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    // JSON response aggregations
    const creditPipelineSummary = {
      totalApplications: creditApps.length,
      totalRequestedAmount: creditApps.reduce((s, c) => s + (c.requestedAmount || 0), 0),
      totalApprovedAmount: creditApps.reduce((s, c) => s + (c.approvedAmount || 0), 0),
      totalRealizedAmount: creditApps.reduce((s, c) => s + (c.realizationAmount || 0), 0),
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
      totalPOValue: purchaseOrders.reduce((s, p) => s + (p.totalAmount || 0), 0),
      completedPO: purchaseOrders.filter((p) => p.status === "COMPLETED").length,
    };

    const inventoryAssetSummary = {
      totalInventoryItems: inventoryItems.length,
      lowStockItemsCount: inventoryItems.filter((i) => i.currentStock <= i.minStock).length,
      inventoryValuation: inventoryItems.reduce((s, i) => s + (i.unitPrice || 0) * i.currentStock, 0),
      totalAssetsCount: assets.length,
      assignedAssetsCount: assets.filter((a) => a.status === "ASSIGNED").length,
      maintenanceAssetsCount: assets.filter((a) => a.status === "MAINTENANCE").length,
      assetTotalValuation: assets.reduce((s, a) => s + (a.purchasePrice || 0), 0),
    };

    return NextResponse.json({
      creditPipelineSummary,
      fieldProductivitySummary,
      purchasingSummary,
      inventoryAssetSummary,
      data: {
        creditApps: creditApps.slice(0, 10),
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
