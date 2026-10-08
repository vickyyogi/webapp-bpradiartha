"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  PackageCheck,
  Search,
  RefreshCw,
  Eye,
  CheckCircle2,
  Calendar,
  Building2,
  ShoppingCart,
  Boxes,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export default function GoodsReceiptsPage() {
  const [receipts, setReceipts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchReceipts = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/purchasing/receipts");
      if (res.ok) {
        const data = await res.json();
        setReceipts(data.receipts || []);
      }
    } catch (err) {
      console.error("Failed to load receipts:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReceipts();
  }, []);

  const filteredReceipts = receipts.filter((r) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      r.receiptNumber.toLowerCase().includes(term) ||
      (r.deliveryNoteNumber && r.deliveryNoteNumber.toLowerCase().includes(term)) ||
      (r.purchaseOrder?.poNumber && r.purchaseOrder.poNumber.toLowerCase().includes(term)) ||
      (r.purchaseOrder?.vendor?.name && r.purchaseOrder.vendor.name.toLowerCase().includes(term)) ||
      (r.receivedBy?.fullName && r.receivedBy.fullName.toLowerCase().includes(term))
    );
  });

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
            <span>Penerimaan Barang</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Penerimaan Barang (Goods Receipt Note)</h1>
          <p className="text-muted-foreground text-sm">
            Arsip berita acara verifikasi fisik barang yang diterima dari vendor berdasarkan Purchase Order.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/purchasing/orders">
            <Button variant="outline" className="gap-2">
              <ShoppingCart className="h-4 w-4" />
              Lihat Purchase Orders
            </Button>
          </Link>
        </div>
      </div>

      {/* Filter and Search */}
      <Card className="shadow-sm">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari nomor GRN, surat jalan, PO, vendor..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button variant="ghost" size="sm" onClick={fetchReceipts} className="gap-1 text-xs">
              <RefreshCw className="h-3.5 w-3.5" /> Segarkan
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Receipts Table */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold">Daftar Dokumen Penerimaan Barang</CardTitle>
          <CardDescription>Menampilkan {filteredReceipts.length} dokumen GRN</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Memuat data penerimaan...</div>
          ) : filteredReceipts.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground bg-muted/20 rounded-lg">
              Belum ada berita acara penerimaan barang tercatat.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground text-left bg-muted/30">
                    <th className="py-3 px-4 font-semibold">No. GRN</th>
                    <th className="py-3 px-4 font-semibold">No. Purchase Order</th>
                    <th className="py-3 px-4 font-semibold">Vendor Rekanan</th>
                    <th className="py-3 px-4 font-semibold">Tanggal Terima</th>
                    <th className="py-3 px-4 font-semibold">No. Surat Jalan</th>
                    <th className="py-3 px-4 font-semibold">Petugas Penerima</th>
                    <th className="py-3 px-4 font-semibold text-center">Status</th>
                    <th className="py-3 px-4 font-semibold text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredReceipts.map((grn) => (
                    <tr key={grn.id} className="hover:bg-muted/40 transition-colors">
                      <td className="py-3 px-4 font-mono text-xs font-semibold text-primary">
                        {grn.receiptNumber}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs">
                        <Link
                          href={`/purchasing/orders/${grn.purchaseOrder?.id}`}
                          className="text-primary hover:underline"
                        >
                          {grn.purchaseOrder?.poNumber}
                        </Link>
                      </td>
                      <td className="py-3 px-4 text-xs font-medium">
                        {grn.purchaseOrder?.vendor?.name}
                      </td>
                      <td className="py-3 px-4 text-xs text-muted-foreground">
                        {new Date(grn.receiptDate).toLocaleDateString("id-ID")}
                      </td>
                      <td className="py-3 px-4 text-xs font-mono text-muted-foreground">
                        {grn.deliveryNoteNumber || "-"}
                      </td>
                      <td className="py-3 px-4 text-xs">
                        <span className="font-medium">{grn.receivedBy?.fullName}</span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                          {grn.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link href={`/purchasing/orders/${grn.purchaseOrder?.id}`}>
                          <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs">
                            <Eye className="h-3.5 w-3.5" /> Lihat PO
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
