import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Calendar,
  User,
  ArrowLeft,
  Share2,
  Clock,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  Phone,
  MessageCircle,
  FileText,
} from "lucide-react";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import { Metadata } from "next";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await db.cmsPost.findFirst({
    where: { slug, status: "PUBLISHED" },
    select: { title: true, excerpt: true, featuredImage: true },
  });

  if (!post) {
    return { title: "Berita & Kegiatan" };
  }

  return {
    title: post.title,
    description: post.excerpt ?? undefined,
    openGraph: post.featuredImage ? { images: [post.featuredImage] } : undefined,
  };
}

export default async function BeritaDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const post = await db.cmsPost.findFirst({
    where: { slug, status: "PUBLISHED" },
  });

  if (!post) {
    notFound();
  }

  // Fetch 3 related or recent articles
  const relatedPosts = await db.cmsPost.findMany({
    where: {
      slug: { not: slug },
      status: "PUBLISHED",
    },
    orderBy: { createdAt: "desc" },
    take: 3,
  });

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

  const paragraphs = post.content.split(/\n\s*\n/).filter((p) => p.trim() !== "");

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <PublicHeader />

      <main className="flex-1">
        {/* Breadcrumb Header */}
        <section className="bg-muted/40 border-b py-4">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav className="flex items-center gap-2 text-xs text-muted-foreground overflow-x-auto">
              <Link href="/" className="hover:text-primary transition-colors">
                Beranda
              </Link>
              <ChevronRight className="h-3 w-3 shrink-0" />
              <Link href="/berita" className="hover:text-primary transition-colors">
                Berita & Kegiatan
              </Link>
              <ChevronRight className="h-3 w-3 shrink-0" />
              <span className="font-semibold text-foreground truncate max-w-[200px] sm:max-w-md">
                {post.title}
              </span>
            </nav>
          </div>
        </section>

        {/* Article Body */}
        <article className="py-10 md:py-16">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Back link */}
            <div className="mb-6">
              <Link
                href="/berita"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-primary transition-colors"
              >
                <ArrowLeft className="h-4 w-4" /> Kembali ke Daftar Berita & Kegiatan
              </Link>
            </div>

            {/* Title & Metadata */}
            <div className="space-y-4 pb-8 border-b">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={`text-xs font-semibold ${getCategoryBadgeClass(post.category)}`}>
                  {post.category}
                </Badge>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {post.publishedAt
                    ? new Date(post.publishedAt).toLocaleDateString("id-ID", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })
                    : "Baru Saja"}
                </span>
                <span className="text-muted-foreground">•</span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <User className="h-3.5 w-3.5" />
                  {post.authorName || "Redaksi BPR Adiartha"}
                </span>
              </div>

              <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-foreground leading-tight">
                {post.title}
              </h1>

              {post.excerpt && (
                <p className="text-base sm:text-lg text-muted-foreground leading-relaxed italic border-l-4 border-primary/50 pl-4 py-1">
                  &ldquo;{post.excerpt}&rdquo;
                </p>
              )}
            </div>

            {/* Featured Image */}
            {post.featuredImage && (
              <div className="my-8 rounded-2xl overflow-hidden border shadow-sm bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={post.featuredImage}
                  alt={post.title}
                  className="w-full max-h-[480px] object-cover"
                />
              </div>
            )}

            {/* Content Body (Supports WYSIWYG Rich HTML and Plaintext Paragraphs) */}
            {/<[a-z][\s\S]*>/i.test(post.content) ? (
              <div
                className="prose prose-slate max-w-none text-foreground text-sm sm:text-base leading-relaxed space-y-4 [&>p]:leading-relaxed [&>p]:text-justify [&>h2]:text-2xl [&>h2]:font-bold [&>h2]:mt-8 [&>h2]:mb-3 [&>h3]:text-xl [&>h3]:font-bold [&>h3]:mt-6 [&>h3]:mb-2 [&>ul]:list-disc [&>ul]:pl-6 [&>ul]:my-4 [&>ol]:list-decimal [&>ol]:pl-6 [&>ol]:my-4 [&>blockquote]:border-l-4 [&>blockquote]:border-primary [&>blockquote]:pl-4 [&>blockquote]:italic [&>blockquote]:text-muted-foreground [&>blockquote]:my-6 [&>img]:rounded-xl [&>img]:max-w-full [&>img]:my-6 [&>img]:shadow-sm [&>a]:text-primary [&>a]:underline [&>hr]:my-8 [&>hr]:border-border"
                dangerouslySetInnerHTML={{ __html: post.content }}
              />
            ) : (
              <div className="prose prose-slate max-w-none text-foreground text-sm sm:text-base leading-relaxed space-y-5">
                {paragraphs.map((p, idx) => (
                  <p key={idx} className="leading-relaxed text-justify text-slate-800 dark:text-slate-200">
                    {p}
                  </p>
                ))}
              </div>
            )}

            {/* Share & Consultation Box */}
            <div className="mt-12 pt-8 border-t space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl bg-muted/40 border">
                <div>
                  <h4 className="font-bold text-sm">Bagikan Informasi Ini</h4>
                  <p className="text-xs text-muted-foreground">
                    Bantu sebarkan liputan kegiatan kantor atau edukasi perbankan ini kepada rekan Anda.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                      `${post.title} - Baca selengkapnya di: `
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 h-9 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white px-3 text-xs font-semibold shadow-sm transition-colors"
                  >
                    <MessageCircle className="h-4 w-4" /> WhatsApp
                  </a>
                  <Link href="/galeri">
                    <Button variant="outline" size="sm" className="text-xs">
                      Lihat Foto Lainnya
                    </Button>
                  </Link>
                </div>
              </div>

              {/* Consultation Callout */}
              <div className="p-6 rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-primary">
                    <ShieldCheck className="h-4 w-4" /> Layanan BPR Adiartha Reksacitra
                  </span>
                  <h4 className="text-base font-bold text-foreground">
                    Tertarik dengan Produk Kredit Modal Kerja atau Tabungan Kami?
                  </h4>
                  <p className="text-xs text-muted-foreground max-w-xl">
                    Tim Account Officer kami siap mendampingi proses konsultasi dan survei tempat usaha Anda secara cepat dan transparan.
                  </p>
                </div>
                <Link href="/#form-pengajuan">
                  <Button className="shrink-0 font-semibold gap-1 text-xs sm:text-sm">
                    Ajukan Sekarang <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>

            {/* Related Articles */}
            {relatedPosts.length > 0 && (
              <div className="mt-16 pt-10 border-t">
                <h3 className="text-xl font-bold tracking-tight mb-6 flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Artikel & Kegiatan Terkait
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {relatedPosts.map((r) => (
                    <Card key={r.id} className="border overflow-hidden hover:shadow-md transition-shadow flex flex-col justify-between">
                      <div className="h-36 bg-muted relative overflow-hidden">
                        {r.featuredImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={r.featuredImage}
                            alt={r.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-primary/5 text-primary/40">
                            <FileText className="h-8 w-8" />
                          </div>
                        )}
                        <div className="absolute top-2 left-2">
                          <Badge className={`text-[9px] ${getCategoryBadgeClass(r.category)}`}>
                            {r.category}
                          </Badge>
                        </div>
                      </div>

                      <div className="p-4 flex-1 flex flex-col justify-between space-y-2">
                        <h4 className="font-bold text-xs line-clamp-2 leading-snug hover:text-primary transition-colors">
                          <Link href={`/berita/${r.slug}`}>{r.title}</Link>
                        </h4>
                        <div className="pt-2 border-t flex items-center justify-between text-[10px] text-muted-foreground">
                          <span>{r.publishedAt ? new Date(r.publishedAt).toLocaleDateString("id-ID") : ""}</span>
                          <Link href={`/berita/${r.slug}`} className="text-primary font-semibold hover:underline">
                            Baca &rarr;
                          </Link>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        </article>
      </main>

      <PublicFooter />
    </div>
  );
}
