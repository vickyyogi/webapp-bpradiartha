"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Camera,
  Calendar,
  X,
  ChevronLeft,
  ChevronRight,
  FileText,
  Tag,
  Sparkles,
  Maximize2,
  Info,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";

interface GalleryItem {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string;
  category: string;
  eventDate: string | null;
  isActive: boolean;
  sortOrder: number;
}

export default function GaleriPage() {
  const [galleries, setGalleries] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/cms/gallery?activeOnly=true&limit=100")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setGalleries(data);
        }
      })
      .catch((err) => console.error("Error loading gallery:", err))
      .finally(() => setLoading(false));
  }, []);

  const categories = [
    { code: "ALL", label: "Semua Foto" },
    { code: "KEGIATAN", label: "Kegiatan Kantor" },
    { code: "CSR", label: "CSR & Bakti Sosial" },
    { code: "SOSIALISASI", label: "Sosialisasi & Workshop" },
    { code: "RAPAT", label: "Rapat & Koordinasi" },
    { code: "PENGHARGAAN", label: "Penghargaan & Prestasi" },
  ];

  const filteredPhotos = galleries.filter((item) => {
    if (selectedCategory === "ALL") return true;
    return item.category.toUpperCase() === selectedCategory.toUpperCase();
  });

  const getCategoryBadgeClass = (category: string) => {
    switch (category?.toUpperCase()) {
      case "KEGIATAN":
        return "bg-primary text-primary-foreground";
      case "CSR":
        return "bg-emerald-700 text-white";
      case "SOSIALISASI":
        return "bg-gold-soft text-gold-dark border border-gold/30";
      case "RAPAT":
        return "bg-primary-soft text-primary border border-primary/20";
      case "PENGHARGAAN":
        return "bg-gold text-white font-semibold";
      default:
        return "bg-muted text-foreground border border-border";
    }
  };

  const handleNextPhoto = () => {
    if (selectedPhotoIndex === null) return;
    setSelectedPhotoIndex((selectedPhotoIndex + 1) % filteredPhotos.length);
  };

  const handlePrevPhoto = () => {
    if (selectedPhotoIndex === null) return;
    setSelectedPhotoIndex(
      (selectedPhotoIndex - 1 + filteredPhotos.length) % filteredPhotos.length
    );
  };

  const activePhoto =
    selectedPhotoIndex !== null ? filteredPhotos[selectedPhotoIndex] : null;

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <PublicHeader />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="bg-gradient-to-b from-primary/10 via-background to-background py-14 md:py-20 border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <Badge variant="outline" className="mb-3 text-xs uppercase tracking-wider text-primary border-primary/30">
                Dokumentasi & Album Foto
              </Badge>
              <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-foreground leading-tight">
                Galeri Foto Kegiatan Kantor
              </h1>
              <p className="mt-4 text-base sm:text-lg text-muted-foreground leading-relaxed">
                Potret kebersamaan, bakti sosial kemasyarakatan, kegiatan operasional lapangan, dan momentum berharga seluruh keluarga besar PT BPR Adiartha Reksacitra.
              </p>

              <div className="mt-6 flex items-center gap-3">
                <Link href="/berita">
                  <Button variant="outline" className="h-10 gap-2 text-xs sm:text-sm">
                    <FileText className="h-4 w-4 text-primary" />
                    Baca Liputan Berita & Kegiatan
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Category Filters */}
        <section className="border-b bg-muted/20 sticky top-20 z-30 backdrop-blur">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 overflow-x-auto">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1 shrink-0 mr-2">
                <Tag className="h-3.5 w-3.5" /> Kategori:
              </span>
              {categories.map((c) => (
                <button
                  key={c.code}
                  onClick={() => setSelectedCategory(c.code)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                    selectedCategory === c.code
                      ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                      : "bg-background border text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Photo Gallery Grid */}
        <section className="py-12 md:py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {loading ? (
              <div className="text-center py-20">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-4" />
                <p className="text-sm text-muted-foreground">Memuat galeri foto kegiatan...</p>
              </div>
            ) : filteredPhotos.length === 0 ? (
              <div className="text-center py-20 border border-dashed rounded-xl p-8 max-w-xl mx-auto">
                <Camera className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <h3 className="text-lg font-bold">Belum Ada Foto</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Belum ada dokumentasi foto yang diunggah pada kategori ini.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedCategory("ALL")}
                  className="mt-4"
                >
                  Tampilkan Semua Foto
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {filteredPhotos.map((photo, index) => (
                  <div
                    key={photo.id}
                    onClick={() => setSelectedPhotoIndex(index)}
                    className="group relative cursor-pointer overflow-hidden rounded-xl border bg-card shadow-sm hover:shadow-lg transition-all duration-300"
                  >
                    <div className="aspect-[4/3] w-full overflow-hidden bg-muted relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.imageUrl}
                        alt={photo.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4 text-white">
                        <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-300 mb-1">
                          <Maximize2 className="h-3.5 w-3.5" /> Klik untuk perbesar
                        </span>
                        <h4 className="font-bold text-sm leading-snug line-clamp-2">
                          {photo.title}
                        </h4>
                      </div>
                    </div>

                    <div className="p-3.5 space-y-1.5">
                      <div className="flex items-center justify-between gap-1 text-[11px]">
                        <Badge className={`text-[9px] font-semibold ${getCategoryBadgeClass(photo.category)}`}>
                          {photo.category}
                        </Badge>
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {photo.eventDate
                            ? new Date(photo.eventDate).toLocaleDateString("id-ID", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })
                            : "-"}
                        </span>
                      </div>
                      <h4 className="font-semibold text-xs text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                        {photo.title}
                      </h4>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Lightbox Modal */}
      {activePhoto && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="relative max-w-4xl w-full bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="p-4 bg-slate-950 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Badge className={`text-[10px] ${getCategoryBadgeClass(activePhoto.category)}`}>
                  {activePhoto.category}
                </Badge>
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {activePhoto.eventDate
                    ? new Date(activePhoto.eventDate).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })
                    : ""}
                </span>
              </div>
              <button
                onClick={() => setSelectedPhotoIndex(null)}
                className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition-colors"
                title="Tutup (Esc)"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Photo Container */}
            <div className="relative flex-1 bg-black flex items-center justify-center min-h-[300px] max-h-[62vh] overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={activePhoto.imageUrl}
                alt={activePhoto.title}
                className="max-h-[62vh] w-auto max-w-full object-contain"
              />

              {/* Prev / Next buttons */}
              {filteredPhotos.length > 1 && (
                <>
                  <button
                    onClick={handlePrevPhoto}
                    className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/90 text-white p-2.5 rounded-full transition-colors"
                    title="Foto Sebelumnya"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    onClick={handleNextPhoto}
                    className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/90 text-white p-2.5 rounded-full transition-colors"
                    title="Foto Selanjutnya"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              )}
            </div>

            {/* Modal Caption */}
            <div className="p-4 sm:p-5 bg-slate-950 text-white border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <h3 className="font-bold text-base sm:text-lg text-slate-100">
                  {activePhoto.title}
                </h3>
                {activePhoto.description && (
                  <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                    {activePhoto.description}
                  </p>
                )}
              </div>
              <div className="text-xs text-slate-500 whitespace-nowrap">
                Foto {(selectedPhotoIndex ?? 0) + 1} dari {filteredPhotos.length}
              </div>
            </div>
          </div>
        </div>
      )}

      <PublicFooter />
    </div>
  );
}
