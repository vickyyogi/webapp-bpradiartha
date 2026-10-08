"use client";

import { useState } from "react";
import Link from "next/link";
import { PlusCircle, Search, MapPin, Calendar, User, Phone, CheckCircle2, AlertCircle, Edit2, Trash2, ArrowLeft } from "lucide-react";
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

export type FieldTask = {
  id: string;
  title: string;
  description: string | null;
  taskType: "SURVEY" | "CUSTOMER_VISIT" | "FOLLOW_UP" | "DOCUMENT_PICKUP" | "COLLECTION" | "OTHER";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  customerName: string | null;
  customerPhone: string | null;
  customerAddress: string | null;
  dueDate: string | Date | null;
  completedAt: string | Date | null;
  resultNotes: string | null;
  createdAt: string | Date;
  assignedOfficer: { id: string; fullName: string; email: string };
  branch?: { id: string; name: string } | null;
  creditApplication?: { id: string; applicationNumber: string } | null;
  lead?: { id: string; name: string } | null;
};

const TASK_TYPE_CONFIG: Record<FieldTask["taskType"], { label: string }> = {
  SURVEY: { label: "Survey Lapangan" },
  CUSTOMER_VISIT: { label: "Kunjungan Nasabah" },
  FOLLOW_UP: { label: "Follow-Up Prospek" },
  DOCUMENT_PICKUP: { label: "Penjemputan Berkas" },
  COLLECTION: { label: "Penagihan / Collection" },
  OTHER: { label: "Lainnya" },
};

const PRIORITY_CONFIG: Record<
  FieldTask["priority"],
  { label: string; variant: "default" | "secondary" | "destructive" | "warning" | "info" }
> = {
  LOW: { label: "Rendah", variant: "secondary" },
  MEDIUM: { label: "Sedang", variant: "info" },
  HIGH: { label: "Tinggi", variant: "warning" },
  URGENT: { label: "Mendesak", variant: "destructive" },
};

const STATUS_CONFIG: Record<
  FieldTask["status"],
  { label: string; variant: "default" | "secondary" | "destructive" | "success" | "warning" | "info" }
> = {
  PENDING: { label: "Belum Dikerjakan", variant: "info" },
  IN_PROGRESS: { label: "Sedang Dikerjakan", variant: "warning" },
  COMPLETED: { label: "Selesai", variant: "success" },
  CANCELLED: { label: "Dibatalkan", variant: "destructive" },
};

export function FieldTasksClientView({
  initialTasks,
  officers,
  branches,
}: {
  initialTasks: FieldTask[];
  officers: Array<{ id: string; fullName: string; email: string }>;
  branches: Array<{ id: string; name: string; code: string }>;
}) {
  const [tasks, setTasks] = useState<FieldTask[]>(initialTasks);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isCompleteOpen, setIsCompleteOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<FieldTask | null>(null);
  const [completionNotes, setCompletionNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [formData, setFormData] = useState({
    title: "",
    taskType: "SURVEY",
    priority: "MEDIUM",
    assignedOfficerId: officers[0]?.id || "",
    branchId: branches[0]?.id || "",
    customerName: "",
    customerPhone: "",
    customerAddress: "",
    dueDate: "",
    description: "",
  });

  const resetForm = () => {
    setFormData({
      title: "",
      taskType: "SURVEY",
      priority: "MEDIUM",
      assignedOfficerId: officers[0]?.id || "",
      branchId: branches[0]?.id || "",
      customerName: "",
      customerPhone: "",
      customerAddress: "",
      dueDate: "",
      description: "",
    });
    setErrorMessage("");
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const res = await fetch("/api/field/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal membuat tugas lapangan");

      setTasks([json.data, ...tasks]);
      setIsAddOpen(false);
      resetForm();
    } catch (err: any) {
      setErrorMessage(err.message || "Terjadi kesalahan sistem");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenCompleteModal = (task: FieldTask) => {
    setSelectedTask(task);
    setCompletionNotes(task.resultNotes || "");
    setIsCompleteOpen(true);
  };

  const handleSaveCompletion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask) return;
    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/field/tasks/${selectedTask.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "COMPLETED",
          resultNotes: completionNotes,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal menyelesaikan tugas");

      setTasks(tasks.map((t) => (t.id === selectedTask.id ? json.data : t)));
      setIsCompleteOpen(false);
      setSelectedTask(null);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus penugasan lapangan ini?")) return;
    try {
      const res = await fetch(`/api/field/tasks/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Gagal menghapus tugas");
      setTasks(tasks.filter((t) => t.id !== id));
    } catch (e: any) {
      alert(e.message);
    }
  };

  const filteredTasks = tasks.filter((t) => {
    const matchesStatus = statusFilter === "ALL" || t.status === statusFilter;
    const matchesType = typeFilter === "ALL" || t.taskType === typeFilter;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !searchQuery ||
      t.title.toLowerCase().includes(q) ||
      (t.customerName && t.customerName.toLowerCase().includes(q)) ||
      (t.customerAddress && t.customerAddress.toLowerCase().includes(q)) ||
      t.assignedOfficer.fullName.toLowerCase().includes(q);

    return matchesStatus && matchesType && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/field">
              <Button variant="outline" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Kembali
              </Button>
            </Link>
            <h1 className="text-2xl font-bold tracking-tight">Daftar Penugasan Lapangan</h1>
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            Pantau seluruh tugas survey, kunjungan nasabah, dan aktivitas petugas lapangan.
          </p>
        </div>
        <Button onClick={() => { resetForm(); setIsAddOpen(true); }} className="gap-2">
          <PlusCircle className="h-4 w-4" />
          Buat Tugas Lapangan Baru
        </Button>
      </div>

      {/* Filter Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari judul tugas, nama debitur, alamat, atau nama petugas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-xs"
              >
                <option value="ALL">Semua Jenis Tugas</option>
                {Object.entries(TASK_TYPE_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-xs"
              >
                <option value="ALL">Semua Status</option>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Task Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Daftar Aktivitas ({filteredTasks.length})</CardTitle>
          <CardDescription>
            Petugas dapat memperbarui status tugas dan mengisi catatan hasil temuan survey di lapangan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredTasks.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">
              Tidak ada tugas lapangan yang sesuai dengan kriteria filter.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tugas & Tipe</TableHead>
                    <TableHead>Nasabah & Lokasi</TableHead>
                    <TableHead>Petugas Pelaksana</TableHead>
                    <TableHead>Prioritas</TableHead>
                    <TableHead>Tenggat Waktu</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTasks.map((task) => (
                    <TableRow key={task.id}>
                      <TableCell>
                        <div className="font-semibold text-sm">{task.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {TASK_TYPE_CONFIG[task.taskType]?.label || task.taskType}
                          {task.creditApplication && (
                            <span> • Ref: #{task.creditApplication.applicationNumber}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-xs">{task.customerName || "-"}</div>
                        <div className="text-[11px] text-muted-foreground truncate max-w-[200px]">
                          {task.customerAddress || "-"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-xs">{task.assignedOfficer.fullName}</div>
                        <div className="text-[11px] text-muted-foreground">{task.branch?.name || "-"}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={PRIORITY_CONFIG[task.priority]?.variant || "secondary"} className="text-[11px]">
                          {PRIORITY_CONFIG[task.priority]?.label || task.priority}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {task.dueDate ? new Date(task.dueDate).toLocaleDateString("id-ID") : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_CONFIG[task.status]?.variant || "secondary"} className="text-[11px]">
                          {STATUS_CONFIG[task.status]?.label || task.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {task.status !== "COMPLETED" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenCompleteModal(task)}
                              className="text-xs h-7 text-green-700 hover:text-green-800"
                              title="Tandai Selesai & Isi Temuan"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Selesai
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(task.id)}
                            className="text-destructive hover:text-destructive h-7 w-7 p-0"
                            title="Hapus Tugas"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
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

      {/* Add Task Modal */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleCreate}>
            <DialogHeader>
              <DialogTitle>Buat Penugasan Lapangan Baru</DialogTitle>
              <DialogDescription>
                Tugaskan aktivitas lapangan kepada surveyor, AO marketing, atau staf operasional.
              </DialogDescription>
            </DialogHeader>

            {errorMessage && (
              <div className="bg-destructive/15 text-destructive p-3 rounded-md text-sm my-2">
                {errorMessage}
              </div>
            )}

            <div className="grid gap-3 py-3">
              <div>
                <label className="text-xs font-medium">Judul Tugas / Aktivitas *</label>
                <Input
                  required
                  placeholder="Contoh: Survey Agunan SHM Toko Sembako"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium">Jenis Tugas *</label>
                  <select
                    value={formData.taskType}
                    onChange={(e) => setFormData({ ...formData, taskType: e.target.value })}
                    className="w-full mt-1 h-9 rounded-md border border-input bg-background px-3 py-1 text-xs"
                  >
                    {Object.entries(TASK_TYPE_CONFIG).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium">Prioritas *</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full mt-1 h-9 rounded-md border border-input bg-background px-3 py-1 text-xs"
                  >
                    {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium">Petugas yang Ditugaskan *</label>
                  <select
                    value={formData.assignedOfficerId}
                    onChange={(e) => setFormData({ ...formData, assignedOfficerId: e.target.value })}
                    className="w-full mt-1 h-9 rounded-md border border-input bg-background px-3 py-1 text-xs"
                  >
                    {officers.map((o) => (
                      <option key={o.id} value={o.id}>{o.fullName}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium">Tenggat Waktu Pelaksanaan</label>
                  <Input
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium">Nama Debitur / Kontak</label>
                  <Input
                    placeholder="Nama calon debitur / nasabah"
                    value={formData.customerName}
                    onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium">Nomor Telepon</label>
                  <Input
                    placeholder="0812xxxx"
                    value={formData.customerPhone}
                    onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium">Alamat Lokasi Kunjungan</label>
                <Input
                  placeholder="Alamat tempat tinggal / toko / agunan"
                  value={formData.customerAddress}
                  onChange={(e) => setFormData({ ...formData, customerAddress: e.target.value })}
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-medium">Deskripsi / Petunjuk Penugasan</label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Hal khusus yang perlu dicek atau diverifikasi saat kunjungan..."
                  className="w-full mt-1 p-2 rounded-md border border-input bg-background text-xs"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Menyimpan..." : "Kirim Penugasan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Complete Task Modal */}
      <Dialog open={isCompleteOpen} onOpenChange={setIsCompleteOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <form onSubmit={handleSaveCompletion}>
            <DialogHeader>
              <DialogTitle>Selesaikan Tugas Lapangan</DialogTitle>
              <DialogDescription>
                Tandai tugas &quot;{selectedTask?.title}&quot; sebagai selesai dan input catatan hasil kunjungan.
              </DialogDescription>
            </DialogHeader>

            <div className="py-3 space-y-3">
              <div>
                <label className="text-xs font-medium">Catatan Temuan & Hasil Kunjungan *</label>
                <textarea
                  required
                  rows={4}
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                  placeholder="Hasil pengecekan lokasi, kondisi usaha, konfirmasi nasabah..."
                  className="w-full mt-1.5 p-2 rounded-md border border-input bg-background text-sm"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCompleteOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={isSubmitting} className="bg-green-600 hover:bg-green-700 text-white">
                {isSubmitting ? "Menyimpan..." : "Simpan & Tandai Selesai"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
