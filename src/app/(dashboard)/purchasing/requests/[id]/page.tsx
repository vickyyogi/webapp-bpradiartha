"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  FileCheck,
  ArrowLeft,
  ShoppingCart,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Clock,
  UserCheck,
  Building,
  DollarSign,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function PurchaseRequestDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [request, setRequest] = useState<any>(null);
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Workflow Approval Action State
  const [actionComment, setActionComment] = useState("");
  const [processingAction, setProcessingAction] = useState(false);

  // Issue PO Modal State
  const [poOpen, setPoOpen] = useState(false);
  const [issuingPO, setIssuingPO] = useState(false);
  const [poForm, setPoForm] = useState({
    vendorId: "",
    paymentTerms: "NET 14 Hari",
    expectedDeliveryDate: "",
    includeTax: true,
    notes: "",
  });

  const fetchDetail = async () => {
    try {
      setLoading(true);
      const [prRes, vndRes] = await Promise.all([
        fetch(`/api/purchasing/requests/${id}`),
        fetch("/api/purchasing/vendors"),
      ]);

      if (!prRes.ok) throw new Error("Gagal mengambil data pengadaan.");

      const prData = await prRes.json();
      setRequest(prData.request);

      if (vndRes.ok) {
        const vndData = await vndRes.json();
        setVendors(vndData.vendors || []);
      }
    } catch (err: any) {
      console.error(err);
      setFeedbackMsg({ type: "error", text: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchDetail();
  }, [id]);

  const handleWorkflowAction = async (action: "APPROVE" | "REJECT" | "RETURN") => {
    setProcessingAction(true);
    setFeedbackMsg(null);
    try {
      const res = await fetch(`/api/purchasing/requests/${id}/workflow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, comment: actionComment }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memproses approval.");

      setFeedbackMsg({ type: "success", text: data.message || "Aksi approval berhasil disimpan!" });
      setActionComment("");
      fetchDetail();
    } catch (err: any) {
      setFeedbackMsg({ type: "error", text: err.message });
    } finally {
      setProcessingAction(false);
    }
  };

  const handleIssuePO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!poForm.vendorId) {
      setFeedbackMsg({ type: "error", text: "Pilih vendor rekanan penyedia." });
      return;
    }

    setIssuingPO(true);
    setFeedbackMsg(null);
    try {
      const itemsForPO = request.items.map((it: any) => ({
        itemName: it.itemName,
        unit: it.unit,
        quantityOrdered: it.quantity,
        unitPrice: it.estimatedPrice,
        itemType: it.itemType,
        inventoryItemId: it.inventoryItemId,
      }));

      const res = await fetch("/api/purchasing/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorId: poForm.vendorId,
          purchaseRequestId: request.id,
          expectedDeliveryDate: poForm.expectedDeliveryDate,
          paymentTerms: poForm.paymentTerms,
          includeTax: poForm.includeTax,
          notes: poForm.notes,
          items: itemsForPO,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menerbitkan Purchase Order.");

      setFeedbackMsg({
        type: "success",
        text: `Purchase Order ${data.purchaseOrder?.poNumber} berhasil diterbitkan!`,
      });
      setPoOpen(false);
      fetchDetail();
    } catch (err: any) {
      setFeedbackMsg({ type: "error", text: err.message });
    } finally {
      setIssuingPO(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Memuat detail pengadaan...</div>;
  }

  if (!request) {
    return (
      <div className="p-8 text-center space-y-4">
        <p className="text-red-600 font-semibold">Pengadaan tidak ditemukan.</p>
        <Link href="/purchasing/requests">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Kembali
          </Button>
        </Link>
      </div>
    );
  }

  const activeInstance = request.workflowInstances?.[0];
  const canApprove = request.status === "SUBMITTED";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Link href="/purchasing" className="hover:underline">
              Pengadaan
            </Link>
            <span>/</span>
            <Link href="/purchasing/requests" className="hover:underline">
              Purchase Requests
            </Link>
            <span>/</span>
            <span className="font-mono">{request.requestNumber}</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{request.title}</h1>
            <span className="text-xs font-mono bg-muted text-muted-foreground px-2 py-1 rounded">
              {request.requestNumber}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/purchasing/requests">
            <Button variant="outline" size="sm" className="gap-1.5">
              <ArrowLeft className="h-4 w-4" /> Kembali
            </Button>
          </Link>

          {request.status === "APPROVED" && (
            <Button
              size="sm"
              onClick={() => setPoOpen(true)}
              className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
            >
              <ShoppingCart className="h-4 w-4" /> Terbitkan Purchase Order (PO)
            </Button>
          )}
        </div>
      </div>

      {/* Notifications */}
      {feedbackMsg && (
        <div
          className={`p-4 rounded-lg text-sm flex items-center justify-between ${
            feedbackMsg.type === "success"
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          <span>{feedbackMsg.text}</span>
          <button onClick={() => setFeedbackMsg(null)} className="text-xs font-semibold hover:underline">
            Tutup
          </button>
        </div>
      )}

      {/* Top Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-primary shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
              Status Persetujuan
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <Badge
              variant="outline"
              className={
                request.status === "APPROVED"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 text-xs px-2.5 py-0.5"
                  : request.status === "SUBMITTED"
                  ? "bg-amber-50 text-amber-700 border-amber-200 text-xs px-2.5 py-0.5"
                  : request.status === "REJECTED"
                  ? "bg-red-50 text-red-700 border-red-200 text-xs px-2.5 py-0.5"
                  : "bg-blue-50 text-blue-700 border-blue-200 text-xs px-2.5 py-0.5"
              }
            >
              {request.status}
            </Badge>
            <p className="text-xs text-muted-foreground mt-1">
              Tanggal Diajukan: {new Date(request.createdAt).toLocaleDateString("id-ID")}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
              Pemohon & Divisi
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-sm font-bold">{request.requester?.fullName}</div>
            <p className="text-xs text-muted-foreground">
              {request.department?.name || "Operasional"} • {request.branch?.name || "Kantor Pusat"}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
              Target Penggunaan
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-sm font-semibold">
              {request.requiredDate
                ? new Date(request.requiredDate).toLocaleDateString("id-ID", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })
                : "Secepatnya"}
            </div>
            <p className="text-xs text-muted-foreground truncate">{request.purpose}</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
              Total Estimasi Biaya
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-lg font-extrabold font-mono text-primary">
              Rp {request.totalEstimatedAmount?.toLocaleString("id-ID")}
            </div>
            <p className="text-xs text-muted-foreground">{request.items?.length || 0} item barang</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Grid: Items Table vs Workflow Approval Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Requested Items Table */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold">Rincian Barang yang Diminta</CardTitle>
              <CardDescription>Daftar kuantitas dan perkiraan harga satuan pengadaan</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground text-left bg-muted/30">
                      <th className="py-2.5 px-3 font-semibold">Nama Barang</th>
                      <th className="py-2.5 px-3 font-semibold text-center">Satuan</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Kuantitas</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Est. Harga Satuan</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Total Est. Harga</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {request.items?.map((it: any) => (
                      <tr key={it.id} className="hover:bg-muted/40 transition-colors">
                        <td className="py-2.5 px-3 font-medium">
                          {it.itemName}
                          {it.notes && <span className="block text-xs text-muted-foreground">{it.notes}</span>}
                        </td>
                        <td className="py-2.5 px-3 text-center text-xs text-muted-foreground">{it.unit}</td>
                        <td className="py-2.5 px-3 text-right font-bold">{it.quantity}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-xs">
                          Rp {it.estimatedPrice?.toLocaleString("id-ID")}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-xs">
                          Rp {it.totalPrice?.toLocaleString("id-ID")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t bg-muted/20 font-bold">
                      <td colSpan={4} className="py-3 px-3 text-right text-xs">
                        Total Estimasi:
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-sm text-primary">
                        Rp {request.totalEstimatedAmount?.toLocaleString("id-ID")}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Linked POs if any */}
          {request.purchaseOrders?.length > 0 && (
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-blue-600" />
                  Purchase Order Terbit
                </CardTitle>
                <CardDescription>Pesanan resmi yang diterbitkan berdasarkan PR ini</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {request.purchaseOrders.map((po: any) => (
                    <Link
                      key={po.id}
                      href={`/purchasing/orders/${po.id}`}
                      className="p-3 rounded-lg border bg-card hover:bg-muted/40 transition-colors flex items-center justify-between block"
                    >
                      <div>
                        <span className="font-bold text-sm text-primary">{po.poNumber}</span>
                        <div className="text-xs text-muted-foreground">Vendor: {po.vendor?.name}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono font-bold text-xs">
                          Rp {po.totalAmount?.toLocaleString("id-ID")}
                        </div>
                        <Badge variant="outline" className="text-[10px]">
                          {po.status}
                        </Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Col: Workflow & Approval Engine (Section 21) */}
        <div className="space-y-6">
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                Alur Persetujuan (Workflow)
              </CardTitle>
              <CardDescription>
                {activeInstance?.workflow?.name || "Persetujuan Pengadaan Berjenjang"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Approval Steps Checklist */}
              {activeInstance?.workflow?.steps && (
                <div className="p-3 rounded-lg bg-muted/40 space-y-2 border">
                  <div className="text-xs font-semibold text-muted-foreground uppercase">Tahapan Approval</div>
                  {activeInstance.workflow.steps.map((st: any) => {
                    const isPassed =
                      request.status === "APPROVED" || (activeInstance.currentStep > st.stepOrder && request.status !== "REJECTED");
                    const isCurrent = activeInstance.currentStep === st.stepOrder && request.status === "SUBMITTED";

                    return (
                      <div key={st.id} className="flex items-center gap-2 text-xs">
                        {isPassed ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                        ) : isCurrent ? (
                          <div className="h-4 w-4 rounded-full border-2 border-amber-500 bg-amber-50 flex items-center justify-center text-[9px] font-bold text-amber-700">
                            {st.stepOrder}
                          </div>
                        ) : (
                          <div className="h-4 w-4 rounded-full border border-muted-foreground/40 flex-shrink-0" />
                        )}
                        <span className={isCurrent ? "font-bold text-foreground" : "text-muted-foreground"}>
                          {st.name}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Action Buttons for Approver */}
              {canApprove && (
                <div className="p-4 rounded-lg border bg-card space-y-3">
                  <Label htmlFor="comment" className="text-xs font-semibold">
                    Catatan / Komentar Pejabat Penyetuju
                  </Label>
                  <Input
                    id="comment"
                    placeholder="Contoh: Disetujui, segera tindak lanjuti PO."
                    value={actionComment}
                    onChange={(e) => setActionComment(e.target.value)}
                  />

                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <Button
                      size="sm"
                      onClick={() => handleWorkflowAction("APPROVE")}
                      disabled={processingAction}
                      className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <CheckCircle2 className="h-4 w-4" /> Setujui (Approve)
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleWorkflowAction("REJECT")}
                      disabled={processingAction}
                      className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50"
                    >
                      <XCircle className="h-4 w-4" /> Tolak (Reject)
                    </Button>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleWorkflowAction("RETURN")}
                    disabled={processingAction}
                    className="w-full gap-1.5 text-xs text-amber-700"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Kembalikan untuk Revisi
                  </Button>
                </div>
              )}

              {/* Action Log History */}
              <div className="space-y-3 pt-2">
                <div className="text-xs font-semibold text-muted-foreground uppercase">
                  Catatan Riwayat Aksi
                </div>
                <div className="space-y-3">
                  {activeInstance?.actions?.map((act: any) => (
                    <div key={act.id} className="p-3 rounded-lg border text-xs space-y-1 bg-card">
                      <div className="flex items-center justify-between">
                        <Badge
                          variant="outline"
                          className={
                            act.action === "APPROVE"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]"
                              : act.action === "REJECT"
                              ? "bg-red-50 text-red-700 border-red-200 text-[10px]"
                              : "bg-blue-50 text-blue-700 border-blue-200 text-[10px]"
                          }
                        >
                          {act.action}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(act.createdAt).toLocaleDateString("id-ID", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <div className="font-semibold text-foreground">{act.actor?.fullName}</div>
                      {act.comment && <p className="text-muted-foreground italic">"{act.comment}"</p>}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modal: Terbitkan Purchase Order (PO) */}
      <Dialog open={poOpen} onOpenChange={setPoOpen}>
        <DialogContent className="sm:max-w-[540px]">
          <DialogHeader>
            <DialogTitle>Terbitkan Purchase Order (PO) Resmi</DialogTitle>
            <DialogDescription>
              Buat surat pesanan resmi kepada vendor rekanan terpilih berdasarkan PR{" "}
              <strong>{request.requestNumber}</strong>.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleIssuePO} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="poVendor">Pilih Rekanan / Vendor *</Label>
              <select
                id="poVendor"
                value={poForm.vendorId}
                onChange={(e) => setPoForm({ ...poForm, vendorId: e.target.value })}
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                required
              >
                <option value="">-- Pilih Vendor Penyedia --</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.category})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="poTerms">Syarat Pembayaran</Label>
                <select
                  id="poTerms"
                  value={poForm.paymentTerms}
                  onChange={(e) => setPoForm({ ...poForm, paymentTerms: e.target.value })}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="NET 14 Hari">NET 14 Hari (Invoice)</option>
                  <option value="NET 30 Hari">NET 30 Hari (Invoice)</option>
                  <option value="COD / Tunai Saat Terima">COD / Tunai Saat Terima</option>
                  <option value="DP 50% / Pelunasan">DP 50% / Pelunasan</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="poDeliveryDate">Target Tanggal Pengiriman</Label>
                <Input
                  id="poDeliveryDate"
                  type="date"
                  value={poForm.expectedDeliveryDate}
                  onChange={(e) => setPoForm({ ...poForm, expectedDeliveryDate: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="incTax"
                checked={poForm.includeTax}
                onChange={(e) => setPoForm({ ...poForm, includeTax: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="incTax" className="text-xs cursor-pointer">
                Kenakan PPN 11% Faktur Pajak Resmi
              </Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="poNotes">Catatan untuk Vendor (Instruksi Pengiriman)</Label>
              <Input
                id="poNotes"
                placeholder="Contoh: Kirimkan ke Kantor Pusat BPR Lt. 1 Bagian Umum"
                value={poForm.notes}
                onChange={(e) => setPoForm({ ...poForm, notes: e.target.value })}
              />
            </div>

            <div className="p-3 rounded-lg bg-muted/40 text-xs space-y-1">
              <div className="flex justify-between">
                <span>Subtotal Barang:</span>
                <span className="font-mono">Rp {request.totalEstimatedAmount?.toLocaleString("id-ID")}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Estimasi PPN 11%:</span>
                <span className="font-mono">
                  {poForm.includeTax
                    ? `Rp ${(request.totalEstimatedAmount * 0.11).toLocaleString("id-ID")}`
                    : "Rp 0"}
                </span>
              </div>
              <div className="flex justify-between font-bold border-t pt-1 text-foreground">
                <span>Total Komitmen PO:</span>
                <span className="font-mono text-primary">
                  Rp{" "}
                  {(
                    request.totalEstimatedAmount + (poForm.includeTax ? request.totalEstimatedAmount * 0.11 : 0)
                  ).toLocaleString("id-ID")}
                </span>
              </div>
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setPoOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={issuingPO}>
                {issuingPO ? "Menerbitkan..." : "Terbitkan PO Resmi"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
