"use client";

import { useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Edit, Trash2, Plus, Search } from "lucide-react";

export default function RolesPage() {
  const [roles, setRoles] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({ id: "", code: "", name: "", description: "" });
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const permsRes = await fetch("/api/admin/permissions");
      let perms = await permsRes.json();
      
      if (!permsRes.ok) throw new Error("Failed to fetch permissions");

      if (perms.length === 0) {
        // Auto-seed
        await fetch("/api/admin/permissions", { method: "POST" });
        const newPermsRes = await fetch("/api/admin/permissions");
        perms = await newPermsRes.json();
      }

      setPermissions(perms);

      const rolesRes = await fetch("/api/admin/roles");
      if (!rolesRes.ok) throw new Error("Failed to fetch roles");
      const r = await rolesRes.json();
      setRoles(r);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenNew = () => {
    setFormData({ id: "", code: "", name: "", description: "" });
    setSelectedPerms([]);
    setIsEditing(false);
    setIsOpen(true);
  };

  const handleOpenEdit = (role: any) => {
    setFormData({
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description || "",
    });
    setSelectedPerms(role.permissions?.map((rp: any) => rp.permission.id) || []);
    setIsEditing(true);
    setIsOpen(true);
  };

  const handleDelete = async (id: string, isSystem: boolean) => {
    if (isSystem) {
      alert("Peran sistem tidak dapat dihapus.");
      return;
    }
    if (confirm("Apakah Anda yakin ingin menghapus peran ini?")) {
      try {
        const res = await fetch(`/api/admin/roles/${id}`, { method: "DELETE" });
        if (res.ok) {
          fetchData();
        } else {
          const data = await res.json();
          alert(data.error || "Gagal menghapus peran");
        }
      } catch (error) {
        console.error(error);
        alert("Terjadi kesalahan.");
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const url = isEditing ? `/api/admin/roles/${formData.id}` : "/api/admin/roles";
      const method = isEditing ? "PUT" : "POST";
      const payload = {
        code: formData.code.toUpperCase(),
        name: formData.name,
        description: formData.description,
        permissionIds: selectedPerms
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setIsOpen(false);
        fetchData();
      } else {
        const data = await res.json();
        alert(data.error || "Gagal menyimpan peran");
      }
    } catch (error) {
      console.error(error);
      alert("Terjadi kesalahan");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePermToggle = (id: string) => {
    setSelectedPerms(prev => 
      prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id]
    );
  };

  const filteredRoles = roles.filter(r => 
    r.name?.toLowerCase().includes(search.toLowerCase()) || 
    r.code?.toLowerCase().includes(search.toLowerCase())
  );

  const getDomainFromCode = (code: string) => code.split('.')[0];
  const domains = Array.from(new Set(permissions.map(p => getDomainFromCode(p.code))));

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Manajemen Peran</h2>
        <Button onClick={handleOpenNew}>
          <Plus className="mr-2 h-4 w-4" /> Tambah Peran
        </Button>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Daftar Peran</CardTitle>
          <CardDescription>Kelola peran dan izin untuk pengguna sistem.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center mb-4 max-w-sm">
            <Search className="mr-2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Cari peran..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">No</TableHead>
                  <TableHead>Kode</TableHead>
                  <TableHead>Nama Peran</TableHead>
                  <TableHead>Deskripsi</TableHead>
                  <TableHead className="max-w-[300px]">Izin</TableHead>
                  <TableHead>Tipe</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={7} className="text-center">Memuat data...</TableCell></TableRow>
                ) : filteredRoles.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center">Tidak ada data.</TableCell></TableRow>
                ) : (
                  filteredRoles.map((role, idx) => (
                    <TableRow key={role.id}>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell className="font-medium">{role.code}</TableCell>
                      <TableCell>{role.name}</TableCell>
                      <TableCell>{role.description}</TableCell>
                      <TableCell className="max-w-[300px] flex flex-wrap gap-1 py-2">
                        {role.permissions?.map((rp: any) => (
                          <Badge key={rp.permission.id} variant="secondary" className="text-xs">
                            {rp.permission.name}
                          </Badge>
                        ))}
                      </TableCell>
                      <TableCell>
                        {role.isSystem ? <Badge variant="default">Sistem</Badge> : <Badge variant="outline">Custom</Badge>}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(role)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(role.id, role.isSystem)} disabled={role.isSystem}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit Peran" : "Tambah Peran"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Kode Peran</Label>
              <Input
                className="col-span-3 uppercase"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                required
                disabled={isEditing}
                placeholder="Misal: ADMIN_KREDIT"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Nama Peran</Label>
              <Input
                className="col-span-3"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                placeholder="Misal: Admin Kredit"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Deskripsi</Label>
              <Input
                className="col-span-3"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            
            <div className="pt-4 border-t">
              <h3 className="font-semibold mb-3">Daftar Izin</h3>
              <div className="space-y-4">
                {domains.map(domain => (
                  <div key={domain} className="space-y-2">
                    <h4 className="font-medium text-sm text-muted-foreground capitalize">{domain}</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {permissions.filter(p => getDomainFromCode(p.code) === domain).map(p => (
                        <div key={p.id} className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-2">
                          <Checkbox
                            id={p.id}
                            checked={selectedPerms.includes(p.id)}
                            onCheckedChange={() => handlePermToggle(p.id)}
                          />
                          <div className="space-y-1 leading-none">
                            <Label htmlFor={p.id} className="text-sm font-medium leading-none cursor-pointer">
                              {p.name}
                            </Label>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Menyimpan..." : "Simpan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
