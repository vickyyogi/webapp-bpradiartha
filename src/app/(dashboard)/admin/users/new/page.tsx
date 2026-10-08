import { Metadata } from "next";

import { UserFormPage } from "../UserFormPage";

export const metadata: Metadata = {
  title: "Tambah Pengguna | BPR Adiartha Reksacitra",
};

export default function NewUserPage() {
  return (
    <UserFormPage
      title="Tambah Pengguna Baru"
      description="Daftarkan pengguna internal baru beserta peran aksesnya."
      editingUser={null}
    />
  );
}
