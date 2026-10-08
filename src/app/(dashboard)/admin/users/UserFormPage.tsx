"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";

type Option = { id: string; name: string };

export type UserFormData = {
  fullName: string;
  email: string;
  password: string;
  phone: string;
  employeeNumber: string;
  branchId: string;
  departmentId: string;
  isActive: boolean;
  roleIds: string[];
};

type EditingUser = {
  id: string;
  fullName: string;
  email: string;
  phone?: string | null;
  employeeNumber?: string | null;
  isActive: boolean;
  branch?: { id: string; name: string } | null;
  department?: { id: string; name: string } | null;
  userRoles: { role: { id: string; name: string } }[];
};

const EMPTY_FORM: UserFormData = {
  fullName: "",
  email: "",
  password: "",
  phone: "",
  employeeNumber: "",
  branchId: "none",
  departmentId: "none",
  isActive: true,
  roleIds: [],
};

export function userToFormData(user: EditingUser): UserFormData {
  return {
    fullName: user.fullName,
    email: user.email,
    password: "", // kosong saat edit; isi hanya jika ingin mengubah
    phone: user.phone || "",
    employeeNumber: user.employeeNumber || "",
    branchId: user.branch?.id || "none",
    departmentId: user.department?.id || "none",
    isActive: user.isActive,
    roleIds: user.userRoles.map((ur) => ur.role.id),
  };
}

export function UserFormPage({
  title,
  description,
  editingUser,
}: {
  title: string;
  description: string;
  editingUser: EditingUser | null;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [branches, setBranches] = useState<Option[]>([]);
  const [departments, setDepartments] = useState<Option[]>([]);
  const [roles, setRoles] = useState<Option[]>([]);
  const [formData, setFormData] = useState<UserFormData>(
    editingUser ? userToFormData(editingUser) : EMPTY_FORM
  );

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/options");
        if (res.ok) {
          const options = await res.json();
          setBranches(options.branches || []);
          setDepartments(options.departments || []);
          setRoles(options.roles || []);
        }
      } catch {
        // dropdown tetap kosong
      }
    })();
  }, []);

  const handleRoleToggle = (roleId: string) => {
    setFormData((prev) => ({
      ...prev,
      roleIds: prev.roleIds.includes(roleId)
        ? prev.roleIds.filter((id) => id !== roleId)
        : [...prev.roleIds, roleId],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    const payload = {
      ...formData,
      branchId: formData.branchId === "none" ? null : formData.branchId,
      departmentId: formData.departmentId === "none" ? null : formData.departmentId,
    };

    try {
      const url = editingUser ? `/api/users/${editingUser.id}` : "/api/users";
      const method = editingUser ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Gagal menyimpan data");
      }

      router.push("/admin/users");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan data");
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => router.push("/admin/users")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Kembali
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Data Pengguna</CardTitle>
          <CardDescription>
            Lengkapi informasi pengguna beserta peran aksesnya.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">
                  Nama Lengkap <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="fullName"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">
                  Email <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">
                  Password{" "}
                  {editingUser && (
                    <span className="text-muted-foreground text-xs font-normal">
                      (Kosongkan jika tidak diubah)
                    </span>
                  )}
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required={!editingUser}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">No. HP</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="employeeNumber">No. Pegawai</Label>
                <Input
                  id="employeeNumber"
                  value={formData.employeeNumber}
                  onChange={(e) => setFormData({ ...formData, employeeNumber: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="branch">Cabang</Label>
                <Select
                  value={formData.branchId}
                  onValueChange={(val) => setFormData({ ...formData, branchId: val || "none" })}
                >
                  <SelectTrigger id="branch">
                    <SelectValue placeholder="Pilih Cabang" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- Tidak Ada --</SelectItem>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="department">Departemen</Label>
                <Select
                  value={formData.departmentId}
                  onValueChange={(val) => setFormData({ ...formData, departmentId: val || "none" })}
                >
                  <SelectTrigger id="department">
                    <SelectValue placeholder="Pilih Departemen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- Tidak Ada --</SelectItem>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3">
              <Label>Peran / Role</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {roles.map((role) => (
                  <label
                    key={role.id}
                    className="flex items-center space-x-2 border p-2 rounded cursor-pointer hover:bg-muted/50"
                  >
                    <input
                      type="checkbox"
                      checked={formData.roleIds.includes(role.id)}
                      onChange={() => handleRoleToggle(role.id)}
                      className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                    />
                    <span className="text-sm">{role.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <Label htmlFor="isActive" className="cursor-pointer">
                Status Aktif
              </Label>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => router.push("/admin/users")}>
                Batal
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Menyimpan..." : "Simpan"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
