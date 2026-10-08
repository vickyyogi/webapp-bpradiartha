"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Boxes,
  ArrowLeft,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  Clock,
  MapPin,
  Tag,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
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

export default function InventoryItemDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [item, setItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Movement Modal
  const [movementOpen, setMovementOpen] = useState(false);
  const [moving, setMoving] = useState(false);
  const [movementForm, setMovementForm] = useState({
    type: "STOCK_IN",
    quantity: 1,
    referenceNumber: "",
    notes: "",
  });

  const fetchItemDetail = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/inventory/items/${id}`);
      if (!res.ok) {
        throw new Error("Gagal mengambil data barang.");
      }
      const data = await res.json();
      setItem(data.item);
    } catch (err: any) {
      console.error(err);
      setFeedbackMsg({ type: "error", text: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchItemDetail();
  }, [id]);

  const handleRecordMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item) return;
    setMoving(true);
    setFeedbackMsg(null);
    try {
      const res = await fetch("/api/inventory/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: item.id,
          ...movementForm,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal mencatat mutasi stok.");
      }

      setFeedbackMsg({
        type: "success",
        text: `Mutasi berhasil! Stok sekarang: ${data.newStock} ${item.unit}.`,
      });
      setMovementOpen(false);
      fetchItemDetail();
    } catch (err: any) {
      setFeedbackMsg({ type: "error", text: err.message });
    } finally {
      setMoving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Memuat data barang...</div>;
  }

  if (!item) {
    return (
      <div className="p-8 text-center space-y-4">
        <p className="text-red-600 font-semibold">Barang tidak ditemukan.</p>
        <Link href="/inventory/items">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Kembali ke Daftar Barang
          </Button>
        </Link>
      </div>
    );
  }

  const isOutOfStock = item.currentStock === 0;
  const isLowStock = item.currentStock <= item.minStock;

  return (
    <div className="space-y-6">
      {/* Navigation & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Link href="/inventory" className="hover:underline">
              Inventaris
            </Link>
            <span>/</span>
            <Link href="/inventory/items" className="hover:underline">
              Master Barang
            </Link>
            <span>/</span>
            <span className="font-mono">{item.itemCode}</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{item.name}</h1>
            <span className="text-xs font-mono bg-muted text-muted-foreground px-2 py-1 rounded">
              {item.itemCode}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/inventory/items">
            <Button variant="outline" size="sm" className="gap-1.5">
              <ArrowLeft className="h-4 w-4" /> Kembali
            </Button>
          </Link>
          <Button
            size="sm"
            onClick={() => {
              setMovementForm({ type: "STOCK_IN", quantity: 1, referenceNumber: "", notes: "" });
              setMovementOpen(true);
            }}
            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <ArrowDownLeft className="h-4 w-4" /> Stok Masuk
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setMovementForm({ type: "STOCK_OUT", quantity: 1, referenceNumber: "", notes: "" });
              setMovementOpen(true);
            }}
            variant="outline"
            className="gap-1.5 text-amber-700 border-amber-300 hover:bg-amber-50"
          >
            <ArrowUpRight className="h-4 w-4" /> Stok Keluar
          </Button>
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

      {/* Top Details Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-primary shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
              Sisa Stok Sekarang
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span
                className={`text-3xl font-extrabold ${
                  isOutOfStock ? "text-red-600" : isLowStock ? "text-amber-600" : "text-emerald-600"
                }`}
              >
                {item.currentStock}
              </span>
              <span className="text-sm font-medium text-muted-foreground">{item.unit}</span>
            </div>
            <div className="mt-2">
              {isOutOfStock ? (
                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-[10px]">
                  Stok Habis
                </Badge>
              ) : isLowStock ? (
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">
                  Batas Min. {item.minStock} {item.unit} (Segera Pesan)
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                  Persediaan Aman (Min. {item.minStock})
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
              Kategori & Satuan
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-lg font-bold">{item.category}</div>
            <p className="text-xs text-muted-foreground">Satuan hitung: {item.unit}</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
              Lokasi Penyimpanan
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-base font-semibold flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              {item.storageLocation || "Gudang Kantor"}
            </div>
            <p className="text-xs text-muted-foreground">Cabang: {item.branch?.name || "Kantor Pusat"}</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
              Estimasi Nilai Stok
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-base font-bold font-mono">
              Rp {((item.unitPrice || 0) * item.currentStock).toLocaleString("id-ID")}
            </div>
            <p className="text-xs text-muted-foreground">
              @ Rp {(item.unitPrice || 0).toLocaleString("id-ID")} / {item.unit}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Movement History Table */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Riwayat Mutasi & Pergerakan Stok
            </CardTitle>
            <CardDescription>
              Catatan historis seluruh penerimaan, pemakaian operasional, dan stock opname barang ini
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={fetchItemDetail} className="gap-1 text-xs">
            <RefreshCw className="h-3.5 w-3.5" /> Segarkan
          </Button>
        </CardHeader>
        <CardContent>
          {item.transactions?.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground bg-muted/20 rounded-lg">
              Belum ada riwayat mutasi stok untuk barang ini.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground text-left bg-muted/30">
                    <th className="py-3 px-4 font-semibold">Tanggal & Waktu</th>
                    <th className="py-3 px-4 font-semibold">Jenis Mutasi</th>
                    <th className="py-3 px-4 font-semibold text-right">Perubahan Kuantitas</th>
                    <th className="py-3 px-4 font-semibold text-center">Stok (Sebelum ➔ Sesudah)</th>
                    <th className="py-3 px-4 font-semibold">No. Referensi / PO</th>
                    <th className="py-3 px-4 font-semibold">Keterangan / Keperluan</th>
                    <th className="py-3 px-4 font-semibold">Petugas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {item.transactions.map((tx: any) => {
                    const isStockIn = tx.type === "STOCK_IN";
                    const isStockOut = tx.type === "STOCK_OUT";

                    return (
                      <tr key={tx.id} className="hover:bg-muted/40 transition-colors">
                        <td className="py-3 px-4 text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(tx.createdAt).toLocaleDateString("id-ID", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="py-3 px-4">
                          {isStockIn ? (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                              🟢 Stok Masuk
                            </Badge>
                          ) : isStockOut ? (
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">
                              🔴 Stok Keluar
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px]">
                              🟡 Penyesuaian
                            </Badge>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-bold font-mono">
                          {isStockIn ? (
                            <span className="text-emerald-600">+{tx.quantity}</span>
                          ) : isStockOut ? (
                            <span className="text-amber-600">-{tx.quantity}</span>
                          ) : (
                            <span>{tx.quantity}</span>
                          )}{" "}
                          <span className="text-xs text-muted-foreground font-normal">{item.unit}</span>
                        </td>
                        <td className="py-3 px-4 text-center font-mono text-xs">
                          {tx.stockBefore} ➔ <span className="font-bold">{tx.stockAfter}</span>
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-muted-foreground">
                          {tx.referenceNumber || "-"}
                        </td>
                        <td className="py-3 px-4 text-xs text-muted-foreground">{tx.notes || "-"}</td>
                        <td className="py-3 px-4 text-xs font-medium">
                          {tx.performedBy?.fullName || "Sistem"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Movement Modal */}
      <Dialog open={movementOpen} onOpenChange={setMovementOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Catat Mutasi Persediaan</DialogTitle>
            <DialogDescription>
              Barang: <strong>{item.name}</strong> • Sisa Stok Saat Ini:{" "}
              <strong>
                {item.currentStock} {item.unit}
              </strong>
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleRecordMovement} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="transType">Jenis Mutasi *</Label>
              <select
                id="transType"
                value={movementForm.type}
                onChange={(e) => setMovementForm({ ...movementForm, type: e.target.value })}
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="STOCK_IN">🟢 Stok Masuk (Penerimaan / Pengadaan)</option>
                <option value="STOCK_OUT">🔴 Stok Keluar (Pemakaian Bagian / Unit Kerja)</option>
                <option value="ADJUSTMENT">🟡 Penyesuaian (Hasil Stock Opname)</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantity">
                {movementForm.type === "ADJUSTMENT" ? "Jumlah Stok Riil Opname *" : "Kuantitas Mutasi *"} (
                {item.unit})
              </Label>
              <Input
                id="quantity"
                type="number"
                min={movementForm.type === "ADJUSTMENT" ? "0" : "1"}
                value={movementForm.quantity}
                onChange={(e) => setMovementForm({ ...movementForm, quantity: Number(e.target.value) })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="refNo">Nomor Referensi (PO / Bon / Memo)</Label>
              <Input
                id="refNo"
                placeholder="Contoh: PO-2026-009 atau BON-OPS-03"
                value={movementForm.referenceNumber}
                onChange={(e) => setMovementForm({ ...movementForm, referenceNumber: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="transNotes">Keterangan / Keperluan</Label>
              <Input
                id="transNotes"
                placeholder="Catatan penggunaan atau vendor pengirim"
                value={movementForm.notes}
                onChange={(e) => setMovementForm({ ...movementForm, notes: e.target.value })}
              />
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setMovementOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={moving}>
                {moving ? "Memproses..." : "Simpan Mutasi"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
