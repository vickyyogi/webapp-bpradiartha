"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Boxes,
  PlusCircle,
  ArrowUpDown,
  Search,
  Filter,
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  Eye,
  CheckCircle2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const CATEGORIES = [
  "ALL",
  "Formulir & Kertas",
  "Toner & Cartridge",
  "ATK",
  "Kebersihan & Pantry",
  "Lainnya",
];

export default function InventoryItemsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({ totalItems: 0, lowStockCount: 0, outOfStockCount: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [onlyLowStock, setOnlyLowStock] = useState(false);

  // Modal State for New Item
  const [newItemOpen, setNewItemOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newItemForm, setNewItemForm] = useState({
    itemCode: "",
    name: "",
    category: "Formulir & Kertas",
    unit: "Rim",
    minStock: 5,
    initialStock: 0,
    storageLocation: "",
    unitPrice: "",
    notes: "",
  });

  // Modal State for Stock Movement (In / Out / Adjustment)
  const [movementOpen, setMovementOpen] = useState(false);
  const [selectedItemForMove, setSelectedItemForMove] = useState<any>(null);
  const [moving, setMoving] = useState(false);
  const [movementForm, setMovementForm] = useState({
    type: "STOCK_IN",
    quantity: 1,
    referenceNumber: "",
    notes: "",
  });

  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (selectedCategory && selectedCategory !== "ALL") params.set("category", selectedCategory);
      if (onlyLowStock) params.set("lowStock", "true");

      const res = await fetch(`/api/inventory/items?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
        setSummary(data.summary || {});
      }
    } catch (err) {
      console.error("Error fetching inventory items:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [search, selectedCategory, onlyLowStock]);

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setFeedbackMsg(null);
    try {
      const res = await fetch("/api/inventory/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newItemForm),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal menambahkan item baru.");
      }

      setFeedbackMsg({ type: "success", text: "Barang inventaris baru berhasil ditambahkan!" });
      setNewItemOpen(false);
      setNewItemForm({
        itemCode: "",
        name: "",
        category: "Formulir & Kertas",
        unit: "Rim",
        minStock: 5,
        initialStock: 0,
        storageLocation: "",
        unitPrice: "",
        notes: "",
      });
      fetchItems();
    } catch (err: any) {
      setFeedbackMsg({ type: "error", text: err.message });
    } finally {
      setCreating(false);
    }
  };

  const handleRecordMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemForMove) return;
    setMoving(true);
    setFeedbackMsg(null);
    try {
      const res = await fetch("/api/inventory/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: selectedItemForMove.id,
          ...movementForm,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal mencatat mutasi stok.");
      }

      setFeedbackMsg({
        type: "success",
        text: `Transaksi stok ${selectedItemForMove.name} berhasil dicatat! Sisa stok sekarang: ${data.newStock} ${selectedItemForMove.unit}.`,
      });
      setMovementOpen(false);
      setMovementForm({
        type: "STOCK_IN",
        quantity: 1,
        referenceNumber: "",
        notes: "",
      });
      fetchItems();
    } catch (err: any) {
      setFeedbackMsg({ type: "error", text: err.message });
    } finally {
      setMoving(false);
    }
  };

  const openMovementDialog = (item: any, type: "STOCK_IN" | "STOCK_OUT" | "ADJUSTMENT") => {
    setSelectedItemForMove(item);
    setMovementForm({
      type,
      quantity: 1,
      referenceNumber: "",
      notes: "",
    });
    setMovementOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Link href="/inventory" className="hover:underline">
              Inventaris
            </Link>
            <span>/</span>
            <span>Master Barang & ATK</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Master Barang & Stok ATK</h1>
          <p className="text-muted-foreground text-sm">
            Daftar persediaan alat tulis kantor, cetakan formulir, bilyet, dan perlengkapan operasional.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={() => setNewItemOpen(true)} className="gap-2">
            <PlusCircle className="h-4 w-4" />
            Tambah Barang Baru
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
          <button
            onClick={() => setFeedbackMsg(null)}
            className="text-xs font-semibold hover:underline ml-4"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <Card className="shadow-sm">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex flex-1 flex-col sm:flex-row gap-3 w-full">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cari kode barang, nama, lokasi..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat === "ALL" ? "Semua Kategori" : cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto justify-end">
              <Button
                variant={onlyLowStock ? "default" : "outline"}
                size="sm"
                onClick={() => setOnlyLowStock(!onlyLowStock)}
                className="gap-2 text-xs"
              >
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                Hanya Stok Menipis ({summary.lowStockCount || 0})
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Item Table */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold">Daftar Persediaan Barang</CardTitle>
            <CardDescription>Menampilkan {items.length} item inventaris</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={fetchItems} className="gap-1.5 text-xs">
            <RefreshCw className="h-3.5 w-3.5" /> Segarkan
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Memuat daftar barang...</div>
          ) : items.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground bg-muted/20 rounded-lg">
              Tidak ada data barang yang sesuai dengan filter pencarian.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground text-left bg-muted/30">
                    <th className="py-3 px-4 font-semibold">Kode</th>
                    <th className="py-3 px-4 font-semibold">Nama Barang</th>
                    <th className="py-3 px-4 font-semibold">Kategori</th>
                    <th className="py-3 px-4 font-semibold text-right">Stok Saat Ini</th>
                    <th className="py-3 px-4 font-semibold text-right">Min. Stok</th>
                    <th className="py-3 px-4 font-semibold">Lokasi Simpan</th>
                    <th className="py-3 px-4 font-semibold text-right">Harga Satuan</th>
                    <th className="py-3 px-4 font-semibold text-center">Status</th>
                    <th className="py-3 px-4 font-semibold text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map((item) => {
                    const isOutOfStock = item.currentStock === 0;
                    const isLowStock = item.currentStock <= item.minStock;

                    return (
                      <tr key={item.id} className="hover:bg-muted/40 transition-colors">
                        <td className="py-3 px-4 font-mono text-xs font-semibold text-primary">
                          {item.itemCode}
                        </td>
                        <td className="py-3 px-4 font-medium">
                          <Link
                            href={`/inventory/items/${item.id}`}
                            className="hover:underline flex items-center gap-1.5"
                          >
                            {item.name}
                          </Link>
                          {item.notes && (
                            <span className="text-xs text-muted-foreground block truncate max-w-xs">
                              {item.notes}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-xs text-muted-foreground">{item.category}</td>
                        <td className="py-3 px-4 text-right font-bold">
                          <span
                            className={
                              isOutOfStock
                                ? "text-red-600"
                                : isLowStock
                                ? "text-amber-600"
                                : "text-foreground"
                            }
                          >
                            {item.currentStock} {item.unit}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right text-xs text-muted-foreground">
                          {item.minStock} {item.unit}
                        </td>
                        <td className="py-3 px-4 text-xs text-muted-foreground">
                          {item.storageLocation || "-"}
                        </td>
                        <td className="py-3 px-4 text-right text-xs font-mono">
                          {item.unitPrice ? `Rp ${item.unitPrice.toLocaleString("id-ID")}` : "-"}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {isOutOfStock ? (
                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-[10px]">
                              Habis
                            </Badge>
                          ) : isLowStock ? (
                            <Badge
                              variant="outline"
                              className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]"
                            >
                              Menipis
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]"
                            >
                              Aman
                            </Badge>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Catat Stok Masuk"
                              onClick={() => openMovementDialog(item, "STOCK_IN")}
                              className="h-8 w-8 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                            >
                              <ArrowDownLeft className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Catat Pengeluaran Stok"
                              onClick={() => openMovementDialog(item, "STOCK_OUT")}
                              className="h-8 w-8 p-0 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                            >
                              <ArrowUpRight className="h-4 w-4" />
                            </Button>
                            <Link href={`/inventory/items/${item.id}`}>
                              <Button variant="ghost" size="sm" title="Lihat Detail & Riwayat" className="h-8 w-8 p-0">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>
                          </div>
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

      {/* Modal: Tambah Barang Baru */}
      <Dialog open={newItemOpen} onOpenChange={setNewItemOpen}>
        <DialogContent className="sm:max-w-[540px]">
          <DialogHeader>
            <DialogTitle>Daftarkan Barang / ATK Baru</DialogTitle>
            <DialogDescription>
              Masukkan informasi barang persediaan habis pakai untuk pelacakan stok BPR.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateItem} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Kategori *</Label>
                <select
                  id="category"
                  value={newItemForm.category}
                  onChange={(e) => setNewItemForm({ ...newItemForm, category: e.target.value })}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  required
                >
                  {CATEGORIES.filter((c) => c !== "ALL").map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="itemCode">Kode Barang (Opsional)</Label>
                <Input
                  id="itemCode"
                  placeholder="Otomatis jika kosong"
                  value={newItemForm.itemCode}
                  onChange={(e) => setNewItemForm({ ...newItemForm, itemCode: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Nama Barang *</Label>
              <Input
                id="name"
                placeholder="Contoh: Kertas HVS F4 70gr Sinar Dunia"
                value={newItemForm.name}
                onChange={(e) => setNewItemForm({ ...newItemForm, name: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="unit">Satuan *</Label>
                <Input
                  id="unit"
                  placeholder="Rim / Box / Pcs"
                  value={newItemForm.unit}
                  onChange={(e) => setNewItemForm({ ...newItemForm, unit: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="initialStock">Stok Awal</Label>
                <Input
                  id="initialStock"
                  type="number"
                  min="0"
                  value={newItemForm.initialStock}
                  onChange={(e) => setNewItemForm({ ...newItemForm, initialStock: Number(e.target.value) })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="minStock">Min. Stok</Label>
                <Input
                  id="minStock"
                  type="number"
                  min="0"
                  value={newItemForm.minStock}
                  onChange={(e) => setNewItemForm({ ...newItemForm, minStock: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="storageLocation">Lokasi Penyimpanan</Label>
                <Input
                  id="storageLocation"
                  placeholder="Contoh: Gudang Lt. 1 / Lemari B"
                  value={newItemForm.storageLocation}
                  onChange={(e) => setNewItemForm({ ...newItemForm, storageLocation: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="unitPrice">Estimasi Harga Satuan (Rp)</Label>
                <Input
                  id="unitPrice"
                  type="number"
                  placeholder="Contoh: 55000"
                  value={newItemForm.unitPrice}
                  onChange={(e) => setNewItemForm({ ...newItemForm, unitPrice: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Catatan Tambahan</Label>
              <Input
                id="notes"
                placeholder="Spesifikasi atau tujuan penggunaan"
                value={newItemForm.notes}
                onChange={(e) => setNewItemForm({ ...newItemForm, notes: e.target.value })}
              />
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setNewItemOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? "Menyimpan..." : "Simpan Barang"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Transaksi Stok (Masuk / Keluar / Penyesuaian) */}
      <Dialog open={movementOpen} onOpenChange={setMovementOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Catat Mutasi Persediaan</DialogTitle>
            <DialogDescription>
              {selectedItemForMove ? (
                <span>
                  Barang: <strong>{selectedItemForMove.name}</strong> ({selectedItemForMove.itemCode}) • Sisa Stok:{" "}
                  <strong>
                    {selectedItemForMove.currentStock} {selectedItemForMove.unit}
                  </strong>
                </span>
              ) : (
                "Pilih transaksi stok"
              )}
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
                <option value="STOCK_IN">🟢 Stok Masuk (Penerimaan / Pengadaan Baru)</option>
                <option value="STOCK_OUT">🔴 Stok Keluar (Pemakaian Operasional / Departemen)</option>
                <option value="ADJUSTMENT">🟡 Penyesuaian (Stock Opname Fisik)</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantity">
                {movementForm.type === "ADJUSTMENT" ? "Jumlah Stok Riil Hasil Opname *" : "Jumlah Kuantitas *"} (
                {selectedItemForMove?.unit})
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
                placeholder="Contoh: PO-2026-0042 atau BON-CS-01"
                value={movementForm.referenceNumber}
                onChange={(e) => setMovementForm({ ...movementForm, referenceNumber: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="transNotes">Keterangan / Keperluan</Label>
              <Input
                id="transNotes"
                placeholder="Contoh: Kebutuhan cetak slip setoran CS Renon"
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
