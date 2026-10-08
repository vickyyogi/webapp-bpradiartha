import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { requireAuthAndPermission } from "@/lib/permissions";
import { AssetCondition, AssetStatus } from "@prisma/client";

export async function GET (req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authCheck = await requireAuthAndPermission("asset.view");
    if (!authCheck.authorized) {
      return authCheck.response;
    }

    const currentUser = await db.user.findUnique({
      where: { email: session.user.email },
    });

    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search");
    const category = searchParams.get("category");
    const status = searchParams.get("status");
    const condition = searchParams.get("condition");
    const branchId = searchParams.get("branchId");

    const whereClause = {
      organizationId: currentUser.organizationId,
    };

    if (category && category !== "ALL") {
      whereClause.category = category;
    }

    if (status && Object.values(AssetStatus).includes(status as AssetStatus)) {
      whereClause.status = status as AssetStatus;
    }

    if (condition && Object.values(AssetCondition).includes(condition as AssetCondition)) {
      whereClause.condition = condition as AssetCondition;
    }

    if (branchId) {
      whereClause.branchId = branchId;
    }

    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { assetNumber: { contains: search, mode: "insensitive" } },
        { serialNumber: { contains: search, mode: "insensitive" } },
        { location: { contains: search, mode: "insensitive" } },
        { currentHolder: { fullName: { contains: search, mode: "insensitive" } } },
      ];
    }

    const assets = await db.asset.findMany({
      where: whereClause,
      include: {
        branch: { select: { id: true, name: true, code: true } },
        currentHolder: { select: { id: true, fullName: true, email: true, phone: true } },
        _count: {
          select: {
            histories: true,
            maintenances: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Summary calculations across all organization assets
    const allOrgAssets = await db.asset.findMany({
      where: { organizationId: currentUser.organizationId },
      select: { status: true, condition: true, purchasePrice: true },
    });

    const summary = {
      totalAssets: allOrgAssets.length,
      assignedCount: allOrgAssets.filter((a) => a.status === "ASSIGNED").length,
      maintenanceCount: allOrgAssets.filter((a) => a.status === "MAINTENANCE").length,
      disposedCount: allOrgAssets.filter((a) => a.status === "DISPOSED").length,
      totalValue: allOrgAssets.reduce((acc, curr) => acc + (curr.purchasePrice || 0), 0),
    };

    return NextResponse.json({ assets, summary });
  } catch (error) {
    console.error("GET /api/assets error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST (req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authCheck = await requireAuthAndPermission("asset.create");
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
    const {
      assetNumber,
      name,
      category,
      serialNumber,
      purchaseDate,
      purchasePrice,
      vendor,
      warrantyExpiry,
      location,
      currentHolderId,
      condition = "GOOD",
      notes,
      branchId,
    } = body;

    if (!name || !category) {
      return NextResponse.json(
        { error: "Nama aset dan kategori wajib diisi." },
        { status: 400 }
      );
    }

    // Generate asset number if not provided
    let finalAssetNumber = assetNumber;
    if (!finalAssetNumber) {
      const year = new Date().getFullYear();
      const catCode = category.substring(0, 3).toUpperCase();
      const count = await db.asset.count({
        where: { organizationId: currentUser.organizationId },
      });
      finalAssetNumber = `AST-${catCode}-${year}-${String(count + 1).padStart(3, "0")}`;
    }

    // Check unique asset number
    const existing = await db.asset.findFirst({
      where: {
        organizationId: currentUser.organizationId,
        assetNumber: finalAssetNumber,
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: `Nomor aset ${finalAssetNumber} sudah terdaftar.` },
        { status: 400 }
      );
    }

    const initialStatus: AssetStatus = currentHolderId ? "ASSIGNED" : "PURCHASED";

    const asset = await db.$transaction(async (tx) => {
      const newAsset = await tx.asset.create({
        data: {
          organizationId: currentUser.organizationId,
          branchId: branchId || currentUser.branchId,
          assetNumber: finalAssetNumber,
          name,
          category,
          serialNumber: serialNumber || null,
          purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
          purchasePrice: purchasePrice ? Number(purchasePrice) : null,
          vendor: vendor || null,
          warrantyExpiry: warrantyExpiry ? new Date(warrantyExpiry) : null,
          location: location || null,
          currentHolderId: currentHolderId || null,
          condition: (condition as AssetCondition) || "GOOD",
          status: initialStatus,
          notes: notes || null,
        },
      });

      // Create initial purchase history
      await tx.assetHistory.create({
        data: {
          assetId: newAsset.id,
          action: "PURCHASE",
          condition: (condition as AssetCondition) || "GOOD",
          status: "PURCHASED",
          toLocation: location || null,
          notes: notes ? `Aset baru didaftarkan: ${notes}` : "Aset baru didaftarkan ke sistem",
          performedById: currentUser.id,
        },
      });

      // If assigned directly upon creation, create assignment history
      if (currentHolderId) {
        await tx.assetHistory.create({
          data: {
            assetId: newAsset.id,
            action: "ASSIGNMENT",
            toHolderId: currentHolderId,
            toLocation: location || null,
            condition: (condition as AssetCondition) || "GOOD",
            status: "ASSIGNED",
            notes: "Penyerahan langsung saat pendaftaran aset baru",
            performedById: currentUser.id,
          },
        });
      }

      return newAsset;
    });

    return NextResponse.json({ asset, message: "Aset operasional berhasil didaftarkan." });
  } catch (error) {
    console.error("POST /api/assets error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
