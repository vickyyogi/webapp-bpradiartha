"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  FileText,
  Search,
  Calendar,
  User,
  ArrowRight,
  Clock,
  Sparkles,
  Camera,
  ChevronRight,
  Tag,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";

interface Post {
  id: string;
  title: string;
  slug: string;
  category: string;
  excerpt: string | null;
  content: string;
  featuredImage: string | null;
  status: string;
  publishedAt: string | null;
  authorName: string | null;
  createdAt: string;
}

export default function BeritaPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetch("/api/cms/posts?status=PUBLISHED&limit=50")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setPosts(data);
        }
      })
      .catch((err) => console.error("Error loading posts:", err))
      .finally(() => setLoading(false));
  }, []);

  const categories = [
    { code: "ALL", label: "Semua Kategori" },
    { code: "KEGIATAN", label: "Kegiatan Kantor" },
    { code: "BERITA", label: "Berita Resmi" },
    { code: "EDUKASI", label: "Edukasi Keuangan" },
    { code: "PROMO", label: "Promo & Produk" },
    { code: "PENGUMUMAN", label: "Pengumuman" },
  ];

  const filteredPosts = posts.filter((post) => {
    const matchesCat =
      selectedCategory === "ALL" ||
      post.category.toUpperCase() === selectedCategory.toUpperCase();
    const matchesSearch =
      searchQuery.trim() === "" ||
      post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (post.excerpt && post.excerpt.toLowerCase().includes(searchQuery.toLowerCase())) ||
      post.content.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const featuredPost = filteredPosts.length > 0 ? filteredPosts[0] : null;
  const remainingPosts = filteredPosts.length > 1 ? filteredPosts.slice(1) : [];

  const getCategoryBadgeClass = (category: string) => {
    switch (category?.toUpperCase()) {
      case "BERITA":
        return "bg-primary text-primary-foreground";
      case "PROMO":
        return "bg-gold-soft text-gold-dark border border-gold/30";
      case "EDUKASI":
        return "bg-yellow-soft text-yellow-800 border border-yellow-200";
      case "KEGIATAN":
        return "bg-primary-soft text-primary border border-primary/20";
      default:
        return "bg-muted text-foreground border border-border";
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <PublicHeader />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="bg-gradient-to-b from-primary/10 via-background to-background py-14 md:py-20 border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <Badge variant="outline" className="mb-3 text-xs uppercase tracking-wider text-primary border-primary/30">
                Publikasi & Kabar Terkini
              </Badge>
              <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-foreground leading-tight">
                Berita, Kegiatan & Edukasi Finansial
              </h1>
              <p className="mt-4 text-base sm:text-lg text-muted-foreground leading-relaxed">
                Ikuti perkembangan terbaru kegiatan operasional, bakti sosial CSR, liputan kantor cabang, serta tips literasi keuangan dari BPR Adiartha Reksacitra.
              </p>

              {/* Search Bar */}
              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Cari artikel berita, kegiatan, atau topik..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-11 bg-background shadow-sm text-sm"
                  />
                </div>
                <Link href="/galeri">
                  <Button variant="outline" className="h-11 gap-2 whitespace-nowrap">
                    <Camera className="h-4 w-4 text-primary" />
                    Lihat Galeri Foto
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

        {/* Content Section */}
        <section className="py-12 md:py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {loading ? (
              <div className="text-center py-20">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-4" />
                <p className="text-sm text-muted-foreground">Memuat artikel dan berita...</p>
              </div>
            ) : filteredPosts.length === 0 ? (
              <div className="text-center py-20 border border-dashed rounded-xl p-8 max-w-xl mx-auto">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <h3 className="text-lg font-bold">Tidak ada artikel ditemukan</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {searchQuery
                    ? `Tidak ada artikel dengan kata kunci "${searchQuery}". Coba kata kunci lain.`
                    : "Belum ada artikel yang dipublikasikan pada kategori ini."}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedCategory("ALL");
                    setSearchQuery("");
                  }}
                  className="mt-4"
                >
                  Reset Pencarian
                </Button>
              </div>
            ) : (
              <div className="space-y-12">
                {/* Featured Headline Post (First item) */}
                {featuredPost && (
                  <div className="bg-card border rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-0">
                      <div className="lg:col-span-7 h-64 sm:h-80 lg:h-auto min-h-[280px] relative bg-muted overflow-hidden">
                        {featuredPost.featuredImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={featuredPost.featuredImage}
                            alt={featuredPost.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary">
                            <FileText className="h-16 w-16 opacity-40" />
                          </div>
                        )}
                        <div className="absolute top-4 left-4">
                          <Badge className={`text-xs font-semibold ${getCategoryBadgeClass(featuredPost.category)}`}>
                            {featuredPost.category}
                          </Badge>
                        </div>
                      </div>

                      <div className="lg:col-span-5 p-6 sm:p-8 flex flex-col justify-between">
                        <div className="space-y-3">
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5" />
                              {featuredPost.publishedAt
                                ? new Date(featuredPost.publishedAt).toLocaleDateString("id-ID", {
                                    day: "numeric",
                                    month: "long",
                                    year: "numeric",
                                  })
                                : "Baru"}
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <User className="h-3.5 w-3.5" />
                              {featuredPost.authorName || "Redaksi"}
                            </span>
                          </div>

                          <h2 className="text-xl sm:text-2xl font-extrabold text-foreground leading-snug hover:text-primary transition-colors">
                            <Link href={`/berita/${featuredPost.slug}`}>
                              {featuredPost.title}
                            </Link>
                          </h2>

                          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-4">
                            {featuredPost.excerpt || featuredPost.content.slice(0, 200) + "..."}
                          </p>
                        </div>

                        <div className="pt-6 mt-4 border-t flex items-center justify-between">
                          <Link href={`/berita/${featuredPost.slug}`}>
                            <Button className="gap-2 text-xs sm:text-sm">
                              Baca Artikel Lengkap <ArrowRight className="h-4 w-4" />
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Grid of Remaining Posts */}
                {remainingPosts.length > 0 && (
                  <div>
                    <h3 className="text-xl font-bold tracking-tight mb-6 flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-primary" />
                      Artikel & Publikasi Lainnya
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {remainingPosts.map((post) => (
                        <Card
                          key={post.id}
                          className="border overflow-hidden hover:shadow-md transition-shadow flex flex-col justify-between group"
                        >
                          <div className="relative h-48 bg-muted overflow-hidden">
                            {post.featuredImage ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={post.featuredImage}
                                alt={post.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-primary/5 text-primary/40">
                                <FileText className="h-12 w-12" />
                              </div>
                            )}
                            <div className="absolute top-3 left-3">
                              <Badge className={`text-[10px] font-semibold ${getCategoryBadgeClass(post.category)}`}>
                                {post.category}
                              </Badge>
                            </div>
                          </div>

                          <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {post.publishedAt
                                    ? new Date(post.publishedAt).toLocaleDateString("id-ID", {
                                        day: "numeric",
                                        month: "short",
                                        year: "numeric",
                                      })
                                    : "Baru"}
                                </span>
                                <span>•</span>
                                <span>{post.authorName || "Redaksi"}</span>
                              </div>

                              <CardTitle className="text-base font-bold leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                                <Link href={`/berita/${post.slug}`}>
                                  {post.title}
                                </Link>
                              </CardTitle>

                              <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                                {post.excerpt || post.content.slice(0, 140) + "..."}
                              </p>
                            </div>

                            <div className="pt-3 border-t flex items-center justify-between">
                              <Link
                                href={`/berita/${post.slug}`}
                                className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                              >
                                Baca Selengkapnya <ChevronRight className="h-3.5 w-3.5" />
                              </Link>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
