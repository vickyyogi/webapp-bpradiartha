import { Metadata } from "next";

import { EditUserClient } from "../EditUserClient";

export const metadata: Metadata = {
  title: "Edit Pengguna | BPR Adiartha Reksacitra",
};

export default async function EditUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EditUserClient userId={id} />;
}
