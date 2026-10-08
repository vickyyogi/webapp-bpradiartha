"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ShoppingCart,
  Search,
  RefreshCw,
  Eye,
  CheckCircle2,
  Clock,
  Building2,
  PlusCircle,
  PackageCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export default function PurchaseOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({ total: 0, issued: 0, partial: 0, completed: 0, totalValue: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter !== "ALL") params.set("status", statusFilter);

      const res = await fetch(`/api/purchasing/orders?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
        setSummary(data.summary || {});
      }
    } catch (err) {
      console.error("Failed to load purchase orders:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [search, statusFilter]);

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
            <span>Purchase Orders</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Purchase Orders (PO) Resmi</h1>
          <p className="text-muted-foreground text-sm">
            Daftar surat pesanan pembelian resmi kepada vendor rekanan BPR yang telah disetujui.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/purchasing/requests">
            <Button variant="outline" className="gap-2">
              <PlusCircle className="h-4 w-4" />
              Pilih dari PR yang Disetujui
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
              Total PO Terbit
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.total || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Nilai: Rp {((summary.totalValue || 0) / 1000000).toFixed(1)} Jt
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-l-4 border-l-blue-600">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
              Menunggu Kiriman
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{summary.issued || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Status: ISSUED</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-l-4 border-l-amber-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
              Diterima Sebagian
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{summary.partial || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Status: PARTIAL_RECEIVED</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-l-4 border-l-emerald-600">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
              Pesanan Lengkap
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{summary.completed || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Status: COMPLETED</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="shadow-sm">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari nomor PO, nama vendor..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="ALL">Semua Status PO</option>
                <option value="ISSUED">ISSUED (Diterbitkan)</option>
                <option value="PARTIAL_RECEIVED">PARTIAL_RECEIVED (Sebagian)</option>
                <option value="COMPLETED">COMPLETED (Selesai)</option>
                <option value="CANCELLED">CANCELLED (Dibatalkan)</option>
              </select>

              <Button variant="ghost" size="sm" onClick={fetchOrders} className="gap-1 text-xs">
                <RefreshCw className="h-3.5 w-3.5" /> Segarkan
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold">Daftar Purchase Order</CardTitle>
          <CardDescription>Menampilkan {orders.length} surat pesanan ke vendor rekanan</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Memuat purchase order...</div>
          ) : orders.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground bg-muted/20 rounded-lg">
              Belum ada pesanan pembelian yang sesuai dengan pencarian.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground text-left bg-muted/30">
                    <th className="py-3 px-4 font-semibold">No. PO</th>
                    <th className="py-3 px-4 font-semibold">Vendor Rekanan</th>
                    <th className="py-3 px-4 font-semibold">Tanggal PO</th>
                    <th className="py-3 px-4 font-semibold">Syarat Bayar</th>
                    <th className="py-3 px-4 font-semibold text-center">Penerimaan (GRN)</th>
                    <th className="py-3 px-4 font-semibold text-right">Total Nilai (+PPN)</th>
                    <th className="py-3 px-4 font-semibold text-center">Status</th>
                    <th className="py-3 px-4 font-semibold text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {orders.map((po) => (
                    <tr key={po.id} className="hover:bg-muted/40 transition-colors">
                      <td className="py-3 px-4 font-mono text-xs font-semibold text-primary">
                        {po.poNumber}
                      </td>
                      <td className="py-3 px-4 font-medium">
                        <Link href={`/purchasing/orders/${po.id}`} className="hover:underline">
                          {po.vendor?.name}
                        </Link>
                        <span className="text-xs text-muted-foreground block">
                          {po.vendor?.category} • Telp: {po.vendor?.phone || "-"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs text-muted-foreground">
                        {new Date(po.poDate).toLocaleDateString("id-ID")}
                      </td>
                      <td className="py-3 px-4 text-xs text-muted-foreground">
                        {po.paymentTerms || "NET 14 Hari"}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="text-xs font-medium">
                          {po._count?.goodsReceipts || 0} kali terima
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-xs">
                        Rp {po.totalAmount?.toLocaleString("id-ID")}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge
                          variant="outline"
                          className={
                            po.status === "COMPLETED"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]"
                              : po.status === "PARTIAL_RECEIVED"
                              ? "bg-amber-50 text-amber-700 border-amber-200 text-[10px]"
                              : po.status === "ISSUED"
                              ? "bg-blue-50 text-blue-700 border-blue-200 text-[10px]"
                              : "bg-gray-100 text-gray-700 border-gray-300 text-[10px]"
                          }
                        >
                          {po.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link href={`/purchasing/orders/${po.id}`}>
                          <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs">
                            <Eye className="h-3.5 w-3.5" /> Detail & Terima
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
