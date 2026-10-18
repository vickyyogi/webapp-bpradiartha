import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { buildScopeFilter, toScopeUser } from "@/lib/access-scope";
import { toDocumentDto } from "@/lib/document-storage";
import { CreditApplicationDetailClientView } from "./CreditApplicationDetailClientView";
import { Metadata } from "next";

const CREDIT_ASSIGNMENT_FIELDS = [
  "assignedMarketingOfficerId",
  "assignedAnalystId",
  "assignedSurveyOfficerId",
  "decisionMakerId",
];

async function scopedApplicationId(id: string): Promise<{ found: boolean; organizationId?: string }> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return { found: false };
  const currentUser = await db.user.findUnique({
    where: { email: session.user.email },
    include: { userRoles: { include: { role: true } } },
  });
  if (!currentUser) return { found: false };
  const scopeUser = toScopeUser(currentUser);
  const application = await db.creditApplication.findFirst({
    where: {
      id,
      ...(buildScopeFilter(scopeUser, { assignmentFields: CREDIT_ASSIGNMENT_FIELDS }) as Prisma.CreditApplicationWhereInput),
    },
    select: { id: true, organizationId: true },
  });
  return { found: Boolean(application), organizationId: application?.organizationId };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const { found, organizationId } = await scopedApplicationId(id);
  if (!found || !organizationId) {
    return { title: "Detail Pengajuan Kredit" };
  }
  const application = await db.creditApplication.findFirst({
    where: { id, organizationId },
    select: { applicationNumber: true, customer: { select: { legalName: true } } },
  });

  return {
    title: application
      ? `Pengajuan ${application.applicationNumber} - ${application.customer?.legalName ?? "Nasabah"}`
      : "Detail Pengajuan Kredit",
  };
}

export const dynamic = "force-dynamic";

export default async function CreditApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    redirect("/login");
  }

  const { id } = await params;

  const currentUser = await db.user.findUnique({
    where: { email: session.user.email },
    include: { userRoles: { include: { role: true } } },
  });
  if (!currentUser) redirect("/login");

  const scopeUser = toScopeUser(currentUser);
  const scopeWhere = buildScopeFilter(scopeUser, { assignmentFields: CREDIT_ASSIGNMENT_FIELDS }) as Prisma.CreditApplicationWhereInput;

  const [application, users, documents] = await Promise.all([
    db.creditApplication.findFirst({
      where: { id, ...scopeWhere },
      include: {
        customer: {
          select: {
            id: true,
            customerNumber: true,
            legalName: true,
            customerType: true,
            identityType: true,
            identityNumber: true,
            npwp: true,
            birthPlace: true,
            birthDate: true,
            address: true,
            phone: true,
            email: true,
          },
        },
        branch: { select: { id: true, name: true, code: true } },
        marketingOfficer: { select: { id: true, fullName: true, email: true } },
        analyst: { select: { id: true, fullName: true, email: true } },
        surveyOfficer: { select: { id: true, fullName: true, email: true } },
        decisionMaker: { select: { id: true, fullName: true, email: true } },
        statusHistories: {
          include: { changedBy: { select: { id: true, fullName: true, email: true } } },
          orderBy: { createdAt: "desc" },
        },
        approvalRecords: {
          include: { approver: { select: { id: true, fullName: true, email: true } } },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    db.user.findMany({
      where: { organizationId: currentUser.organizationId, isActive: true },
      select: { id: true, fullName: true, email: true },
      orderBy: { fullName: "asc" },
    }),
    db.document.findMany({
      // Batasi ke organisasi pengguna: daftar dokumen tidak boleh bocor
      // hanya karena record induk cocok (Tahap 4 / P0.4).
      where: { ownerType: "CREDIT_APPLICATION", ownerId: id, organizationId: currentUser.organizationId },
      include: { uploadedBy: { select: { id: true, fullName: true, email: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!application) {
    notFound();
  }

  // Tahap 5 (P0.5): hasil analisa SLIK milik debitur pengajuan ini — untuk
  // ditampilkan di pipeline (tab Analisis) sebagai bahan verifikasi manual.
  const slikRecords = await db.slikAnalysisRecord.findMany({
    where: { organizationId: currentUser.organizationId, customerId: application.customerId },
    select: {
      id: true,
      creditApplicationId: true,
      customerName: true,
      sourceFileNames: true,
      mode: true,
      rekomendasi: true,
      riskRating: true,
      modelUsed: true,
      createdAt: true,
      result: true,
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const slikSummaries = slikRecords.map((record) => {
    const result = (record.result ?? {}) as {
      ringkasan_eksposur?: { total_baki_debet?: number; kualitas_terburuk?: string };
      rincian_tunggakan?: { total_tunggakan_real?: number };
      data_pribadi?: { nama_lengkap?: string };
    };
    return {
      id: record.id,
      linkedToApplication: record.creditApplicationId === id,
      customerName: record.customerName,
      sourceFileNames: record.sourceFileNames,
      mode: record.mode,
      rekomendasi: record.rekomendasi,
      riskRating: record.riskRating,
      modelUsed: record.modelUsed,
      createdAt: record.createdAt,
      totalBakiDebet: result.ringkasan_eksposur?.total_baki_debet ?? null,
      totalTunggakanReal: result.rincian_tunggakan?.total_tunggakan_real ?? null,
      kualitasTerburuk: result.ringkasan_eksposur?.kualitas_terburuk ?? null,
      namaPadaDokumen: result.data_pribadi?.nama_lengkap ?? null,
    };
  });

  // Tahap 5B (P0.5): status gate — bila analisa AI terbaru = REJECT dan belum
  // ada alasan penerusan yang menanggapinya, pengajuan hanya dapat dilanjutkan
  // setelah Account Officer / petugas survei mengisi alasan.
  const slikOverrides = await db.creditSlikOverride.findMany({
    where: { organizationId: currentUser.organizationId, creditApplicationId: id },
    select: {
      id: true,
      slikAnalysisRecordId: true,
      rekomendasi: true,
      reason: true,
      recordedByName: true,
      recordedByRole: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const latestSlik = slikRecords[0] ?? null;
  const coveringOverride = latestSlik
    ? (slikOverrides.find((item) => item.slikAnalysisRecordId === latestSlik.id) ?? null)
    : null;

  const slikGate = {
    active: Boolean(latestSlik && latestSlik.rekomendasi === "REJECT" && !coveringOverride),
    latestRekomendasi: latestSlik?.rekomendasi ?? null,
    latestAnalysisDate: latestSlik?.createdAt ?? null,
    override: coveringOverride
      ? {
          reason: coveringOverride.reason,
          recordedByName: coveringOverride.recordedByName,
          recordedByRole: coveringOverride.recordedByRole,
          createdAt: coveringOverride.createdAt,
        }
      : null,
  };

  // Tahap 5B (P0.5): verifikasi manual angka ekstraksi AI — terbaru per analisa
  // (diambil descending sehingga kemunculan pertama = verifikasi terakhir).
  const slikVerifications = await db.slikAnalysisVerification.findMany({
    where: {
      organizationId: currentUser.organizationId,
      slikAnalysisRecordId: { in: slikRecords.map((record) => record.id) },
    },
    select: {
      id: true,
      slikAnalysisRecordId: true,
      aiBakiDebet: true,
      aiTunggakan: true,
      aiKolektibilitas: true,
      confirmedBakiDebet: true,
      confirmedTunggakan: true,
      confirmedKolektibilitas: true,
      note: true,
      verifiedByName: true,
      verifiedAt: true,
    },
    orderBy: { verifiedAt: "desc" },
    take: 100,
  });

  return (
    <CreditApplicationDetailClientView
      application={JSON.parse(JSON.stringify(application))}
      users={users}
      initialDocuments={JSON.parse(JSON.stringify(documents.map(toDocumentDto)))}
      initialSlikAnalyses={JSON.parse(JSON.stringify(slikSummaries))}
      initialSlikVerifications={JSON.parse(JSON.stringify(slikVerifications))}
      slikGate={JSON.parse(JSON.stringify(slikGate))}
      slikOverrides={JSON.parse(JSON.stringify(slikOverrides))}
    />
  );
}
