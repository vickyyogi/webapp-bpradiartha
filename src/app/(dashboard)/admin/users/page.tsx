"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Plus, Edit2, Ban } from "lucide-react";

type User = {
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

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/users");
      if (res.ok) setUsers(await res.json());
    } catch (error) {
      console.error("Error fetching data", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleToggleActive = async (user: User) => {
    if (!confirm(`Apakah Anda yakin ingin menonaktifkan pengguna ${user.fullName}?`)) return;
    
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Gagal mengubah status");

      fetchData();
    } catch (error) {
      console.error("Error toggling status", error);
    }
  };

  const filteredUsers = users.filter(user => 
    user.fullName.toLowerCase().includes(search.toLowerCase()) || 
    user.email.toLowerCase().includes(search.toLowerCase()) ||
    (user.employeeNumber && user.employeeNumber.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Manajemen Pengguna</h1>
          <p className="text-sm text-muted-foreground">
            Kelola akun internal beserta peran aksesnya.
          </p>
        </div>
        <Button onClick={() => router.push("/admin/users/new")}>
          <Plus className="w-4 h-4 mr-2" />
          Tambah Pengguna
        </Button>
      </div>

      <div className="flex items-center space-x-2 bg-white p-4 rounded-lg shadow-sm">
        <Search className="w-5 h-5 text-gray-400" />
        <Input
          type="text"
          placeholder="Cari nama, email, atau no pegawai..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border-none shadow-none focus-visible:ring-0"
        />
      </div>

      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">No</TableHead>
              <TableHead>Nama Lengkap</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>No. Pegawai</TableHead>
              <TableHead>Cabang</TableHead>
              <TableHead>Departemen</TableHead>
              <TableHead>Peran</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-gray-500">Memuat data...</TableCell>
              </TableRow>
            ) : filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-gray-500">Tidak ada data pengguna.</TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user, idx) => (
                <TableRow key={user.id}>
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell className="font-medium">{user.fullName}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.employeeNumber || "-"}</TableCell>
                  <TableCell>{user.branch?.name || "-"}</TableCell>
                  <TableCell>{user.department?.name || "-"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {user.userRoles.length > 0 ? (
                        user.userRoles.map(ur => (
                          <Badge key={ur.role.id} variant="secondary" className="text-xs">
                            {ur.role.name}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-gray-400 text-sm">-</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {user.isActive ? (
                      <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none">Aktif</Badge>
                    ) : (
                      <Badge variant="outline" className="text-gray-500">Tidak Aktif</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/admin/users/${user.id}/edit`)}
                      >
                        <Edit2 className="w-4 h-4 text-blue-600" />
                      </Button>
                      {user.isActive && (
                        <Button variant="ghost" size="sm" onClick={() => handleToggleActive(user)}>
                          <Ban className="w-4 h-4 text-red-600" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

    </div>
  );
}
