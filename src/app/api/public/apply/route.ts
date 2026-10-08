import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { LeadStatus } from "@prisma/client";
import { checkRateLimit } from "@/lib/rate-limit";
import { sanitizeInput, isValidPhone, createSecureErrorResponse } from "@/lib/security";

export async function POST (req: NextRequest) {
  // 1. Rate Limiting Check (Max 5 requests per 60 seconds per IP)
  const rateLimitResult = checkRateLimit(req, "public-apply", {
    limit: 5,
    windowMs: 60 * 1000,
  });

  if (!rateLimitResult.isAllowed) {
    return rateLimitResult.response!;
  }

  try {
    const body = await req.json();
    const {
      name,
      phone,
      address,
      productInterest,
      requestedAmount,
      tenorMonths,
      notes,
    } = body;

    // 2. Input Validation
    if (!name || !phone) {
      return NextResponse.json(
        { error: "Nama dan nomor telepon wajib diisi." },
        { status: 400 }
      );
    }

    if (!isValidPhone(phone)) {
      return NextResponse.json(
        { error: "Format nomor telepon/WhatsApp tidak valid (contoh: 081234567890)." },
        { status: 400 }
      );
    }

    // 3. Input Sanitization
    const cleanName = sanitizeInput(name);
    const cleanPhone = phone.trim().replace(/[-\s]/g, "");
    const cleanAddress = address ? sanitizeInput(address) : null;
    const cleanProduct = productInterest ? sanitizeInput(productInterest) : "Kredit Modal Kerja";
    const cleanNotes = notes ? sanitizeInput(notes) : "";

    // 4. Get default organization (BPR Utama)
    const org = await db.organization.findFirst({
      where: { isActive: true },
      include: { branches: { where: { isActive: true } } },
    });

    if (!org) {
      return NextResponse.json({ error: "Sistem belum siap menerima data." }, { status: 500 });
    }

    const defaultBranch = org.branches[0] || null;

    // Build lead notes with requested simulation details if provided
    let combinedNotes = cleanNotes;
    if (requestedAmount || tenorMonths) {
      const parsedAmount = parseFloat(requestedAmount);
      const formattedAmount = !isNaN(parsedAmount)
        ? `Rp ${parsedAmount.toLocaleString("id-ID")}`
        : "-";
      combinedNotes = `[Simulasi Web] Plafon: ${formattedAmount}, Tenor: ${tenorMonths || "-"} Bulan.\nKeterangan: ${combinedNotes}`.trim();
    }

    // Create Lead in database with source 'Website'
    const newLead = await db.lead.create({
      data: {
        organizationId: org.id,
        branchId: defaultBranch?.id,
        source: "Website",
        name: cleanName,
        phone: cleanPhone,
        address: cleanAddress,
        productInterest: cleanProduct,
        status: LeadStatus.NEW,
        notes: combinedNotes,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Pengajuan Anda telah berhasil dikirim. Tim marketing BPR akan segera menghubungi Anda.",
        data: { id: newLead.id },
      },
      {
        status: 201,
        headers: {
          "X-RateLimit-Limit": "5",
          "X-RateLimit-Remaining": String(rateLimitResult.remaining),
        },
      }
    );
  } catch (error) {
    return createSecureErrorResponse(error, "POST /api/public/apply", 500);
  }
}
