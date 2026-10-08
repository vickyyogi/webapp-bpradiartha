"use client";

import Link from "next/link";
import {
  ShieldCheck,
  Building2,
  Phone,
  Mail,
  MapPin,
  Clock,
  Lock,
  FileText,
  Camera,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function PublicFooter() {
  return (
    <footer id="kontak" className="bg-card text-card-foreground border-t pt-16 pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 pb-12 border-b border-border">
            <div className="space-y-4">
              <div className="relative h-12 w-56 sm:w-64">
                <img
                  src="/logo-arc.png"
                  alt="Logo BPR Adiartha"
                  
                  sizes="(max-width: 768px) 224px, 256px"
                  className="object-contain object-left"
                />
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                PT BPR Adiartha Utama merupakan lembaga jasa keuangan yang berkomitmen memberdayakan ekonomi masyarakat dan UMKM di Malang Raya.
              </p>
              <div className="pt-2">
                <Badge variant="outline" className="border-green-600 text-green-700 bg-green-50 text-[10px]">
                  Terdaftar & Diawasi oleh OJK
                </Badge>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-bold tracking-wider uppercase">Publikasi & Layanan</h4>
              <ul className="space-y-2 text-xs text-muted-foreground">
                <li><Link href="/berita" className="hover:text-primary transition-colors">Berita & Kegiatan Kantor</Link></li>
                <li><Link href="/galeri" className="hover:text-primary transition-colors">Galeri Foto Kegiatan</Link></li>   
                <li><Link href="#produk" className="hover:text-primary transition-colors">Kredit Modal Kerja</Link></li>
                <li><Link href="#produk" className="hover:text-primary transition-colors">Kredit Multi Guna</Link></li>
                <li><Link href="#produk" className="hover:text-primary transition-colors">Kredit Investasi</Link></li>
                <li><Link href="#produk" className="hover:text-primary transition-colors">Deposito Berjangka</Link></li>
              </ul>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-bold tracking-wider uppercase">Kantor & Layanan</h4>
              <div className="space-y-2 text-xs text-muted-foreground">
                <p className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span>Kantor Pusat: Jl. Raya Mondoroko No.114 Pagentan Singosari - Malang</span>
                </p>
                <p className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-primary shrink-0" />
                  <span>(0341) 453200 </span><span> - </span>
                  <span>(WA) 081383555501</span>
                </p>
                <p className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-primary shrink-0" />
                  <span>halo@bpradiartha.com</span>
                </p>
                <p className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary shrink-0" />
                  <span>Senin - Jumat: 07.30 - 15.30 WIB</span>
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-bold tracking-wider uppercase">Portal Staf BPR</h4>
              <p className="text-xs text-muted-foreground">
                Akses khusus staf internal untuk manajemen CRM, analisa 5C, tugas survey, dan komite kredit.
              </p>
              <Link href="/login">
                <Button variant="outline" size="sm" className="w-full gap-2 mt-2 font-medium">
                  <Lock className="h-3.5 w-3.5" /> Masuk Portal Staf
                </Button>
              </Link>
            </div>
          </div>

          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-muted-foreground gap-4">
            <p>&copy; {new Date().getFullYear()} PT BPR Adiartha. Seluruh Hak Cipta Dilindungi Undang-Undang.</p>
            <p>PT BPR Adiartha berizin dan diawasi oleh Otoritas Jasa Keuangan (OJK) serta peserta penjaminan LPS.</p>
          </div>
        </div>
      </footer>
  );
}
