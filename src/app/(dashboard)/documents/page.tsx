import { db } from "@/lib/db";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { toDocumentDto } from "@/lib/document-storage";
import { DocumentsClientView } from "./DocumentsClientView";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dokumen Digital",
};

export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  const session = await getServerSession(authOptions);
  const currentUser = await db.user.findUnique({
    where: { email: session?.user?.email || "" },
  });

  const orgFilter = currentUser?.organizationId ? { organizationId: currentUser.organizationId } : {};

  const documents = await db.document.findMany({
    where: orgFilter,
    include: {
      uploadedBy: { select: { id: true, fullName: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Kunci penyimpanan tidak pernah dikirim ke klien (hanya URL unduh berotorisasi).
  return <DocumentsClientView initialDocuments={JSON.parse(JSON.stringify(documents.map(toDocumentDto)))} />;
}
