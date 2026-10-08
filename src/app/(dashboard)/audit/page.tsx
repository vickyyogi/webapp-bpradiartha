"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Search,
  Filter,
  RefreshCw,
  Eye,
  Calendar,
  User,
  Monitor,
  Globe,
  FileText,
  Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const ACTIONS = [
  "ALL",
  "LOGIN",
  "CREATE",
  "UPDATE",
  "APPROVE",
  "REJECT",
  "STATUS_CHANGE",
  "ASSIGN",
  "TRANSFER",
  "DISPOSAL",
];

const ENTITIES = [
  "ALL",
  "CREDIT_APPLICATION",
  "PURCHASE_REQUEST",
  "PURCHASE_ORDER",
  "GOODS_RECEIPT",
  "INVENTORY_ITEM",
  "ASSET",
  "LEAD",
  "USER",
  "DOCUMENT",
];

export default function AuditTrailPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("ALL");
  const [entityType, setEntityType] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Modal Detail State
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (action !== "ALL") params.set("action", action);
      if (entityType !== "ALL") params.set("entityType", entityType);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);

      const res = await fetch(`/api/audit?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        setTotalCount(data.totalCount || 0);
      }
    } catch (err) {
      console.error("Failed to load audit logs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, [search, action, entityType, startDate, endDate]);

  const openLogDetail = (log: any) => {
    setSelectedLog(log);
    setDetailOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <span>Sistem & Keamanan</span>
            <span>/</span>
            <span>Jejak Audit</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            Audit Trail & Kepatuhan Operasional
          </h1>
          <p className="text-muted-foreground text-sm">
            Catatan log permanen (append-only) seluruh transaksi, perubahan status, otorisasi persetujuan, dan aktivitas staf BPR.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchAuditLogs} className="gap-1 text-xs">
            <RefreshCw className="h-3.5 w-3.5" /> Segarkan Log
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card className="shadow-sm">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari ID entitas, catatan, IP..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <select
              value={action}
              onChange={(e) => setAction(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {ACTIONS.map((a) => (
                <option key={a} value={a}>
                  {a === "ALL" ? "Semua Jenis Aksi" : `Aksi: ${a}`}
                </option>
              ))}
            </select>

            <select
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {ENTITIES.map((e) => (
                <option key={e} value={e}>
                  {e === "ALL" ? "Semua Entitas Modul" : e}
                </option>
              ))}
            </select>

            <Input
              type="date"
              title="Dari Tanggal"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />

            <Input
              type="date"
              title="Sampai Tanggal"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Audit Table */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold">Catatan Aktivitas Sistem Terverifikasi</CardTitle>
            <CardDescription>
              Menampilkan {logs.length} dari {totalCount} total riwayat jejak audit
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Memuat catatan log audit...</div>
          ) : logs.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground bg-muted/20 rounded-lg">
              Tidak ada catatan audit yang cocok dengan filter.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground text-left bg-muted/30">
                    <th className="py-3 px-4 font-semibold">Waktu Kejadian</th>
                    <th className="py-3 px-4 font-semibold">Pengguna / Staf</th>
                    <th className="py-3 px-4 font-semibold text-center">Aksi</th>
                    <th className="py-3 px-4 font-semibold">Entitas Modul</th>
                    <th className="py-3 px-4 font-semibold">ID / No. Referensi</th>
                    <th className="py-3 px-4 font-semibold">IP Address</th>
                    <th className="py-3 px-4 font-semibold">Uraian / Catatan</th>
                    <th className="py-3 px-4 font-semibold text-right">Rincian</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {logs.map((log) => {
                    const isApprove = log.action === "APPROVE";
                    const isReject = log.action === "REJECT";
                    const isLogin = log.action === "LOGIN";

                    return (
                      <tr key={log.id} className="hover:bg-muted/40 transition-colors">
                        <td className="py-3 px-4 text-xs font-mono text-muted-foreground whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleDateString("id-ID", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </td>
                        <td className="py-3 px-4 text-xs">
                          <span className="font-semibold text-foreground">
                            {log.user?.fullName || "Sistem Otomatis"}
                          </span>
                          {log.user?.employeeNumber && (
                            <span className="block font-mono text-[10px] text-muted-foreground">
                              NIK: {log.user.employeeNumber}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Badge
                            variant="outline"
                            className={
                              isApprove
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]"
                                : isReject
                                ? "bg-red-50 text-red-700 border-red-200 text-[10px]"
                                : isLogin
                                ? "bg-blue-50 text-blue-700 border-blue-200 text-[10px]"
                                : "bg-muted text-foreground text-[10px]"
                            }
                          >
                            {log.action}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-xs font-medium text-muted-foreground">
                          {log.entityType}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs font-semibold text-primary">
                          {log.entityId}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-muted-foreground">
                          {log.ipAddress || "127.0.0.1"}
                        </td>
                        <td className="py-3 px-4 text-xs text-muted-foreground max-w-xs truncate">
                          {log.notes || "-"}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openLogDetail(log)}
                            className="h-8 gap-1 text-xs"
                          >
                            <Eye className="h-3.5 w-3.5" /> Diff
                          </Button>
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

      {/* Modal: Diff & Technical Audit Detail */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Rincian Jejak Audit (ID: {selectedLog?.id?.slice(0, 8)}...)
            </DialogTitle>
            <DialogDescription>
              Waktu: {selectedLog?.createdAt ? new Date(selectedLog.createdAt).toLocaleString("id-ID") : "-"}
            </DialogDescription>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-4 py-2 text-xs">
              {/* Meta Grid */}
              <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-muted/40 border">
                <div>
                  <span className="text-muted-foreground">Pengguna Pelaksana:</span>{" "}
                  <strong>{selectedLog.user?.fullName || "Sistem"}</strong> ({selectedLog.user?.email || "-"})
                </div>
                <div>
                  <span className="text-muted-foreground">Jenis Tindakan:</span>{" "}
                  <Badge variant="outline" className="text-[10px]">
                    {selectedLog.action}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">Target Entitas:</span>{" "}
                  <strong>{selectedLog.entityType}</strong> ({selectedLog.entityId})
                </div>
                <div>
                  <span className="text-muted-foreground">Alamat IP:</span>{" "}
                  <span className="font-mono">{selectedLog.ipAddress || "127.0.0.1"}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground">Perangkat / User Agent:</span>{" "}
                  <span className="font-mono text-[11px] block truncate">{selectedLog.userAgent || "N/A"}</span>
                </div>
              </div>

              {selectedLog.notes && (
                <div className="p-3 rounded-lg border bg-card">
                  <span className="text-muted-foreground block font-semibold mb-1">Catatan Keterangan:</span>
                  <p className="text-foreground">{selectedLog.notes}</p>
                </div>
              )}

              {/* Diff Values Side by Side */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-lg border bg-card space-y-1">
                  <div className="font-semibold text-muted-foreground flex items-center justify-between">
                    <span>Nilai Sebelum (Old Values):</span>
                  </div>
                  <pre className="p-2 rounded bg-muted font-mono text-[11px] overflow-x-auto max-h-48 text-muted-foreground">
                    {selectedLog.oldValues ? JSON.stringify(selectedLog.oldValues, null, 2) : "null (Data baru)"}
                  </pre>
                </div>

                <div className="p-3 rounded-lg border bg-card space-y-1">
                  <div className="font-semibold text-emerald-700 flex items-center justify-between">
                    <span>Nilai Sesudah (New Values):</span>
                  </div>
                  <pre className="p-2 rounded bg-emerald-50 border border-emerald-100 font-mono text-[11px] overflow-x-auto max-h-48 text-emerald-950">
                    {selectedLog.newValues ? JSON.stringify(selectedLog.newValues, null, 2) : "null (Data dihapus)"}
                  </pre>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button type="button" onClick={() => setDetailOpen(false)}>
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
