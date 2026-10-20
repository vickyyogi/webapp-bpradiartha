"use client";

import Link from "next/link";
import {
  ShieldCheck,
  Phone,
  Mail,
  MapPin,
  Clock,
  Lock,
} from "lucide-react";

export function PublicFooter() {
  return (
    <footer id="kontak" className="bg-lp-band text-lp-band-text pt-16 pb-12 scroll-mt-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-4 gap-8 pb-12 border-b border-lp-band-border">
          <div className="space-y-4">
            <div className="relative h-15 w-56 sm:w-64">
              <div className="flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/logo.svg"
                  alt="Logo BPR Adiartha"
                  className="max-h-10 w-auto object-contain object-left"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "/logo.png";
                  }}
                />
                <span className="font-semibold text-lp-band-text">BPR Adiartha Reksacitra</span>
              </div>
            </div>
            <p className="text-xs text-lp-band-muted leading-relaxed">
              PT BPR Adiartha Utama merupakan lembaga jasa keuangan yang berkomitmen memberdayakan ekonomi masyarakat
              dan UMKM di Malang Raya.
            </p>
            <div className="pt-2">
              <span className="lp-eyebrow text-[9px] inline-flex items-center gap-1.5 rounded-full border border-lp-accent/40 bg-lp-accent-soft px-3 py-1.5 text-lp-accent">
                <ShieldCheck className="h-3 w-3" /> Terdaftar & Diawasi oleh OJK
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="lp-eyebrow text-lp-accent">Publikasi & Layanan</h4>
            <ul className="space-y-2 text-xs text-lp-band-muted">
              <li>
                <Link href="/berita" className="hover:text-lp-band-text transition-colors">
                  Berita & Kegiatan Kantor
                </Link>
              </li>
              <li>
                <Link href="/galeri" className="hover:text-lp-band-text transition-colors">
                  Galeri Foto Kegiatan
                </Link>
              </li>
              <li>
                <Link href="#produk" className="hover:text-lp-band-text transition-colors">
                  Kredit Modal Kerja
                </Link>
              </li>
              <li>
                <Link href="#produk" className="hover:text-lp-band-text transition-colors">
                  Kredit Multi Guna
                </Link>
              </li>
              <li>
                <Link href="#produk" className="hover:text-lp-band-text transition-colors">
                  Kredit Investasi
                </Link>
              </li>
              <li>
                <Link href="#produk" className="hover:text-lp-band-text transition-colors">
                  Deposito Berjangka
                </Link>
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="lp-eyebrow text-lp-accent">Kantor & Layanan</h4>
            <div className="space-y-2 text-xs text-lp-band-muted">
              <p className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-lp-accent shrink-0 mt-0.5" />
                <span>Kantor Pusat: Jl. Raya Mondoroko No.114 Pagentan Singosari - Malang</span>
              </p>
              <p className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-lp-accent shrink-0" />
                <span>(0341) 453200 </span>
                <span> - </span>
                <span className="text-semibold text-lp-accent">(WA) <Link href="https://wa.me/+6281383555501" target="_blank" rel="noopener noreferrer" className="hover:text-lp-band-text transition-colors">
                  081383555501
                </Link></span>
              </p>
              <p className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-lp-accent shrink-0" />
                <span>halo@bpradiartha.com</span>
              </p>
              <p className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-lp-accent shrink-0" />
                <span>Senin - Jumat: 07.30 - 15.30 WIB</span>
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="lp-eyebrow text-lp-accent">Portal Staf BPR</h4>
            <p className="text-xs text-lp-band-muted">
              Akses khusus staf internal untuk manajemen CRM, analisa 5C, tugas survey, dan komite kredit.
            </p>
            <Link
              href="/login"
              className="lp-btn lp-btn-band-ghost w-full gap-2 mt-2 py-2.5 text-xs font-medium"
            >
              <Lock className="h-3.5 w-3.5" /> Masuk Portal Staf
            </Link>
          </div>
        </div>

        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-lp-band-muted gap-4">
          <p>&copy; {new Date().getFullYear()} PT BPR Adiartha. Seluruh Hak Cipta Dilindungi Undang-Undang.</p>
          <p>PT BPR Adiartha berizin dan diawasi oleh Otoritas Jasa Keuangan (OJK) serta peserta penjaminan LPS.</p>
        </div>
      </div>
    </footer>
  );
}
