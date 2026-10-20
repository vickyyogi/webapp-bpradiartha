"use client";

import { useEffect, useState } from "react";
import { PlusCircle, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type LimitRow = {
  id: string;
  levelName: string;
  minAmount: string | number;
  maxAmount: string | number;
  tierOrder: number;
  isActive: boolean;
  role: { id: string; name: string; code: string };
  branch?: { id: string; name: string; code: string } | null;
};

type Option = { id: string; name: string; code?: string };

const EMPTY = { roleId: "", branchId: "", levelName: "", minAmount: "", maxAmount: "", tierOrder: "1" };

/** Tahap 9B — matriks limit kewenangan memutus, global atau per cabang. */
export default function CreditLimitsPage() {
  const [limits, setLimits] = useState<LimitRow[]>([]);
  const [roles, setRoles] = useState<Option[]>([]);
  const [branches, setBranches] = useState<Option[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [limitRes, optionRes] = await Promise.all([
      fetch("/api/credit/approval-limits"),
      fetch("/api/admin/options"),
    ]);
    const limitJson = await limitRes.json();
    const optionJson = await optionRes.json();
    if (limitRes.ok) setLimits(limitJson.data ?? []);
    if (optionRes.ok) {
      setRoles(optionJson.roles ?? []);
      setBranches(optionJson.branches ?? []);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/credit/approval-limits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal menyimpan limit.");
      setForm(EMPTY);
      setMessage("Limit kewenangan berhasil ditambahkan.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal menyimpan limit.");
    } finally {
      setBusy(false);
    }
  };

  const deactivate = async (id: string) => {
    if (!confirm("Nonaktifkan limit ini? Record tetap tersimpan untuk audit.")) return;
    const res = await fetch(`/api/credit/approval-limits/${id}`, { method: "DELETE" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(json.error || "Gagal menonaktifkan limit.");
      return;
    }
    await load();
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Limit Kewenangan Kredit</h1>
        <p className="text-sm text-muted-foreground">
          Limit tanpa cabang berlaku untuk seluruh organisasi. Limit per cabang menggantikan limit organisasi
          untuk cabang tersebut. Nilai limit adalah kebijakan resmi dan wajib disahkan pemilik proses.
        </p>
      </div>

      {message && <div className="rounded-md border bg-muted/40 p-3 text-sm">{message}</div>}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <PlusCircle className="h-4 w-4" /> Tambah Limit
          </CardTitle>
          <CardDescription>Role, cabang (opsional), rentang plafon, dan urutan tingkat.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-3 md:grid-cols-3">
            <select
              className="h-9 rounded-md border bg-background px-3 text-sm"
              value={form.roleId}
              onChange={(e) => setForm({ ...form, roleId: e.target.value })}
              required
            >
              <option value="">Pilih role</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>{role.name}</option>
              ))}
            </select>
            <select
              className="h-9 rounded-md border bg-background px-3 text-sm"
              value={form.branchId}
              onChange={(e) => setForm({ ...form, branchId: e.target.value })}
            >
              <option value="">Seluruh organisasi</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>{branch.name}</option>
              ))}
            </select>
            <Input
              placeholder="Nama level (mis. Komite Cabang)"
              value={form.levelName}
              onChange={(e) => setForm({ ...form, levelName: e.target.value })}
              required
            />
            <Input
              type="number"
              min={0}
              step={1}
              placeholder="Plafon minimum (Rp)"
              value={form.minAmount}
              onChange={(e) => setForm({ ...form, minAmount: e.target.value })}
              required
            />
            <Input
              type="number"
              min={0}
              step={1}
              placeholder="Plafon maksimum (Rp)"
              value={form.maxAmount}
              onChange={(e) => setForm({ ...form, maxAmount: e.target.value })}
              required
            />
            <Input
              type="number"
              min={1}
              step={1}
              placeholder="Urutan tingkat"
              value={form.tierOrder}
              onChange={(e) => setForm({ ...form, tierOrder: e.target.value })}
              required
            />
            <div className="md:col-span-3">
              <Button type="submit" disabled={busy}>
                <Save className="mr-2 h-4 w-4" /> {busy ? "Menyimpan..." : "Simpan Limit"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Daftar Limit Aktif</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Level</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Cabang</TableHead>
                <TableHead>Rentang Plafon</TableHead>
                <TableHead>Urutan</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {limits.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.levelName}</TableCell>
                  <TableCell>{row.role.name}</TableCell>
                  <TableCell>{row.branch?.name ?? "Seluruh organisasi"}</TableCell>
                  <TableCell>
                    Rp {Number(row.minAmount).toLocaleString("id-ID")} – Rp {Number(row.maxAmount).toLocaleString("id-ID")}
                  </TableCell>
                  <TableCell>{row.tierOrder}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => void deactivate(row.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {limits.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                    Belum ada limit kewenangan.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
