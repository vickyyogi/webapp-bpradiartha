"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ShoppingCart,
  ArrowLeft,
  PackageCheck,
  Building2,
  Calendar,
  DollarSign,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Boxes,
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

export default function PurchaseOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // GRN Receipt Modal State
  const [grnOpen, setGrnOpen] = useState(false);
  const [receiving, setReceiving] = useState(false);
  const [receiptForm, setReceiptForm] = useState<{
    deliveryNoteNumber: string;
    receiptDate: string;
    notes: string;
    items: Array<{
      poItemId: string;
      itemName: string;
      unit: string;
      maxQty: number;
      quantityReceived: number;
      condition: string;
      autoStockToInventory: boolean;
    }>;
  }>({
    deliveryNoteNumber: "",
    receiptDate: new Date().toISOString().split("T")[0],
    notes: "",
    items: [],
  });

  const fetchDetail = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/purchasing/orders/${id}`);
      if (!res.ok) throw new Error("Gagal mengambil data purchase order.");

      const data = await res.json();
      setOrder(data.order);
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

  const openReceiptModal = () => {
    if (!order) return;
    const initialItems = order.items.map((it: any) => {
      const remainingQty = Math.max(0, it.quantityOrdered - it.quantityReceived);
      return {
        poItemId: it.id,
        itemName: it.itemName,
        unit: it.unit,
        maxQty: remainingQty,
        quantityReceived: remainingQty,
        condition: "GOOD",
        autoStockToInventory: true,
      };
    });

    setReceiptForm({
      deliveryNoteNumber: "",
      receiptDate: new Date().toISOString().split("T")[0],
      notes: "",
      items: initialItems,
    });
    setGrnOpen(true);
  };

  const handleItemReceiptChange = (index: number, field: string, value: any) => {
    const updated = [...receiptForm.items];
    updated[index] = { ...updated[index], [field]: value };
    setReceiptForm({ ...receiptForm, items: updated });
  };

  const handleSubmitReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    setReceiving(true);
    setFeedbackMsg(null);
    try {
      const itemsToSubmit = receiptForm.items
        .filter((it) => it.quantityReceived > 0)
        .map((it) => ({
          poItemId: it.poItemId,
          quantityReceived: Number(it.quantityReceived),
          condition: it.condition,
          autoStockToInventory: it.autoStockToInventory,
        }));

      if (itemsToSubmit.length === 0) {
        throw new Error("Masukkan kuantitas barang yang diterima minimal 1 item.");
      }

      const res = await fetch("/api/purchasing/receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purchaseOrderId: order.id,
          deliveryNoteNumber: receiptForm.deliveryNoteNumber,
          receiptDate: receiptForm.receiptDate,
          notes: receiptForm.notes,
          items: itemsToSubmit,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mencatat penerimaan barang.");

      setFeedbackMsg({
        type: "success",
        text: `${data.message || "Penerimaan barang berhasil dicatat!"}`,
      });
      setGrnOpen(false);
      fetchDetail();
    } catch (err: any) {
      setFeedbackMsg({ type: "error", text: err.message });
    } finally {
      setReceiving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Memuat detail Purchase Order...</div>;
  }

  if (!order) {
    return (
      <div className="p-8 text-center space-y-4">
        <p className="text-red-600 font-semibold">Purchase Order tidak ditemukan.</p>
        <Link href="/purchasing/orders">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Kembali
          </Button>
        </Link>
      </div>
    );
  }

  const isCompleted = order.status === "COMPLETED";

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
            <Link href="/purchasing/orders" className="hover:underline">
              Purchase Orders
            </Link>
            <span>/</span>
            <span className="font-mono">{order.poNumber}</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">Purchase Order #{order.poNumber}</h1>
            <Badge
              variant="outline"
              className={
                order.status === "COMPLETED"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 text-xs px-2.5 py-0.5"
                  : order.status === "PARTIAL_RECEIVED"
                  ? "bg-amber-50 text-amber-700 border-amber-200 text-xs px-2.5 py-0.5"
                  : order.status === "ISSUED"
                  ? "bg-blue-50 text-blue-700 border-blue-200 text-xs px-2.5 py-0.5"
                  : "bg-gray-100 text-gray-700 border-gray-300 text-xs px-2.5 py-0.5"
              }
            >
              {order.status}
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/purchasing/orders">
            <Button variant="outline" size="sm" className="gap-1.5">
              <ArrowLeft className="h-4 w-4" /> Kembali
            </Button>
          </Link>

          {!isCompleted && (
            <Button
              size="sm"
              onClick={openReceiptModal}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <PackageCheck className="h-4 w-4" /> Catat Penerimaan Barang (GRN)
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

      {/* Top 4 Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Vendor Card */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
              Vendor Penyedia
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-sm font-bold text-foreground">{order.vendor?.name}</div>
            <p className="text-xs text-muted-foreground">
              {order.vendor?.phone || "-"} • {order.vendor?.email || "-"}
            </p>
            <p className="text-xs text-muted-foreground truncate">{order.vendor?.address || "-"}</p>
          </CardContent>
        </Card>

        {/* Banking details */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
              Rekening & Pembayaran
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-xs font-bold">
              {order.vendor?.bankName}: <span className="font-mono">{order.vendor?.bankAccount || "-"}</span>
            </div>
            <p className="text-xs text-muted-foreground">a/n {order.vendor?.bankHolder || "-"}</p>
            <p className="text-xs font-medium text-primary">Syarat: {order.paymentTerms || "NET 14 Hari"}</p>
          </CardContent>
        </Card>

        {/* Dates Card */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
              Tanggal & Pengiriman
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-xs text-muted-foreground">
              Tanggal PO: <span className="font-medium text-foreground">{new Date(order.poDate).toLocaleDateString("id-ID")}</span>
            </div>
            <div className="text-xs text-muted-foreground">
              Target Tiba:{" "}
              <span className="font-medium text-foreground">
                {order.expectedDeliveryDate
                  ? new Date(order.expectedDeliveryDate).toLocaleDateString("id-ID")
                  : "Sesuai kesepakatan"}
              </span>
            </div>
            {order.purchaseRequest && (
              <p className="text-xs text-muted-foreground">
                Reff PR:{" "}
                <Link
                  href={`/purchasing/requests/${order.purchaseRequest.id}`}
                  className="font-mono text-primary hover:underline"
                >
                  {order.purchaseRequest.requestNumber}
                </Link>
              </p>
            )}
          </CardContent>
        </Card>

        {/* Total Value */}
        <Card className="border-l-4 border-l-primary shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
              Nilai Pembelian
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-lg font-bold font-mono text-primary">
              Rp {order.totalAmount?.toLocaleString("id-ID")}
            </div>
            <p className="text-xs text-muted-foreground">
              Subtotal: Rp {order.subtotal?.toLocaleString("id-ID")} • PPN: Rp{" "}
              {order.taxAmount?.toLocaleString("id-ID")}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Items Ordered vs Received Table */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold">Rincian Barang & Progres Penerimaan Fisik</CardTitle>
          <CardDescription>
            Monitoring perbandingan kuantitas barang yang dipesan dengan yang telah diterima di gudang
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground text-left bg-muted/30">
                  <th className="py-3 px-4 font-semibold">Nama Barang</th>
                  <th className="py-3 px-4 font-semibold text-center">Satuan</th>
                  <th className="py-3 px-4 font-semibold text-right">Dipesan</th>
                  <th className="py-3 px-4 font-semibold text-right">Diterima</th>
                  <th className="py-3 px-4 font-semibold text-center">Status Pemenuhan</th>
                  <th className="py-3 px-4 font-semibold text-right">Harga Satuan</th>
                  <th className="py-3 px-4 font-semibold text-right">Total Nilai</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {order.items?.map((it: any) => {
                  const isFullyReceived = it.quantityReceived >= it.quantityOrdered;
                  const percent = Math.min(100, Math.round((it.quantityReceived / it.quantityOrdered) * 100));

                  return (
                    <tr key={it.id} className="hover:bg-muted/40 transition-colors">
                      <td className="py-3 px-4 font-medium">
                        {it.itemName}
                        {it.notes && <span className="block text-xs text-muted-foreground">{it.notes}</span>}
                      </td>
                      <td className="py-3 px-4 text-center text-xs text-muted-foreground">{it.unit}</td>
                      <td className="py-3 px-4 text-right font-bold">{it.quantityOrdered}</td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-600">
                        {it.quantityReceived}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <Badge
                            variant="outline"
                            className={
                              isFullyReceived
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]"
                                : it.quantityReceived > 0
                                ? "bg-amber-50 text-amber-700 border-amber-200 text-[10px]"
                                : "bg-gray-100 text-gray-700 border-gray-300 text-[10px]"
                            }
                          >
                            {percent}% ({it.quantityReceived}/{it.quantityOrdered})
                          </Badge>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs">
                        Rp {it.unitPrice?.toLocaleString("id-ID")}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-xs">
                        Rp {it.totalPrice?.toLocaleString("id-ID")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Goods Receipts (GRN) History */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <PackageCheck className="h-4 w-4 text-emerald-600" />
              Riwayat Berita Acara Penerimaan Barang (GRN)
            </CardTitle>
            <CardDescription>
              Catatan dokumen surat jalan dan fisik barang yang telah diverifikasi di gudang
            </CardDescription>
          </div>
          {!isCompleted && (
            <Button size="sm" onClick={openReceiptModal} className="gap-1 text-xs">
              <PackageCheck className="h-3.5 w-3.5" /> Terima Kiriman Baru
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {order.goodsReceipts?.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground bg-muted/20 rounded-lg">
              Belum ada pencatatan penerimaan barang untuk Purchase Order ini.
            </div>
          ) : (
            <div className="space-y-3">
              {order.goodsReceipts.map((grn: any) => (
                <div key={grn.id} className="p-4 rounded-lg border bg-card space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 border-b pb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-primary">{grn.receiptNumber}</span>
                      <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                        {grn.status}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Tanggal Terima: {new Date(grn.receiptDate).toLocaleDateString("id-ID")} • Petugas:{" "}
                      <strong>{grn.receivedBy?.fullName || "Staff"}</strong>
                    </span>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    No. Surat Jalan Vendor: <strong className="text-foreground">{grn.deliveryNoteNumber || "-"}</strong>
                    {grn.notes && <span> • Catatan: "{grn.notes}"</span>}
                  </div>

                  {/* Received items list */}
                  <div className="bg-muted/30 p-2.5 rounded text-xs space-y-1 mt-2">
                    <span className="font-semibold text-muted-foreground">Item Diterima:</span>
                    <ul className="list-disc list-inside space-y-0.5">
                      {grn.items?.map((gi: any) => (
                        <li key={gi.id}>
                          <strong>{gi.itemName}</strong>: {gi.quantityReceived} {gi.unit} (Kondisi: {gi.condition})
                          {gi.isStocked && (
                            <span className="ml-2 text-emerald-600 font-semibold">• Stok Inventaris Terupdate ✅</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal: Catat Penerimaan Barang (GRN) */}
      <Dialog open={grnOpen} onOpenChange={setGrnOpen}>
        <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Formulir Penerimaan Barang (Goods Receipt)</DialogTitle>
            <DialogDescription>
              Catat kedatangan fisik barang dari vendor berdasarkan PO <strong>{order.poNumber}</strong>.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitReceipt} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="delNote">Nomor Surat Jalan Vendor *</Label>
                <Input
                  id="delNote"
                  placeholder="Contoh: SJ-2026/04/182"
                  value={receiptForm.deliveryNoteNumber}
                  onChange={(e) => setReceiptForm({ ...receiptForm, deliveryNoteNumber: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="recDate">Tanggal Penerimaan Fisik</Label>
                <Input
                  id="recDate"
                  type="date"
                  value={receiptForm.receiptDate}
                  onChange={(e) => setReceiptForm({ ...receiptForm, receiptDate: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="recNotes">Catatan / Kondisi Pengiriman</Label>
              <Input
                id="recNotes"
                placeholder="Contoh: Kemasan tersegel rapi, diantar oleh kurir vendor"
                value={receiptForm.notes}
                onChange={(e) => setReceiptForm({ ...receiptForm, notes: e.target.value })}
              />
            </div>

            {/* Item quantities */}
            <div className="space-y-3 pt-2">
              <Label className="font-bold text-sm">Verifikasi Jumlah Fisik Barang</Label>
              <div className="space-y-3">
                {receiptForm.items.map((item, idx) => (
                  <div key={idx} className="p-3 rounded-lg border bg-muted/20 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-foreground">{item.itemName}</span>
                      <span className="text-muted-foreground">
                        Sisa Belum Diterima: <strong>{item.maxQty} {item.unit}</strong>
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 items-center">
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">Kuantitas Diterima Saat Ini ({item.unit})</Label>
                        <Input
                          type="number"
                          min="0"
                          max={item.maxQty}
                          value={item.quantityReceived}
                          onChange={(e) =>
                            handleItemReceiptChange(idx, "quantityReceived", Number(e.target.value))
                          }
                          className="h-8 text-xs"
                          required
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">Kondisi Fisik</Label>
                        <select
                          value={item.condition}
                          onChange={(e) => handleItemReceiptChange(idx, "condition", e.target.value)}
                          className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        >
                          <option value="GOOD">Kondisi Baik & Lengkap</option>
                          <option value="DAMAGED">Terdapat Kerusakan Fisik</option>
                          <option value="INCOMPLETE">Tidak Lengkap / Kurang</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="checkbox"
                        id={`autoStock-${idx}`}
                        checked={item.autoStockToInventory}
                        onChange={(e) => handleItemReceiptChange(idx, "autoStockToInventory", e.target.checked)}
                        className="h-3.5 w-3.5 rounded border-gray-300"
                      />
                      <Label htmlFor={`autoStock-${idx}`} className="text-[11px] text-muted-foreground cursor-pointer">
                        Otomatis tambahkan barang ini ke master stok inventaris (Section 18)
                      </Label>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setGrnOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={receiving}>
                {receiving ? "Menyimpan..." : "Simpan Berita Acara Penerimaan (GRN)"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
