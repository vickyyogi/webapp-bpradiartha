import Link from "next/link";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Building2, ShieldCheck, Briefcase, Database, Globe } from "lucide-react";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Panel Admin",
};

export default function AdminDashboardPage() {
  const adminModules = [
    {
      title: "Pengguna (Users)",
      description: "Kelola data pengguna, kata sandi, dan status aktif.",
      icon: Users,
      href: "/admin/users"
    },
    {
      title: "Organisasi & Cabang",
      description: "Kelola data master kantor pusat dan cabang BPR.",
      icon: Building2,
      href: "/admin/branches"
    },
    {
      title: "Peran & Hak Akses",
      description: "Kelola peran (RBAC) dan izin sistem (Permissions).",
      icon: ShieldCheck,
      href: "/admin/roles"
    },
    {
      title: "Departemen",
      description: "Kelola data unit kerja/departemen dalam organisasi.",
      icon: Briefcase,
      href: "/admin/departments"
    },
    {
      title: "Master Data Terpusat",
      description: "Parameter produk pinjaman, kategori aset, jenis dokumen, dan satuan.",
      icon: Database,
      href: "/admin/master-data"
    },
    {
      title: "CMS Publikasi & Website",
      description: "Kelola banner slider, berita & promo, dan tanya jawab (FAQ) publik.",
      icon: Globe,
      href: "/admin/cms"
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Administrasi & Master Data</h1>
        <p className="text-muted-foreground mt-2">
          Pusat pengaturan sistem, master data, dan kontrol akses (RBAC).
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {adminModules.map((module) => {
          const Icon = module.icon;
          return (
            <Link key={module.href} href={module.href}>
              <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
                <CardHeader>
                  <Icon className="h-8 w-8 text-primary mb-2" />
                  <CardTitle>{module.title}</CardTitle>
                  <CardDescription>{module.description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
