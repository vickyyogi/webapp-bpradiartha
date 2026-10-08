import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pengguna (Users)",
};

export default function AdminUsersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
