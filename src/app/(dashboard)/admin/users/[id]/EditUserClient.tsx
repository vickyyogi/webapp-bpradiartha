"use client";

import { useEffect, useState } from "react";

import { UserFormPage } from "../UserFormPage";

type EditableUser = {
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

export function EditUserClient({ userId }: { userId: string }) {
  const [user, setUser] = useState<EditableUser | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/users");
        if (!res.ok) throw new Error("Gagal memuat data");
        const users: EditableUser[] = await res.json();
        const found = users.find((u) => u.id === userId);
        if (found) setUser(found);
        else setNotFound(true);
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  if (loading) {
    return <div className="p-6 text-muted-foreground">Memuat data pengguna...</div>;
  }

  if (notFound || !user) {
    return (
      <div className="p-6 text-muted-foreground">
        Pengguna tidak ditemukan.
      </div>
    );
  }

  return (
    <UserFormPage
      title="Edit Pengguna"
      description={`Ubah data dan peran akses untuk ${user.fullName}.`}
      editingUser={user}
    />
  );
}
