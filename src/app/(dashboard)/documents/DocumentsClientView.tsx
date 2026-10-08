"use client";

import { useState } from "react";
import { PlusCircle, Search, FileText, Download, Trash2, FileCheck, Image as ImageIcon, Eye, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type DocumentItem = {
  id: string;
  ownerType: string;
  ownerId: string;
  documentType: "KTP" | "KK" | "INCOME_PROOF" | "BUSINESS_DOC" | "SURVEY_PHOTO" | "COLLATERAL_DOC" | "APPROVAL_DOC" | "OTHER";
  fileName: string;
  filePath: string;
  fileExt: string | null;
  fileSize: number;
  mimeType: string;
  status: string;
  notes: string | null;
  createdAt: string | Date;
  uploadedBy: { id: string; fullName: string; email: string };
};

const DOC_TYPE_CONFIG: Record<
  DocumentItem["documentType"],
  { label: string; variant: "default" | "secondary" | "outline" | "success" | "warning" | "info" | "purple" | "destructive" }
> = {
  KTP: { label: "KTP Elektronik", variant: "info" },
  KK: { label: "Kartu Keluarga (KK)", variant: "purple" },
  INCOME_PROOF: { label: "Slip Gaji / Rekening Koran", variant: "warning" },
  BUSINESS_DOC: { label: "Izin Usaha (NIB/SIUP)", variant: "secondary" },
  SURVEY_PHOTO: { label: "Foto Survey Lapangan", variant: "success" },
  COLLATERAL_DOC: { label: "Dokumen Agunan (SHM/BPKB)", variant: "destructive" },
  APPROVAL_DOC: { label: "Dokumen SPK & PK", variant: "default" },
  OTHER: { label: "Lainnya", variant: "outline" },
};

function formatBytes(bytes: number, decimals = 1) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

export function DocumentsClientView({
  initialDocuments,
}: {
  initialDocuments: DocumentItem[];
}) {
  const [documents, setDocuments] = useState<DocumentItem[]>(initialDocuments);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<DocumentItem["documentType"]>("KTP");
  const [notes, setNotes] = useState("");

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setErrorMessage("Silakan pilih file terlebih dahulu");
      return;
    }

    setIsUploading(true);
    setErrorMessage("");

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("documentType", docType);
      formData.append("notes", notes);
      formData.append("ownerType", "INTERNAL");
      formData.append("ownerId", "general");

      const res = await fetch("/api/documents", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal mengunggah berkas");

      setDocuments([json.data, ...documents]);
      setIsUploadOpen(false);
      setSelectedFile(null);
      setNotes("");
    } catch (err: any) {
      setErrorMessage(err.message || "Gagal mengunggah berkas");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus dokumen ini dari sistem?")) return;
    try {
      const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Gagal menghapus dokumen");
      setDocuments(documents.filter((d) => d.id !== id));
    } catch (e: any) {
      alert(e.message);
    }
  };

  const filteredDocs = documents.filter((d) => {
    const matchesType = typeFilter === "ALL" || d.documentType === typeFilter;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !searchQuery ||
      d.fileName.toLowerCase().includes(q) ||
      (d.notes && d.notes.toLowerCase().includes(q)) ||
      d.uploadedBy.fullName.toLowerCase().includes(q);

    return matchesType && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Manajemen Dokumen Digital (Section 17)</h1>
          <p className="text-muted-foreground mt-1">
            Repositori penyimpanan terpusat berkas identitas debitur, bukti penghasilan, foto survey, agunan, dan perjanjian kredit.
          </p>
        </div>
        <Button onClick={() => { setErrorMessage(""); setIsUploadOpen(true); }} className="gap-2">
          <Upload className="h-4 w-4" />
          Unggah Dokumen Baru
        </Button>
      </div>

      {/* Filter Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari berdasarkan nama berkas, catatan, atau pengunggah..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">Kategori:</span>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-xs"
              >
                <option value="ALL">Semua Jenis Berkas ({documents.length})</option>
                {Object.entries(DOC_TYPE_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Documents Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Arsip Dokumen ({filteredDocs.length})</CardTitle>
          <CardDescription>
            Dokumen disimpan dengan enkripsi metadata dan validasi tipe berkas aman sesuai SOP perbankan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredDocs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Tidak ada dokumen yang ditemukan.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama Berkas</TableHead>
                    <TableHead>Jenis Dokumen</TableHead>
                    <TableHead>Ukuran</TableHead>
                    <TableHead>Pengunggah</TableHead>
                    <TableHead>Tanggal Unggah</TableHead>
                    <TableHead>Keterangan</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDocs.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell>
                        <div className="font-semibold text-sm flex items-center gap-2">
                          <FileText className="h-4 w-4 text-primary shrink-0" />
                          <span className="truncate max-w-[250px]">{doc.fileName}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={DOC_TYPE_CONFIG[doc.documentType]?.variant || "secondary"} className="text-[11px]">
                          {DOC_TYPE_CONFIG[doc.documentType]?.label || doc.documentType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        {formatBytes(doc.fileSize)}
                      </TableCell>
                      <TableCell>
                        <div className="text-xs font-medium">{doc.uploadedBy.fullName}</div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(doc.createdAt).toLocaleDateString("id-ID")}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                        {doc.notes || "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <a href={doc.filePath} target="_blank" rel="noopener noreferrer">
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Buka / Unduh Berkas">
                              <Download className="h-4 w-4 text-primary" />
                            </Button>
                          </a>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(doc.id)}
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            title="Hapus Dokumen"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Modal */}
      <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <form onSubmit={handleUpload}>
            <DialogHeader>
              <DialogTitle>Unggah Dokumen Baru</DialogTitle>
              <DialogDescription>
                Pilih berkas dari perangkat Anda (Maks. 10MB; format PDF, JPG, PNG, DOCX).
              </DialogDescription>
            </DialogHeader>

            {errorMessage && (
              <div className="bg-destructive/15 text-destructive p-3 rounded-md text-sm my-2">
                {errorMessage}
              </div>
            )}

            <div className="space-y-4 py-3">
              <div>
                <label className="text-xs font-medium">Pilih Berkas *</label>
                <Input
                  type="file"
                  required
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="mt-1 text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-medium">Jenis Dokumen *</label>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value as DocumentItem["documentType"])}
                  className="w-full mt-1 h-9 rounded-md border border-input bg-background px-3 py-1 text-xs"
                >
                  {Object.entries(DOC_TYPE_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium">Catatan / Keterangan Berkas</label>
                <Input
                  placeholder="Contoh: Berkas asli telah diverifikasi oleh marketing..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsUploadOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={isUploading}>
                {isUploading ? "Mengunggah..." : "Unggah Berkas"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
