"use client";

import { useState, useEffect, useRef } from "react";
import {
  Globe,
  Plus,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Image as ImageIcon,
  FileText,
  HelpCircle,
  ExternalLink,
  Camera,
  Upload,
  Calendar,
  Eye,
  Layers,
  Sparkles,
  ArrowLeft,
  Save,
  Send,
  Link as LinkIcon,
  ShoppingBag,
  Briefcase,
  CreditCard,
  PiggyBank,
  Building2,
  ShieldCheck,
  Wallet,
  Coins,
  Landmark,
  CheckCircle2,
  Search,
  Download,
  Loader2,
  Images,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { WysiwygEditor } from "@/components/cms/WysiwygEditor";

interface Banner {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  ctaText: string | null;
  ctaLink: string | null;
  isActive: boolean;
  sortOrder: number;
}

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

interface Faq {
  id: string;
  category: string;
  question: string;
  answer: string;
  sortOrder: number;
  isActive: boolean;
}

interface GalleryItem {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string;
  category: string;
  eventDate: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
}

interface HeroSlide {
  id: string;
  title: string | null;
  altText: string | null;
  imageUrl: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
}

interface Product {
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string;
  features: string;
  icon: string | null;
  badge: string | null;
  ctaText: string | null;
  ctaLink: string | null;
  sortOrder: number;
  isActive: boolean;
  isDefault: boolean;
  createdAt: string;
}

interface CmsReport {
  id: string;
  title: string;
  slug: string;
  category: string;
  period: string | null;
  year: number | null;
  description: string | null;
  fileUrl: string;
  fileName: string | null;
  fileSize: number | null;
  publishedAt: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
}

export default function CmsManagementPage() {
  const [activeTab, setActiveTab] = useState("products");
  const [banners, setBanners] = useState<Banner[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [galleries, setGalleries] = useState<GalleryItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [reports, setReports] = useState<CmsReport[]>([]);
  const [loading, setLoading] = useState(true);

  // Report filter states
  const [reportFilterCategory, setReportFilterCategory] = useState("ALL");
  const [reportFilterYear, setReportFilterYear] = useState("ALL");
  const [reportSearchQuery, setReportSearchQuery] = useState("");
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [editingReport, setEditingReport] = useState<CmsReport | null>(null);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [reportForm, setReportForm] = useState({
    title: "",
    slug: "",
    category: "KEUANGAN",
    period: "Triwulan II",
    year: new Date().getFullYear(),
    description: "",
    fileUrl: "",
    fileName: "",
    fileSize: 0,
    publishedAt: new Date().toISOString().split("T")[0],
    sortOrder: 0,
    isActive: true,
  });

  // Dedicated WYSIWYG Writer State
  const [isWritingPost, setIsWritingPost] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [postForm, setPostForm] = useState({
    title: "",
    slug: "",
    category: "KEGIATAN",
    excerpt: "",
    content: "",
    featuredImage: "",
    status: "PUBLISHED",
    authorName: "Humas & Protokoler",
  });

  // Dialog States for Banner, FAQ, Gallery, and Products
  const [bannerModalOpen, setBannerModalOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [bannerForm, setBannerForm] = useState({
    title: "",
    subtitle: "",
    imageUrl: "",
    ctaText: "",
    ctaLink: "",
    sortOrder: 0,
    isActive: true,
  });

  const [faqModalOpen, setFaqModalOpen] = useState(false);
  const [editingFaq, setEditingFaq] = useState<Faq | null>(null);
  const [faqForm, setFaqForm] = useState({
    category: "UMUM",
    question: "",
    answer: "",
    sortOrder: 0,
    isActive: true,
  });

  const [galleryModalOpen, setGalleryModalOpen] = useState(false);
  const [editingGallery, setEditingGallery] = useState<GalleryItem | null>(null);
  const [galleryForm, setGalleryForm] = useState({
    title: "",
    description: "",
    imageUrl: "",
    category: "KEGIATAN",
    eventDate: new Date().toISOString().split("T")[0],
    sortOrder: 0,
    isActive: true,
  });

  // Hero slideshow slides (public landing page hero)
  const [heroSlides, setHeroSlides] = useState<HeroSlide[]>([]);
  const [heroModalOpen, setHeroModalOpen] = useState(false);
  const [editingHeroSlide, setEditingHeroSlide] = useState<HeroSlide | null>(null);
  const [heroUploading, setHeroUploading] = useState(false);
  const [heroForm, setHeroForm] = useState({
    title: "",
    altText: "",
    imageUrl: "",
    sortOrder: 0,
    isActive: true,
  });

  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState({
    name: "",
    category: "KREDIT",
    description: "",
    featuresText: "",
    icon: "Briefcase",
    badge: "",
    ctaText: "Ajukan Pinjaman",
    ctaLink: "#form-pengajuan",
    sortOrder: 0,
    isActive: true,
  });

  const postImageInputRef = useRef<HTMLInputElement>(null);
  const galleryImageInputRef = useRef<HTMLInputElement>(null);
  const heroImageInputRef = useRef<HTMLInputElement>(null);
  const pdfFileInputRef = useRef<HTMLInputElement>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [bannersRes, postsRes, faqsRes, galleryRes, productsRes, reportsRes, heroRes] = await Promise.all([
        fetch("/api/cms/banners"),
        fetch("/api/cms/posts"),
        fetch("/api/cms/faqs"),
        fetch("/api/cms/gallery"),
        fetch("/api/cms/products"),
        fetch("/api/cms/reports?active=ALL"),
        fetch("/api/cms/hero-slides"),
      ]);

      if (bannersRes.ok) setBanners(await bannersRes.json());
      if (postsRes.ok) setPosts(await postsRes.json());
      if (faqsRes.ok) setFaqs(await faqsRes.json());
      if (galleryRes.ok) setGalleries(await galleryRes.json());
      if (productsRes.ok) setProducts(await productsRes.json());
      if (reportsRes.ok) setReports(await reportsRes.json());
      if (heroRes.ok) setHeroSlides(await heroRes.json());
    } catch (e) {
      console.error("Failed to load CMS content:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Helper for image upload to base64
  const handleFileToBase64 = (
    e: React.ChangeEvent<HTMLInputElement>,
    onComplete: (dataUrl: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("Ukuran file maksimal 5MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      if (uploadEvent.target?.result) {
        onComplete(uploadEvent.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  // --- Product Actions ---
  const openProductModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      let featuresString = "";
      try {
        const parsed = JSON.parse(product.features);
        if (Array.isArray(parsed)) {
          featuresString = parsed.join("\n");
        }
      } catch {
        featuresString = product.features || "";
      }

      setProductForm({
        name: product.name,
        category: product.category,
        description: product.description,
        featuresText: featuresString,
        icon: product.icon || "Briefcase",
        badge: product.badge || "",
        ctaText: product.ctaText || "Ajukan Pinjaman",
        ctaLink: product.ctaLink || "#form-pengajuan",
        sortOrder: product.sortOrder,
        isActive: product.isActive,
      });
    } else {
      setEditingProduct(null);
      setProductForm({
        name: "",
        category: "KREDIT",
        description: "",
        featuresText: "Plafon s.d. Rp 500.000.000\nTenor fleksibel s.d. 36 bulan\nSyarat mudah & verifikasi cepat",
        icon: "Briefcase",
        badge: "",
        ctaText: "Ajukan Pinjaman",
        ctaLink: "#form-pengajuan",
        sortOrder: products.length + 1,
        isActive: true,
      });
    }
    setProductModalOpen(true);
  };

  const handleSaveProduct = async () => {
    if (!productForm.name.trim() || !productForm.description.trim()) {
      alert("Nama produk dan deskripsi wajib diisi");
      return;
    }

    const featuresArray = productForm.featuresText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    const payload = {
      name: productForm.name,
      category: productForm.category,
      description: productForm.description,
      features: featuresArray,
      icon: productForm.icon,
      badge: productForm.badge || null,
      ctaText: productForm.ctaText,
      ctaLink: productForm.ctaLink,
      sortOrder: Number(productForm.sortOrder) || 0,
      isActive: productForm.isActive,
    };

    try {
      const url = editingProduct ? `/api/cms/products/${editingProduct.id}` : "/api/cms/products";
      const method = editingProduct ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setProductModalOpen(false);
        fetchData();
      } else {
        const data = await res.json();
        alert(data.error || "Gagal menyimpan produk");
      }
    } catch (e) {
      console.error("Failed to save product:", e);
    }
  };

  const handleDeleteProduct = async (product: Product) => {
    const defaultWarning = product.isDefault
      ? "Perhatian: Produk ini merupakan salah satu dari 3 produk bawaan/default.\n"
      : "";
    if (!confirm(`${defaultWarning}Apakah Anda yakin ingin menghapus produk "${product.name}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/cms/products/${product.id}`, { method: "DELETE" });
      if (res.ok) fetchData();
    } catch (e) {
      console.error("Failed to delete product:", e);
    }
  };

  // --- Post / Article WYSIWYG Actions ---
  const handleStartCreatePost = () => {
    setEditingPost(null);
    setPostForm({
      title: "",
      slug: "",
      category: "KEGIATAN",
      excerpt: "",
      content: "",
      featuredImage: "",
      status: "PUBLISHED",
      authorName: "Humas & Protokoler",
    });
    setIsWritingPost(true);
  };

  const handleStartEditPost = (post: Post) => {
    setEditingPost(post);
    setPostForm({
      title: post.title,
      slug: post.slug,
      category: post.category,
      excerpt: post.excerpt || "",
      content: post.content,
      featuredImage: post.featuredImage || "",
      status: post.status,
      authorName: post.authorName || "Redaksi",
    });
    setIsWritingPost(true);
  };

  const handleSavePost = async (targetStatus?: string) => {
    if (!postForm.title.trim()) {
      alert("Judul artikel kegiatan wajib diisi");
      return;
    }
    if (!postForm.content.trim() || postForm.content === "<p></p>") {
      alert("Konten artikel wajib diisi pada editor WYSIWYG");
      return;
    }

    const dataToSave = {
      ...postForm,
      status: targetStatus || postForm.status,
    };

    try {
      const url = editingPost ? `/api/cms/posts/${editingPost.id}` : "/api/cms/posts";
      const method = editingPost ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dataToSave),
      });

      if (res.ok) {
        setIsWritingPost(false);
        fetchData();
      } else {
        const data = await res.json();
        alert(data.error || "Gagal menyimpan artikel");
      }
    } catch (e) {
      console.error("Failed to save post:", e);
    }
  };

  const handleDeletePost = async (id: string) => {
    if (!confirm("Hapus artikel ini secara permanen?")) return;
    try {
      const res = await fetch(`/api/cms/posts/${id}`, { method: "DELETE" });
      if (res.ok) fetchData();
    } catch (e) {
      console.error("Failed to delete post:", e);
    }
  };

  // --- Banner Actions ---
  const openBannerModal = (banner?: Banner) => {
    if (banner) {
      setEditingBanner(banner);
      setBannerForm({
        title: banner.title,
        subtitle: banner.subtitle || "",
        imageUrl: banner.imageUrl || "",
        ctaText: banner.ctaText || "",
        ctaLink: banner.ctaLink || "",
        sortOrder: banner.sortOrder,
        isActive: banner.isActive,
      });
    } else {
      setEditingBanner(null);
      setBannerForm({
        title: "",
        subtitle: "",
        imageUrl: "",
        ctaText: "Pelajari Lebih Lanjut",
        ctaLink: "#",
        sortOrder: banners.length + 1,
        isActive: true,
      });
    }
    setBannerModalOpen(true);
  };

  const handleSaveBanner = async () => {
    try {
      const url = editingBanner ? `/api/cms/banners/${editingBanner.id}` : "/api/cms/banners";
      const method = editingBanner ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bannerForm),
      });

      if (res.ok) {
        setBannerModalOpen(false);
        fetchData();
      }
    } catch (e) {
      console.error("Failed to save banner:", e);
    }
  };

  const handleDeleteBanner = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus banner ini?")) return;
    try {
      const res = await fetch(`/api/cms/banners/${id}`, { method: "DELETE" });
      if (res.ok) fetchData();
    } catch (e) {
      console.error("Failed to delete banner:", e);
    }
  };

  // --- Gallery Actions ---
  const openGalleryModal = (item?: GalleryItem) => {
    if (item) {
      setEditingGallery(item);
      setGalleryForm({
        title: item.title,
        description: item.description || "",
        imageUrl: item.imageUrl,
        category: item.category,
        eventDate: item.eventDate ? new Date(item.eventDate).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
        sortOrder: item.sortOrder,
        isActive: item.isActive,
      });
    } else {
      setEditingGallery(null);
      setGalleryForm({
        title: "",
        description: "",
        imageUrl: "",
        category: "KEGIATAN",
        eventDate: new Date().toISOString().split("T")[0],
        sortOrder: galleries.length + 1,
        isActive: true,
      });
    }
    setGalleryModalOpen(true);
  };

  const handleSaveGallery = async () => {
    if (!galleryForm.title.trim() || !galleryForm.imageUrl.trim()) {
      alert("Judul kegiatan dan foto kegiatan wajib diisi");
      return;
    }

    try {
      const url = editingGallery ? `/api/cms/gallery/${editingGallery.id}` : "/api/cms/gallery";
      const method = editingGallery ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(galleryForm),
      });

      if (res.ok) {
        setGalleryModalOpen(false);
        fetchData();
      } else {
        const data = await res.json();
        alert(data.error || "Gagal menyimpan foto galeri");
      }
    } catch (e) {
      console.error("Failed to save gallery item:", e);
    }
  };

  const handleDeleteGallery = async (id: string) => {
    if (!confirm("Hapus foto kegiatan ini?")) return;
    try {
      const res = await fetch(`/api/cms/gallery/${id}`, { method: "DELETE" });
      if (res.ok) fetchData();
    } catch (e) {
      console.error("Failed to delete gallery item:", e);
    }
  };

  // --- Hero Slideshow Actions ---
  const openHeroModal = (slide?: HeroSlide) => {
    if (slide) {
      setEditingHeroSlide(slide);
      setHeroForm({
        title: slide.title || "",
        altText: slide.altText || "",
        imageUrl: slide.imageUrl,
        sortOrder: slide.sortOrder,
        isActive: slide.isActive,
      });
    } else {
      setEditingHeroSlide(null);
      setHeroForm({
        title: "",
        altText: "",
        imageUrl: "",
        sortOrder: heroSlides.length,
        isActive: true,
      });
    }
    setHeroModalOpen(true);
  };

  const handleHeroImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(file.type.toLowerCase())) {
      alert("Format gambar harus PNG, JPG, atau WEBP");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      alert("Ukuran gambar maksimal 15 MB");
      return;
    }

    try {
      setHeroUploading(true);
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/cms/hero-slides/upload", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setHeroForm((prev) => ({
          ...prev,
          imageUrl: data.url,
          title:
            prev.title ||
            (file.name || "").replace(/\.[^.]+$/, "").replace(/[-_]/g, " "),
        }));
      } else {
        const errData = await res.json();
        alert(errData.error || "Gagal mengunggah gambar hero");
      }
    } catch (err) {
      console.error("Failed to upload hero image:", err);
      alert("Terjadi kesalahan saat mengunggah gambar hero");
    } finally {
      setHeroUploading(false);
      if (heroImageInputRef.current) heroImageInputRef.current.value = "";
    }
  };

  const handleSaveHero = async () => {
    if (!heroForm.imageUrl.trim()) {
      alert("Unggah gambar hero terlebih dahulu");
      return;
    }

    try {
      const url = editingHeroSlide ? `/api/cms/hero-slides/${editingHeroSlide.id}` : "/api/cms/hero-slides";
      const method = editingHeroSlide ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(heroForm),
      });

      if (res.ok) {
        setHeroModalOpen(false);
        fetchData();
      } else {
        const data = await res.json();
        alert(data.error || "Gagal menyimpan gambar hero");
      }
    } catch (e) {
      console.error("Failed to save hero slide:", e);
    }
  };

  const handleDeleteHero = async (id: string) => {
    if (!confirm("Hapus gambar hero ini dari slideshow?")) return;
    try {
      const res = await fetch(`/api/cms/hero-slides/${id}`, { method: "DELETE" });
      if (res.ok) fetchData();
    } catch (e) {
      console.error("Failed to delete hero slide:", e);
    }
  };

  const handleToggleHeroActive = async (slide: HeroSlide) => {
    try {
      const res = await fetch(`/api/cms/hero-slides/${slide.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !slide.isActive }),
      });
      if (res.ok) fetchData();
    } catch (e) {
      console.error("Failed to toggle hero slide:", e);
    }
  };

  // --- FAQ Actions ---
  const openFaqModal = (faq?: Faq) => {
    if (faq) {
      setEditingFaq(faq);
      setFaqForm({
        category: faq.category,
        question: faq.question,
        answer: faq.answer,
        sortOrder: faq.sortOrder,
        isActive: faq.isActive,
      });
    } else {
      setEditingFaq(null);
      setFaqForm({
        category: "UMUM",
        question: "",
        answer: "",
        sortOrder: faqs.length + 1,
        isActive: true,
      });
    }
    setFaqModalOpen(true);
  };

  const handleSaveFaq = async () => {
    try {
      const url = editingFaq ? `/api/cms/faqs/${editingFaq.id}` : "/api/cms/faqs";
      const method = editingFaq ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(faqForm),
      });

      if (res.ok) {
        setFaqModalOpen(false);
        fetchData();
      }
    } catch (e) {
      console.error("Failed to save FAQ:", e);
    }
  };

  const handleDeleteFaq = async (id: string) => {
    if (!confirm("Hapus pertanyaan FAQ ini?")) return;
    try {
      const res = await fetch(`/api/cms/faqs/${id}`, { method: "DELETE" });
      if (res.ok) fetchData();
    } catch (e) {
      console.error("Failed to delete FAQ:", e);
    }
  };

  // --- Report Actions ---
  const openReportModal = (report?: CmsReport) => {
    if (report) {
      setEditingReport(report);
      setReportForm({
        title: report.title,
        slug: report.slug,
        category: report.category,
        period: report.period || "Triwulan II",
        year: report.year || new Date().getFullYear(),
        description: report.description || "",
        fileUrl: report.fileUrl,
        fileName: report.fileName || "",
        fileSize: report.fileSize || 0,
        publishedAt: report.publishedAt
          ? new Date(report.publishedAt).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0],
        sortOrder: report.sortOrder,
        isActive: report.isActive,
      });
    } else {
      setEditingReport(null);
      setReportForm({
        title: "",
        slug: "",
        category: "KEUANGAN",
        period: "Triwulan II",
        year: new Date().getFullYear(),
        description: "",
        fileUrl: "",
        fileName: "",
        fileSize: 0,
        publishedAt: new Date().toISOString().split("T")[0],
        sortOrder: reports.length + 1,
        isActive: true,
      });
    }
    setReportModalOpen(true);
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".pdf") && !file.type.includes("pdf")) {
      alert("Harap pilih file dokumen berformat PDF (.pdf)");
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      alert("Ukuran dokumen PDF maksimal 25 MB");
      return;
    }

    try {
      setUploadingPdf(true);
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/cms/reports/upload", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setReportForm((prev) => ({
          ...prev,
          fileUrl: data.url,
          fileName: data.fileName,
          fileSize: data.fileSize,
          title: prev.title || data.fileName.replace(/\.pdf$/i, "").replace(/[-_]/g, " "),
        }));
      } else {
        const errData = await res.json();
        alert(errData.error || "Gagal mengunggah file PDF");
      }
    } catch (err) {
      console.error("Failed to upload PDF:", err);
      alert("Terjadi kesalahan saat mengunggah file PDF");
    } finally {
      setUploadingPdf(false);
      if (pdfFileInputRef.current) pdfFileInputRef.current.value = "";
    }
  };

  const handleSaveReport = async () => {
    if (!reportForm.title.trim()) {
      alert("Judul laporan wajib diisi");
      return;
    }
    if (!reportForm.fileUrl.trim()) {
      alert("Berkas PDF laporan wajib diunggah atau diisi URL-nya");
      return;
    }

    try {
      const url = editingReport ? `/api/cms/reports/${editingReport.id}` : "/api/cms/reports";
      const method = editingReport ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reportForm),
      });

      if (res.ok) {
        setReportModalOpen(false);
        fetchData();
      } else {
        const data = await res.json();
        alert(data.error || "Gagal menyimpan laporan");
      }
    } catch (e) {
      console.error("Failed to save report:", e);
      alert("Terjadi kesalahan saat menyimpan laporan");
    }
  };

  const handleDeleteReport = async (id: string) => {
    if (!confirm("Hapus berkas laporan publikasi ini?")) return;
    try {
      const res = await fetch(`/api/cms/reports/${id}`, { method: "DELETE" });
      if (res.ok) fetchData();
    } catch (e) {
      console.error("Failed to delete report:", e);
    }
  };

  const getReportCategoryBadgeClass = (category: string) => {
    switch (category) {
      case "KEUANGAN":
        return "bg-blue-600 hover:bg-blue-700 text-white";
      case "TATA_KELOLA":
        return "bg-purple-600 hover:bg-purple-700 text-white";
      case "TAHUNAN":
        return "bg-amber-600 hover:bg-amber-700 text-white";
      case "KEBERLANJUTAN":
        return "bg-emerald-600 hover:bg-emerald-700 text-white";
      default:
        return "bg-slate-700 text-white";
    }
  };

  const formatFileSize = (bytes?: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const getCategoryBadgeClass = (category: string) => {
    switch (category) {
      case "KEGIATAN":
        return "bg-indigo-600 hover:bg-indigo-700 text-white";
      case "BERITA":
        return "bg-blue-600 hover:bg-blue-700 text-white";
      case "PROMO":
        return "bg-emerald-600 hover:bg-emerald-700 text-white";
      case "EDUKASI":
        return "bg-amber-600 hover:bg-amber-700 text-white";
      case "CSR":
        return "bg-teal-600 hover:bg-teal-700 text-white";
      case "PENGHARGAAN":
        return "bg-purple-600 hover:bg-purple-700 text-white";
      case "SOSIALISASI":
        return "bg-sky-600 hover:bg-sky-700 text-white";
      default:
        return "bg-slate-700 text-white";
    }
  };

  const renderProductIcon = (iconName: string | null) => {
    switch (iconName) {
      case "CreditCard":
        return <CreditCard className="h-6 w-6 text-purple-600" />;
      case "PiggyBank":
        return <PiggyBank className="h-6 w-6 text-green-600" />;
      case "Building2":
        return <Building2 className="h-6 w-6 text-indigo-600" />;
      case "ShieldCheck":
        return <ShieldCheck className="h-6 w-6 text-emerald-600" />;
      case "Wallet":
        return <Wallet className="h-6 w-6 text-amber-600" />;
      case "Coins":
        return <Coins className="h-6 w-6 text-yellow-600" />;
      case "Landmark":
        return <Landmark className="h-6 w-6 text-rose-600" />;
      case "Briefcase":
      default:
        return <Briefcase className="h-6 w-6 text-blue-600" />;
    }
  };

  // ==========================================
  // VIEW 1: DEDICATED FULL-PAGE WYSIWYG EDITOR (NO POPUP)
  // ==========================================
  if (isWritingPost) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto pb-16">
        {/* Editor Top Navigation Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsWritingPost(false)}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" /> Kembali
            </Button>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
                {editingPost ? "Edit Artikel / Liputan Kegiatan" : "Tulis Artikel & Kegiatan Baru"}
              </h1>
              <p className="text-xs text-muted-foreground">
                Editor WYSIWYG (What You See Is What You Get) — format teks, sisipkan foto, dan atur struktur publikasi langsung.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSavePost("DRAFT")}
              className="gap-1.5"
            >
              <Save className="h-3.5 w-3.5" /> Simpan Draf
            </Button>
            <Button
              size="sm"
              onClick={() => handleSavePost("PUBLISHED")}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
            >
              <Send className="h-3.5 w-3.5" /> Terbitkan Artikel
            </Button>
          </div>
        </div>

        {/* Two-Column Editor Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Main Document Canvas (8 cols) */}
          <div className="lg:col-span-8 space-y-4">
            {/* Title Input */}
            <div className="bg-card border rounded-xl p-4 shadow-xs">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                Judul Utama Artikel / Kegiatan <span className="text-destructive">*</span>
              </label>
              <Input
                value={postForm.title}
                onChange={(e) => setPostForm({ ...postForm, title: e.target.value })}
                placeholder="Tuliskan judul artikel yang menarik di sini..."
                className="text-base sm:text-lg font-bold h-12 shadow-none border-input focus-visible:ring-1"
              />
            </div>

            {/* Excerpt Input */}
            <div className="bg-card border rounded-xl p-4 shadow-xs">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                Ringkasan Singkat (Excerpt untuk Kartu Depan)
              </label>
              <textarea
                value={postForm.excerpt}
                onChange={(e) => setPostForm({ ...postForm, excerpt: e.target.value })}
                placeholder="1-2 kalimat ringkasan yang akan tampil pada pratinjau kartu berita..."
                rows={2}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs leading-relaxed focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>

            {/* WYSIWYG Editor Body */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Konten Lengkap Artikel (WYSIWYG Editor) <span className="text-destructive">*</span>
                </label>
                <span className="text-[11px] text-muted-foreground">
                  Gunakan toolbar untuk format Heading (H2, H3), Tebal, Miring, Daftar Poin, dan Sisip Foto.
                </span>
              </div>
              <WysiwygEditor
                value={postForm.content}
                onChange={(html) => setPostForm({ ...postForm, content: html })}
                placeholder="Mulai ketik artikel liputan kegiatan kantor atau edukasi perbankan di sini..."
                minHeight="480px"
              />
            </div>
          </div>

          {/* Right Sidebar Settings (4 cols) */}
          <div className="lg:col-span-4 space-y-5">
            {/* Publication Settings Card */}
            <Card className="border shadow-xs">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-sm font-bold">Pengaturan Publikasi</CardTitle>
                <CardDescription className="text-xs">
                  Kategori, status tayang, dan atribusi penulis.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-3.5 text-xs">
                <div>
                  <label className="font-semibold block mb-1">Status Publikasi</label>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={postForm.status}
                    onChange={(e) => setPostForm({ ...postForm, status: e.target.value })}
                  >
                    <option value="PUBLISHED">PUBLISHED (Tayang Langsung)</option>
                    <option value="DRAFT">DRAFT (Konsep Internal)</option>
                    <option value="ARCHIVED">ARCHIVED (Arsip)</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold block mb-1">Kategori Artikel</label>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={postForm.category}
                    onChange={(e) => setPostForm({ ...postForm, category: e.target.value })}
                  >
                    <option value="KEGIATAN">KEGIATAN KANTOR</option>
                    <option value="BERITA">BERITA RESMI</option>
                    <option value="EDUKASI">EDUKASI KEUANGAN</option>
                    <option value="PROMO">PROMO & PRODUK</option>
                    <option value="PENGUMUMAN">PENGUMUMAN</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold block mb-1">Nama Penulis / Divisi</label>
                  <Input
                    value={postForm.authorName}
                    onChange={(e) => setPostForm({ ...postForm, authorName: e.target.value })}
                    placeholder="Contoh: Humas & Protokoler"
                  />
                </div>

                <div>
                  <label className="font-semibold block mb-1">Kustom Slug URL (Opsional)</label>
                  <Input
                    value={postForm.slug}
                    onChange={(e) => setPostForm({ ...postForm, slug: e.target.value })}
                    placeholder="Otomatis dibuat dari judul..."
                    className="font-mono text-xs"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Biarkan kosong agar sistem otomatis membuat slug ramah SEO dari judul.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Featured Image Card */}
            <Card className="border shadow-xs">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                  <ImageIcon className="h-4 w-4 text-primary" /> Foto Sampul (Featured Image)
                </CardTitle>
                <CardDescription className="text-xs">
                  Foto utama yang muncul di kartu depan beranda dan header artikel.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-3 text-xs">
                <div className="flex gap-2">
                  <Input
                    value={postForm.featuredImage}
                    onChange={(e) => setPostForm({ ...postForm, featuredImage: e.target.value })}
                    placeholder="URL gambar (https://...)"
                    className="flex-1 text-xs"
                  />
                  <input
                    type="file"
                    ref={postImageInputRef}
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFileToBase64(e, (dataUrl) => setPostForm({ ...postForm, featuredImage: dataUrl }))}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5 shrink-0"
                    onClick={() => postImageInputRef.current?.click()}
                  >
                    <Upload className="h-3.5 w-3.5" /> Pilih File
                  </Button>
                </div>

                {postForm.featuredImage ? (
                  <div className="relative w-full h-44 rounded-lg border overflow-hidden bg-muted group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={postForm.featuredImage}
                      alt="Pratinjau Foto Sampul"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setPostForm({ ...postForm, featuredImage: "" })}
                      className="absolute top-2 right-2 bg-destructive/90 text-white p-1 rounded-full shadow hover:bg-destructive"
                      title="Hapus Foto Sampul"
                    >
                      <XCircle className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => postImageInputRef.current?.click()}
                    className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-muted/30 transition-colors"
                  >
                    <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="font-semibold text-xs text-foreground">Klik untuk mengunggah foto sampul</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Mendukung format JPG, PNG, WEBP (maks. 5MB)</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Actions Footer */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsWritingPost(false)}
              >
                Batal
              </Button>
              <Button
                size="sm"
                onClick={() => handleSavePost()}
                className="bg-primary text-primary-foreground font-semibold"
              >
                Simpan & Selesai
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW 2: CMS DASHBOARD TABS
  // ==========================================
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Globe className="h-6 w-6 text-primary" />
            Manajemen Konten & Website (CMS)
          </h1>
          <p className="text-sm text-muted-foreground">
            Kelola produk & layanan finansial, liputan kegiatan dengan editor WYSIWYG, galeri foto dokumentasi, banner hero, dan FAQ.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 h-8 rounded-md border border-input bg-background px-3 text-xs font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Website Publik
          </a>
          <a
            href="/berita"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 h-8 rounded-md border border-input bg-background px-3 text-xs font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <FileText className="h-3.5 w-3.5" />
            Berita
          </a>
          <a
            href="/galeri"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 h-8 rounded-md border border-input bg-background px-3 text-xs font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <Camera className="h-3.5 w-3.5" />
            Galeri
          </a>
          <a
            href="/laporan"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 h-8 rounded-md border border-input bg-background px-3 text-xs font-medium hover:bg-accent hover:text-accent-foreground transition-colors text-primary"
          >
            <FileText className="h-3.5 w-3.5" />
            Laporan Publikasi (PDF)
          </a>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b space-x-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab("products")}
          className={`pb-3 px-4 text-xs sm:text-sm font-medium border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            activeTab === "products"
              ? "border-primary text-primary font-bold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <ShoppingBag className="h-4 w-4" />
          Produk & Layanan ({products.length})
        </button>
        <button
          onClick={() => setActiveTab("posts")}
          className={`pb-3 px-4 text-xs sm:text-sm font-medium border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            activeTab === "posts"
              ? "border-primary text-primary font-bold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <FileText className="h-4 w-4" />
          Artikel & Kegiatan Kantor ({posts.length})
        </button>
        <button
          onClick={() => setActiveTab("reports")}
          className={`pb-3 px-4 text-xs sm:text-sm font-medium border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            activeTab === "reports"
              ? "border-primary text-primary font-bold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <FileText className="h-4 w-4 text-rose-500" />
          Laporan Publikasi PDF ({reports.length})
        </button>
        <button
          onClick={() => setActiveTab("gallery")}
          className={`pb-3 px-4 text-xs sm:text-sm font-medium border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            activeTab === "gallery"
              ? "border-primary text-primary font-bold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Camera className="h-4 w-4" />
          Galeri Foto Kegiatan ({galleries.length})
        </button>
        <button
          onClick={() => setActiveTab("hero")}
          className={`pb-3 px-4 text-xs sm:text-sm font-medium border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            activeTab === "hero"
              ? "border-primary text-primary font-bold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Images className="h-4 w-4 text-primary" />
          Gambar Hero ({heroSlides.length})
        </button>
        <button
          onClick={() => setActiveTab("banners")}
          className={`pb-3 px-4 text-xs sm:text-sm font-medium border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            activeTab === "banners"
              ? "border-primary text-primary font-bold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <ImageIcon className="h-4 w-4" />
          Banner Hero ({banners.length})
        </button>
        <button
          onClick={() => setActiveTab("faqs")}
          className={`pb-3 px-4 text-xs sm:text-sm font-medium border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            activeTab === "faqs"
              ? "border-primary text-primary font-bold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <HelpCircle className="h-4 w-4" />
          FAQ Tanya Jawab ({faqs.length})
        </button>
      </div>

      {/* TAB 0: PRODUK & LAYANAN (ADD, EDIT, DELETE) */}
      {activeTab === "products" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <p className="text-sm font-medium text-foreground">
                Katalog Produk & Layanan Finansial
              </p>
              <p className="text-xs text-muted-foreground">
                Tambah, edit, dan hapus fasilitas pinjaman atau produk simpanan yang ditampilkan pada seksi produk halaman depan publik.
              </p>
            </div>
            <Button onClick={() => openProductModal()} size="sm" className="gap-1.5 bg-primary text-primary-foreground font-semibold shadow-xs">
              <Plus className="h-4 w-4" /> Tambah Produk & Layanan Baru
            </Button>
          </div>

          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {products.map((prod) => {
              let featuresList: string[] = [];
              try {
                const parsed = JSON.parse(prod.features);
                if (Array.isArray(parsed)) featuresList = parsed;
              } catch {
                featuresList = prod.features ? prod.features.split("\n") : [];
              }

              return (
                <Card
                  key={prod.id}
                  className="border overflow-hidden hover:shadow-md transition-shadow flex flex-col justify-between"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        {renderProductIcon(prod.icon)}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openProductModal(prod)}
                          title="Edit Produk"
                        >
                          <Edit className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:bg-destructive/10"
                          onClick={() => handleDeleteProduct(prod)}
                          title="Hapus Produk"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-1 pt-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">
                          {prod.category}
                        </Badge>
                        {prod.isDefault && (
                          <Badge className="bg-slate-800 text-[10px] text-white">
                            Default
                          </Badge>
                        )}
                        {prod.badge && (
                          <Badge className="bg-amber-600/90 text-[10px] text-white">
                            {prod.badge}
                          </Badge>
                        )}
                        {prod.isActive ? (
                          <span className="inline-flex items-center text-[10px] text-emerald-600 font-medium ml-auto">
                            <CheckCircle className="h-3 w-3 mr-0.5" /> Aktif
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-[10px] text-muted-foreground font-medium ml-auto">
                            <XCircle className="h-3 w-3 mr-0.5" /> Nonaktif
                          </span>
                        )}
                      </div>

                      <CardTitle className="text-base font-bold leading-snug">
                        {prod.name}
                      </CardTitle>
                      <CardDescription className="text-xs line-clamp-2">
                        {prod.description}
                      </CardDescription>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-0 space-y-3 flex-1 flex flex-col justify-between">
                    <div className="space-y-1.5 border-t pt-2.5">
                      {featuresList.slice(0, 4).map((f, idx) => (
                        <div key={idx} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                          <span className="line-clamp-1">{f}</span>
                        </div>
                      ))}
                    </div>

                    <div className="border-t pt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>Urutan: #{prod.sortOrder}</span>
                      <span>Tombol: <strong className="text-foreground">{prod.ctaText || "Ajukan"}</strong></span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {products.length === 0 && (
              <div className="col-span-full text-center py-12 border border-dashed rounded-lg">
                <ShoppingBag className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm font-semibold">Belum Ada Produk & Layanan</p>
                <p className="text-xs text-muted-foreground mt-1">Klik tombol &ldquo;Tambah Produk & Layanan Baru&rdquo; untuk menambahkan produk pertama.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 1: POSTS / ARTIKEL & KEGIATAN */}
      {activeTab === "posts" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <p className="text-sm font-medium text-foreground">
                Daftar Artikel & Liputan Kegiatan Kantor
              </p>
              <p className="text-xs text-muted-foreground">
                Tulis artikel kegiatan internal, CSR, edukasi nasabah, ataupun promosi resmi dengan editor WYSIWYG untuk dipublikasikan ke portal publik.
              </p>
            </div>
            <Button onClick={handleStartCreatePost} size="sm" className="gap-1.5 bg-primary text-primary-foreground font-semibold shadow-xs">
              <Plus className="h-4 w-4" /> Tulis Artikel / Liputan Baru (WYSIWYG)
            </Button>
          </div>

          <div className="grid gap-4">
            {posts.map((p) => (
              <Card key={p.id} className="border hover:border-primary/50 transition-colors overflow-hidden">
                <div className="flex flex-col md:flex-row">
                  {p.featuredImage && (
                    <div className="md:w-56 h-40 md:h-auto shrink-0 relative bg-muted overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.featuredImage}
                        alt={p.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="flex-1 p-4 md:p-5 flex flex-col justify-between">
                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <Badge className={`text-[10px] font-semibold ${getCategoryBadgeClass(p.category)}`}>
                            {p.category}
                          </Badge>
                          <Badge
                            className={`text-[10px] ${
                              p.status === "PUBLISHED"
                                ? "bg-emerald-600 hover:bg-emerald-700"
                                : "bg-amber-600 hover:bg-amber-700"
                            }`}
                          >
                            {p.status}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            Oleh: <strong className="text-foreground">{p.authorName || "Redaksi"}</strong>
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <a
                            href={`/berita/${p.slug}`}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 text-muted-foreground hover:text-primary rounded hover:bg-muted"
                            title="Pratinjau Halaman Publik"
                          >
                            <Eye className="h-4 w-4" />
                          </a>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleStartEditPost(p)}
                            title="Buka Editor WYSIWYG"
                          >
                            <Edit className="h-4 w-4 text-muted-foreground" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:bg-destructive/10"
                            onClick={() => handleDeletePost(p.id)}
                            title="Hapus Artikel"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <h3
                        onClick={() => handleStartEditPost(p)}
                        className="text-base font-bold text-foreground hover:text-primary transition-colors cursor-pointer"
                      >
                        {p.title}
                      </h3>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1.5 leading-relaxed">
                        {p.excerpt || p.content.replace(/<[^>]*>?/gm, "").slice(0, 160) + "..."}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-between text-[11px] text-muted-foreground border-t pt-3 mt-3">
                      <div className="flex items-center gap-3">
                        <span>Slug: <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-[10px]">{p.slug}</code></span>
                        <span>•</span>
                        <span>Dipublikasi: {p.publishedAt ? new Date(p.publishedAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "Draf"}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleStartEditPost(p)}
                        className="h-7 text-xs font-semibold text-primary hover:underline gap-1 p-0"
                      >
                        Edit di WYSIWYG Editor &rarr;
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}

            {posts.length === 0 && (
              <div className="text-center py-12 border border-dashed rounded-lg">
                <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm font-semibold">Belum Ada Artikel Kegiatan atau Berita</p>
                <p className="text-xs text-muted-foreground mt-1">Klik tombol &ldquo;Tulis Artikel / Liputan Baru (WYSIWYG)&rdquo; untuk memulai publikasi pertama.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: REPORTS / LAPORAN PUBLIKASI (PDF) */}
      {activeTab === "reports" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <p className="text-sm font-medium text-foreground">
                Laporan & Publikasi Resmi BPR Adiartha (PDF)
              </p>
              <p className="text-xs text-muted-foreground">
                Unggah dokumen PDF laporan keuangan publikasi berkala, penerapan tata kelola (GCG), dan annual report sesuai ketentuan OJK.
              </p>
            </div>
            <Button
              onClick={() => openReportModal()}
              size="sm"
              className="gap-1.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold shadow-xs"
            >
              <Plus className="h-4 w-4" /> Unggah Laporan Publikasi (PDF) Baru
            </Button>
          </div>

          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row gap-3 bg-card p-3 rounded-lg border">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari judul laporan, periode, atau kata kunci..."
                value={reportSearchQuery}
                onChange={(e) => setReportSearchQuery(e.target.value)}
                className="pl-9 text-xs"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={reportFilterCategory}
                onChange={(e) => setReportFilterCategory(e.target.value)}
                className="rounded-md border border-input bg-background px-3 py-1.5 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="ALL">Semua Kategori</option>
                <option value="KEUANGAN">Laporan Keuangan</option>
                <option value="TATA_KELOLA">Tata Kelola (GCG)</option>
                <option value="TAHUNAN">Laporan Tahunan</option>
                <option value="KEBERLANJUTAN">Keberlanjutan</option>
                <option value="LAINNYA">Lainnya</option>
              </select>

              <select
                value={reportFilterYear}
                onChange={(e) => setReportFilterYear(e.target.value)}
                className="rounded-md border border-input bg-background px-3 py-1.5 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="ALL">Semua Tahun</option>
                {Array.from(new Set(reports.map((r) => r.year).filter(Boolean))).sort((a, b) => (b as number) - (a as number)).map((yr) => (
                  <option key={yr} value={String(yr)}>
                    Tahun {yr}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* List of Reports */}
          <div className="grid gap-3">
            {reports
              .filter((r) => {
                if (reportFilterCategory !== "ALL" && r.category !== reportFilterCategory) return false;
                if (reportFilterYear !== "ALL" && String(r.year) !== reportFilterYear) return false;
                if (reportSearchQuery.trim()) {
                  const q = reportSearchQuery.toLowerCase();
                  const matchTitle = r.title.toLowerCase().includes(q);
                  const matchDesc = (r.description || "").toLowerCase().includes(q);
                  const matchPeriod = (r.period || "").toLowerCase().includes(q);
                  if (!matchTitle && !matchDesc && !matchPeriod) return false;
                }
                return true;
              })
              .map((rep) => (
                <Card key={rep.id} className="border hover:border-primary/40 transition-colors">
                  <CardContent className="p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="flex items-start gap-3.5 flex-1 min-w-0">
                      <div className="h-12 w-12 rounded-lg bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center shrink-0">
                        <FileText className="h-6 w-6" />
                      </div>
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className={`text-[10px] font-semibold ${getReportCategoryBadgeClass(rep.category)}`}>
                            {rep.category.replace("_", " ")}
                          </Badge>
                          {rep.period && (
                            <Badge variant="outline" className="text-[10px]">
                              {rep.period}
                            </Badge>
                          )}
                          {rep.year && (
                            <Badge variant="secondary" className="text-[10px]">
                              {rep.year}
                            </Badge>
                          )}
                          <Badge
                            className={`text-[10px] ${
                              rep.isActive
                                ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {rep.isActive ? "Publik (Aktif)" : "Draft / Nonaktif"}
                          </Badge>
                        </div>
                        <h3 className="font-bold text-sm sm:text-base text-foreground truncate">
                          {rep.title}
                        </h3>
                        {rep.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {rep.description}
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground pt-1">
                          {rep.fileName && (
                            <span className="flex items-center gap-1 font-mono text-foreground/80">
                              <FileText className="h-3 w-3 text-rose-500" />
                              {rep.fileName}
                            </span>
                          )}
                          {rep.fileSize && (
                            <span>• {formatFileSize(rep.fileSize)}</span>
                          )}
                          {rep.publishedAt && (
                            <span>• Terbit: {new Date(rep.publishedAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                      <a
                        href={`/laporan/${rep.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 h-8 rounded-md border border-input bg-background px-3 text-xs font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
                        title="Buka Halaman Preview Laporan"
                      >
                        <Eye className="h-3.5 w-3.5 text-primary" />
                        Preview
                      </a>
                      <a
                        href={rep.fileUrl}
                        download={rep.fileName || `${rep.slug}.pdf`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 h-8 rounded-md border border-input bg-background px-3 text-xs font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
                        title="Unduh Berkas PDF Langsung"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Unduh
                      </a>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => openReportModal(rep)}
                        title="Edit Data Laporan"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                        onClick={() => handleDeleteReport(rep.id)}
                        title="Hapus Laporan"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}

            {reports.length === 0 && (
              <div className="text-center py-12 border border-dashed rounded-lg">
                <FileText className="h-10 w-10 text-rose-400 mx-auto mb-2" />
                <p className="text-sm font-semibold">Belum Ada Dokumen Laporan Publikasi</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Klik tombol &ldquo;Unggah Laporan Publikasi (PDF) Baru&rdquo; untuk menerbitkan laporan keuangan atau tata kelola.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: GALLERY / GALERI FOTO KEGIATAN */}
      {activeTab === "gallery" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <p className="text-sm font-medium text-foreground">
                Dokumentasi & Galeri Foto Kegiatan Kantor
              </p>
              <p className="text-xs text-muted-foreground">
                Upload foto kegiatan operasional, bakti sosial CSR, perayaan HUT, sosialisasi UMKM, dan momen kebersamaan lainnya.
              </p>
            </div>
            <Button onClick={() => openGalleryModal()} size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> Tambah Foto Kegiatan
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {galleries.map((g) => (
              <Card key={g.id} className="border overflow-hidden flex flex-col justify-between group">
                <div className="relative h-48 bg-muted overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={g.imageUrl}
                    alt={g.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute top-2 left-2 flex items-center gap-1.5">
                    <Badge className={`text-[10px] shadow-sm ${getCategoryBadgeClass(g.category)}`}>
                      {g.category}
                    </Badge>
                    {g.isActive ? (
                      <Badge className="bg-emerald-600/90 text-[10px] text-white">Aktif</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">Non-aktif</Badge>
                    )}
                  </div>
                  <div className="absolute top-2 right-2 bg-background/90 backdrop-blur rounded p-1 flex items-center gap-1 shadow">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => openGalleryModal(g)}
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:bg-destructive/10"
                      onClick={() => handleDeleteGallery(g.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="p-4 flex-1 flex flex-col justify-between space-y-2">
                  <div>
                    <h4 className="font-semibold text-sm leading-snug line-clamp-2">
                      {g.title}
                    </h4>
                    {g.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                        {g.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-muted-foreground border-t pt-2 mt-2">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {g.eventDate ? new Date(g.eventDate).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "-"}
                    </span>
                    <span>Urutan: #{g.sortOrder}</span>
                  </div>
                </div>
              </Card>
            ))}

            {galleries.length === 0 && (
              <div className="col-span-full text-center py-12 border border-dashed rounded-lg">
                <Camera className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm font-semibold">Belum Ada Foto Kegiatan</p>
                <p className="text-xs text-muted-foreground mt-1">Klik tombol &ldquo;Tambah Foto Kegiatan&rdquo; untuk mengunggah dokumentasi kantor pertama.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: GAMBAR HERO / HERO SLIDESHOW */}
      {activeTab === "hero" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <p className="text-sm font-medium text-foreground">
                Gambar Slideshow Hero Halaman Depan
              </p>
              <p className="text-xs text-muted-foreground">
                Gambar-gambar ini tampil bergantian di hero halaman utama. Setiap gambar otomatis dipotong dan
                diskalakan ke kanvas 1100&times;1400 sehingga semuanya tampil seukuran.
              </p>
            </div>
            <Button onClick={() => openHeroModal()} size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> Tambah Gambar Hero
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {heroSlides.map((s) => (
              <Card key={s.id} className="border overflow-hidden flex flex-col justify-between group">
                <div className="relative h-56 bg-muted overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={s.imageUrl}
                    alt={s.altText || s.title || "Gambar hero"}
                    className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute top-2 left-2 flex items-center gap-1.5">
                    {s.isActive ? (
                      <Badge className="bg-emerald-600/90 text-[10px] text-white">Aktif</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">Non-aktif</Badge>
                    )}
                  </div>
                  <div className="absolute top-2 right-2 bg-background/90 backdrop-blur rounded p-1 flex items-center gap-1 shadow">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openHeroModal(s)} title="Edit">
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:bg-destructive/10"
                      onClick={() => handleDeleteHero(s.id)}
                      title="Hapus"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="p-4 flex-1 flex flex-col justify-between space-y-2">
                  <div>
                    <h4 className="font-semibold text-sm leading-snug line-clamp-2">
                      {s.title || "Tanpa judul"}
                    </h4>
                    {s.altText && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{s.altText}</p>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-muted-foreground border-t pt-2 mt-2">
                    <span>Urutan: #{s.sortOrder}</span>
                    <button
                      type="button"
                      onClick={() => handleToggleHeroActive(s)}
                      className="font-medium text-primary hover:underline"
                    >
                      {s.isActive ? "Non-aktifkan" : "Aktifkan"}
                    </button>
                  </div>
                </div>
              </Card>
            ))}

            {heroSlides.length === 0 && (
              <div className="col-span-full text-center py-12 border border-dashed rounded-lg">
                <Images className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm font-semibold">Belum Ada Gambar Hero</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Selama daftar ini kosong, halaman depan memakai 3 gambar bawaan. Klik &ldquo;Tambah Gambar
                  Hero&rdquo; untuk menggantinya.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: BANNERS */}
      {activeTab === "banners" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              Banner ditampilkan pada slider utama halaman depan publik.
            </p>
            <Button onClick={() => openBannerModal()} size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> Tambah Banner
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {banners.map((b) => (
              <Card key={b.id} className="relative overflow-hidden border">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-[10px]">
                          Urutan #{b.sortOrder}
                        </Badge>
                        {b.isActive ? (
                          <Badge className="bg-emerald-600 hover:bg-emerald-700 text-[10px]">
                            Aktif
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px]">
                            Non-aktif
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="text-base font-semibold leading-snug">
                        {b.title}
                      </CardTitle>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openBannerModal(b)}
                      >
                        <Edit className="h-4 w-4 text-muted-foreground" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                        onClick={() => handleDeleteBanner(b.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {b.subtitle && (
                    <CardDescription className="text-xs line-clamp-2 mt-1">
                      {b.subtitle}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="pt-0 text-xs text-muted-foreground">
                  <div className="flex items-center justify-between border-t pt-2">
                    <span>Tombol Aksi: <strong className="text-foreground">{b.ctaText || "-"}</strong></span>
                    <span>Tautan: <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{b.ctaLink || "-"}</code></span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: FAQS */}
      {activeTab === "faqs" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              Daftar tanya jawab umum untuk membantu calon nasabah memahami layanan.
            </p>
            <Button onClick={() => openFaqModal()} size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> Tambah FAQ
            </Button>
          </div>

          <div className="grid gap-3">
            {faqs.map((f) => (
              <Card key={f.id} className="border">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">
                          {f.category}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          Urutan #{f.sortOrder}
                        </span>
                        {f.isActive ? (
                          <span className="inline-flex items-center text-[10px] text-emerald-600 font-medium">
                            <CheckCircle className="h-3 w-3 mr-0.5" /> Aktif
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-[10px] text-muted-foreground font-medium">
                            <XCircle className="h-3 w-3 mr-0.5" /> Ditutup
                          </span>
                        )}
                      </div>
                      <h4 className="font-semibold text-sm text-foreground">
                        {f.question}
                      </h4>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openFaqModal(f)}
                      >
                        <Edit className="h-4 w-4 text-muted-foreground" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                        onClick={() => handleDeleteFaq(f.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed pl-1 border-l-2 border-primary/30">
                    {f.answer}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* MODAL: PRODUK & LAYANAN (ADD / EDIT) */}
      <Dialog open={productModalOpen} onOpenChange={setProductModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProduct ? "Edit Produk & Layanan" : "Tambah Produk & Layanan Baru"}</DialogTitle>
            <DialogDescription>
              Tentukan rincian fasilitas pinjaman atau produk simpanan untuk halaman depan.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3.5 py-2 text-xs">
            <div>
              <label className="font-semibold block mb-1">Nama Produk / Fasilitas <span className="text-destructive">*</span></label>
              <Input
                value={productForm.name}
                onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                placeholder="Contoh: Kredit Usaha Mikro (KUM)"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold block mb-1">Kategori Produk</label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={productForm.category}
                  onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                >
                  <option value="KREDIT">KREDIT (Pinjaman)</option>
                  <option value="SIMPANAN">SIMPANAN & TABUNGAN</option>
                  <option value="DEPOSITO">DEPOSITO BERJANGKA</option>
                  <option value="LAYANAN">LAYANAN PERBANKAN</option>
                </select>
              </div>

              <div>
                <label className="font-semibold block mb-1">Pilihan Ikon</label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={productForm.icon}
                  onChange={(e) => setProductForm({ ...productForm, icon: e.target.value })}
                >
                  <option value="Briefcase">💼 Tas Kerja (Briefcase)</option>
                  <option value="CreditCard">💳 Kartu Kredit (CreditCard)</option>
                  <option value="PiggyBank">🐷 Celengan (PiggyBank)</option>
                  <option value="Building2">🏢 Gedung / Investasi (Building2)</option>
                  <option value="ShieldCheck">🛡️ Perisai / Proteksi (ShieldCheck)</option>
                  <option value="Wallet">👛 Dompet (Wallet)</option>
                  <option value="Coins">🪙 Koin / Mikro (Coins)</option>
                  <option value="Landmark">🏛️ Lembaga Bank (Landmark)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="font-semibold block mb-1">Label / Badge Tambahan (Opsional)</label>
              <Input
                value={productForm.badge}
                onChange={(e) => setProductForm({ ...productForm, badge: e.target.value })}
                placeholder="Contoh: Populer, Bunga Spesial 1%, Dijamin LPS"
              />
            </div>

            <div>
              <label className="font-semibold block mb-1">Deskripsi Singkat <span className="text-destructive">*</span></label>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                rows={2}
                value={productForm.description}
                onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                placeholder="Jelaskan tujuan dan keunggulan utama produk dalam 1-2 kalimat..."
              />
            </div>

            <div>
              <label className="font-semibold block mb-1">
                Poin Fitur / Syarat (1 Baris per Poin)
              </label>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                rows={4}
                value={productForm.featuresText}
                onChange={(e) => setProductForm({ ...productForm, featuresText: e.target.value })}
                placeholder="Plafon s.d. Rp 1.000.000.000&#10;Tenor fleksibel 12 s.d. 36 bulan&#10;Jaminan SHM / BPKB"
              />
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Setiap baris baru (enter) akan otomatis menjadi poin bertanda centang hijau.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold block mb-1">Teks Tombol Aksi (CTA)</label>
                <Input
                  value={productForm.ctaText}
                  onChange={(e) => setProductForm({ ...productForm, ctaText: e.target.value })}
                  placeholder="Ajukan Pinjaman"
                />
              </div>
              <div>
                <label className="font-semibold block mb-1">Tautan Tombol (URL)</label>
                <Input
                  value={productForm.ctaLink}
                  onChange={(e) => setProductForm({ ...productForm, ctaLink: e.target.value })}
                  placeholder="#form-pengajuan"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 items-center pt-1">
              <div>
                <label className="font-semibold block mb-1">Urutan Tampil</label>
                <Input
                  type="number"
                  value={productForm.sortOrder}
                  onChange={(e) => setProductForm({ ...productForm, sortOrder: Number(e.target.value) })}
                />
              </div>
              <div className="pt-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={productForm.isActive}
                    onChange={(e) => setProductForm({ ...productForm, isActive: e.target.checked })}
                    className="rounded border-input text-primary focus:ring-primary"
                  />
                  <span className="font-semibold text-xs">Aktifkan di Beranda</span>
                </label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setProductModalOpen(false)}>
              Batal
            </Button>
            <Button size="sm" onClick={handleSaveProduct}>
              Simpan Produk
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: GAMBAR HERO */}
      <Dialog open={heroModalOpen} onOpenChange={setHeroModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingHeroSlide ? "Edit Gambar Hero" : "Tambah Gambar Hero"}</DialogTitle>
            <DialogDescription>
              Gambar otomatis dipotong &amp; diskalakan ke kanvas 1100&times;1400 (subjek setinggi 1380px) supaya
              semua slide tampil seukuran. PNG dengan latar transparan memberi hasil terbaik.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <div>
              <label className="font-medium text-foreground block mb-1">
                Gambar <span className="text-destructive">*</span>
              </label>
              <div className="flex gap-2">
                <Input
                  value={heroForm.imageUrl}
                  onChange={(e) => setHeroForm({ ...heroForm, imageUrl: e.target.value })}
                  placeholder="Unggah gambar, atau tempel URL-nya"
                  className="flex-1"
                />
                <input
                  type="file"
                  ref={heroImageInputRef}
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={handleHeroImageUpload}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 shrink-0"
                  disabled={heroUploading}
                  onClick={() => heroImageInputRef.current?.click()}
                >
                  {heroUploading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Upload className="h-3.5 w-3.5" />
                  )}
                  {heroUploading ? "Memproses..." : "Pilih Gambar"}
                </Button>
              </div>
              {heroUploading && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  Memotong &amp; menyeragamkan ukuran gambar...
                </p>
              )}

              {heroForm.imageUrl && !heroUploading && (
                <div className="relative w-full h-56 rounded-md border overflow-hidden bg-muted mt-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={heroForm.imageUrl}
                    alt="Pratinjau gambar hero"
                    className="w-full h-full object-contain"
                  />
                  <button
                    type="button"
                    onClick={() => setHeroForm({ ...heroForm, imageUrl: "" })}
                    className="absolute top-2 right-2 bg-destructive text-white p-1 rounded-full shadow hover:bg-destructive/90"
                    title="Hapus Gambar"
                  >
                    <XCircle className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="font-medium text-foreground block mb-1">Judul / Label Internal</label>
              <Input
                value={heroForm.title}
                onChange={(e) => setHeroForm({ ...heroForm, title: e.target.value })}
                placeholder="Contoh: Nasabah UMKM"
              />
            </div>

            <div>
              <label className="font-medium text-foreground block mb-1">Teks Alternatif (alt)</label>
              <Input
                value={heroForm.altText}
                onChange={(e) => setHeroForm({ ...heroForm, altText: e.target.value })}
                placeholder="Deskripsi singkat gambar untuk aksesibilitas & SEO"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 items-center pt-1">
              <div>
                <label className="font-medium text-foreground block mb-1">Urutan Tampil</label>
                <Input
                  type="number"
                  value={heroForm.sortOrder}
                  onChange={(e) => setHeroForm({ ...heroForm, sortOrder: Number(e.target.value) })}
                />
              </div>
              <div className="pt-5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={heroForm.isActive}
                    onChange={(e) => setHeroForm({ ...heroForm, isActive: e.target.checked })}
                    className="rounded border-input text-primary focus:ring-primary"
                  />
                  <span className="font-medium text-xs">Tampilkan di Hero</span>
                </label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setHeroModalOpen(false)}>
              Batal
            </Button>
            <Button size="sm" onClick={handleSaveHero} disabled={heroUploading}>
              Simpan Gambar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: GALLERY / FOTO KEGIATAN */}
      <Dialog open={galleryModalOpen} onOpenChange={setGalleryModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingGallery ? "Edit Foto Kegiatan" : "Tambah Foto Dokumentasi Kegiatan"}</DialogTitle>
            <DialogDescription>
              Upload momen kegiatan kantor, CSR, atau perayaan ke album galeri publik.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <div>
              <label className="font-medium text-foreground block mb-1">Judul / Momen Kegiatan <span className="text-destructive">*</span></label>
              <Input
                value={galleryForm.title}
                onChange={(e) => setGalleryForm({ ...galleryForm, title: e.target.value })}
                placeholder="Contoh: Apresiasi Karyawan Teladan Tahun 2026"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-medium text-foreground block mb-1">Kategori Galeri</label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={galleryForm.category}
                  onChange={(e) => setGalleryForm({ ...galleryForm, category: e.target.value })}
                >
                  <option value="KEGIATAN">KEGIATAN KANTOR</option>
                  <option value="CSR">CSR & BAKTI SOSIAL</option>
                  <option value="SOSIALISASI">SOSIALISASI & WORKSHOP</option>
                  <option value="RAPAT">RAPAT & KOORDINASI</option>
                  <option value="PENGHARGAAN">PENGHARGAAN & PRESTASI</option>
                </select>
              </div>
              <div>
                <label className="font-medium text-foreground block mb-1">Tanggal Kegiatan</label>
                <Input
                  type="date"
                  value={galleryForm.eventDate}
                  onChange={(e) => setGalleryForm({ ...galleryForm, eventDate: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="font-medium text-foreground block mb-1">File Foto Kegiatan <span className="text-destructive">*</span></label>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    value={galleryForm.imageUrl}
                    onChange={(e) => setGalleryForm({ ...galleryForm, imageUrl: e.target.value })}
                    placeholder="URL gambar atau unggah file foto langsung"
                    className="flex-1"
                  />
                  <input
                    type="file"
                    ref={galleryImageInputRef}
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFileToBase64(e, (dataUrl) => setGalleryForm({ ...galleryForm, imageUrl: dataUrl }))}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5 shrink-0"
                    onClick={() => galleryImageInputRef.current?.click()}
                  >
                    <Upload className="h-3.5 w-3.5" /> Pilih Foto
                  </Button>
                </div>

                {galleryForm.imageUrl && (
                  <div className="relative w-full h-44 rounded-md border overflow-hidden bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={galleryForm.imageUrl}
                      alt="Pratinjau Galeri"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setGalleryForm({ ...galleryForm, imageUrl: "" })}
                      className="absolute top-2 right-2 bg-destructive text-white p-1 rounded-full shadow hover:bg-destructive/90"
                      title="Hapus Foto"
                    >
                      <XCircle className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="font-medium text-foreground block mb-1">Keterangan / Deskripsi Singkat</label>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                rows={2}
                value={galleryForm.description}
                onChange={(e) => setGalleryForm({ ...galleryForm, description: e.target.value })}
                placeholder="Penjelasan singkat mengenai peristiwa atau kegiatan pada foto..."
              />
            </div>

            <div className="grid grid-cols-2 gap-2 items-center pt-1">
              <div>
                <label className="font-medium text-foreground block mb-1">Urutan Tampil</label>
                <Input
                  type="number"
                  value={galleryForm.sortOrder}
                  onChange={(e) => setGalleryForm({ ...galleryForm, sortOrder: Number(e.target.value) })}
                />
              </div>
              <div className="pt-5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={galleryForm.isActive}
                    onChange={(e) => setGalleryForm({ ...galleryForm, isActive: e.target.checked })}
                    className="rounded border-input text-primary focus:ring-primary"
                  />
                  <span className="font-medium text-xs">Tampilkan di Halaman Galeri</span>
                </label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setGalleryModalOpen(false)}>
              Batal
            </Button>
            <Button size="sm" onClick={handleSaveGallery}>
              Simpan Foto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: BANNER */}
      <Dialog open={bannerModalOpen} onOpenChange={setBannerModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingBanner ? "Edit Banner Hero" : "Tambah Banner Baru"}</DialogTitle>
            <DialogDescription>
              Tentukan judul promosi, deskripsi singkat, dan tujuan tombol aksi.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <div>
              <label className="font-medium text-foreground block mb-1">Judul Utama</label>
              <Input
                value={bannerForm.title}
                onChange={(e) => setBannerForm({ ...bannerForm, title: e.target.value })}
                placeholder="Contoh: Bunga Deposito Spesial 6.25% p.a."
              />
            </div>
            <div>
              <label className="font-medium text-foreground block mb-1">Subjudul / Keterangan</label>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                rows={2}
                value={bannerForm.subtitle}
                onChange={(e) => setBannerForm({ ...bannerForm, subtitle: e.target.value })}
                placeholder="Deskripsi singkat keunggulan produk..."
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-medium text-foreground block mb-1">Teks Tombol (CTA)</label>
                <Input
                  value={bannerForm.ctaText}
                  onChange={(e) => setBannerForm({ ...bannerForm, ctaText: e.target.value })}
                  placeholder="Ajukan Sekarang"
                />
              </div>
              <div>
                <label className="font-medium text-foreground block mb-1">Tautan URL</label>
                <Input
                  value={bannerForm.ctaLink}
                  onChange={(e) => setBannerForm({ ...bannerForm, ctaLink: e.target.value })}
                  placeholder="#form-pengajuan"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 items-center">
              <div>
                <label className="font-medium text-foreground block mb-1">Urutan Tampil</label>
                <Input
                  type="number"
                  value={bannerForm.sortOrder}
                  onChange={(e) => setBannerForm({ ...bannerForm, sortOrder: Number(e.target.value) })}
                />
              </div>
              <div className="pt-5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={bannerForm.isActive}
                    onChange={(e) => setBannerForm({ ...bannerForm, isActive: e.target.checked })}
                    className="rounded border-input text-primary focus:ring-primary"
                  />
                  <span className="font-medium text-xs">Aktifkan Banner</span>
                </label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setBannerModalOpen(false)}>
              Batal
            </Button>
            <Button size="sm" onClick={handleSaveBanner}>
              Simpan Banner
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: FAQ */}
      <Dialog open={faqModalOpen} onOpenChange={setFaqModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingFaq ? "Edit Pertanyaan FAQ" : "Tambah Pertanyaan FAQ"}</DialogTitle>
            <DialogDescription>
              Pertanyaan umum nasabah seputar produk kredit, tabungan, dan persyaratan.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-medium text-foreground block mb-1">Kategori</label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={faqForm.category}
                  onChange={(e) => setFaqForm({ ...faqForm, category: e.target.value })}
                >
                  <option value="UMUM">UMUM</option>
                  <option value="KREDIT">KREDIT</option>
                  <option value="TABUNGAN">TABUNGAN</option>
                  <option value="DEPOSITO">DEPOSITO</option>
                  <option value="PERSYARATAN">PERSYARATAN</option>
                </select>
              </div>
              <div>
                <label className="font-medium text-foreground block mb-1">Urutan Tampil</label>
                <Input
                  type="number"
                  value={faqForm.sortOrder}
                  onChange={(e) => setFaqForm({ ...faqForm, sortOrder: Number(e.target.value) })}
                />
              </div>
            </div>
            <div>
              <label className="font-medium text-foreground block mb-1">Pertanyaan (Question)</label>
              <Input
                value={faqForm.question}
                onChange={(e) => setFaqForm({ ...faqForm, question: e.target.value })}
                placeholder="Contoh: Berapa lama proses survei hingga pencairan?"
              />
            </div>
            <div>
              <label className="font-medium text-foreground block mb-1">Jawaban Lengkap (Answer)</label>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                rows={4}
                value={faqForm.answer}
                onChange={(e) => setFaqForm({ ...faqForm, answer: e.target.value })}
                placeholder="Jelaskan secara informatif dan mudah dimengerti..."
              />
            </div>
            <div className="pt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={faqForm.isActive}
                  onChange={(e) => setFaqForm({ ...faqForm, isActive: e.target.checked })}
                  className="rounded border-input text-primary focus:ring-primary"
                />
                <span className="font-medium text-xs">Tampilkan di Halaman Tanya Jawab</span>
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setFaqModalOpen(false)}>
              Batal
            </Button>
            <Button size="sm" onClick={handleSaveFaq}>
              Simpan FAQ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: LAPORAN PUBLIKASI (PDF) */}
      <Dialog open={reportModalOpen} onOpenChange={setReportModalOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editingReport ? "Edit Laporan Publikasi (PDF)" : "Unggah Laporan Publikasi Baru (PDF)"}
            </DialogTitle>
            <DialogDescription>
              Isi metadata laporan dan lampirkan berkas dokumen PDF untuk dipublikasikan pada website publik.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2 text-xs">
            <div>
              <label className="font-medium text-foreground block mb-1">
                Judul Laporan Publikasi <span className="text-destructive">*</span>
              </label>
              <Input
                value={reportForm.title}
                onChange={(e) => setReportForm({ ...reportForm, title: e.target.value })}
                placeholder="Contoh: Laporan Keuangan Publikasi Triwulan II 2026"
                className="text-xs"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="font-medium text-foreground block mb-1">Kategori Laporan</label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={reportForm.category}
                  onChange={(e) => setReportForm({ ...reportForm, category: e.target.value })}
                >
                  <option value="KEUANGAN">Laporan Keuangan</option>
                  <option value="TATA_KELOLA">Tata Kelola (GCG)</option>
                  <option value="TAHUNAN">Laporan Tahunan</option>
                  <option value="KEBERLANJUTAN">Keberlanjutan</option>
                  <option value="LAINNYA">Lainnya</option>
                </select>
              </div>

              <div>
                <label className="font-medium text-foreground block mb-1">Periode</label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={reportForm.period}
                  onChange={(e) => setReportForm({ ...reportForm, period: e.target.value })}
                >
                  <option value="Triwulan I">Triwulan I</option>
                  <option value="Triwulan II">Triwulan II</option>
                  <option value="Triwulan III">Triwulan III</option>
                  <option value="Triwulan IV">Triwulan IV</option>
                  <option value="Semester I">Semester I</option>
                  <option value="Semester II">Semester II</option>
                  <option value="Tahunan">Tahunan</option>
                </select>
              </div>

              <div>
                <label className="font-medium text-foreground block mb-1">Tahun Laporan</label>
                <Input
                  type="number"
                  value={reportForm.year}
                  onChange={(e) => setReportForm({ ...reportForm, year: Number(e.target.value) })}
                  className="text-xs"
                />
              </div>
            </div>

            <div>
              <label className="font-medium text-foreground block mb-1">
                Berkas Dokumen PDF <span className="text-destructive">*</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  ref={pdfFileInputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  onChange={handlePdfUpload}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploadingPdf}
                  className="gap-1.5 shrink-0 text-xs border-rose-200 text-rose-700 hover:bg-rose-50"
                  onClick={() => pdfFileInputRef.current?.click()}
                >
                  <Upload className="h-3.5 w-3.5 text-rose-600" />
                  {uploadingPdf ? "Mengunggah PDF..." : "Pilih File PDF dari Komputer"}
                </Button>
                <span className="text-[11px] text-muted-foreground truncate flex-1">
                  {reportForm.fileName ? (
                    <span className="text-foreground font-medium flex items-center gap-1">
                      <FileText className="h-3 w-3 text-rose-600" />
                      {reportForm.fileName} ({formatFileSize(reportForm.fileSize)})
                    </span>
                  ) : (
                    "Maksimal 25MB (.pdf)"
                  )}
                </span>
              </div>

              {/* Or manual URL */}
              <div className="mt-2">
                <Input
                  value={reportForm.fileUrl}
                  onChange={(e) => setReportForm({ ...reportForm, fileUrl: e.target.value })}
                  placeholder="Atau masukkan tautan/URL berkas PDF..."
                  className="text-xs text-muted-foreground"
                />
              </div>
            </div>

            <div>
              <label className="font-medium text-foreground block mb-1">Keterangan / Ringkasan Dokumen</label>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                rows={3}
                value={reportForm.description}
                onChange={(e) => setReportForm({ ...reportForm, description: e.target.value })}
                placeholder="Penjelasan ringkas mengenai isi publikasi laporan..."
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="font-medium text-foreground block mb-1">Tanggal Publikasi</label>
                <Input
                  type="date"
                  value={reportForm.publishedAt}
                  onChange={(e) => setReportForm({ ...reportForm, publishedAt: e.target.value })}
                  className="text-xs"
                />
              </div>
              <div>
                <label className="font-medium text-foreground block mb-1">Urutan Tampil (Sort)</label>
                <Input
                  type="number"
                  value={reportForm.sortOrder}
                  onChange={(e) => setReportForm({ ...reportForm, sortOrder: Number(e.target.value) })}
                  className="text-xs"
                />
              </div>
            </div>

            <div className="pt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={reportForm.isActive}
                  onChange={(e) => setReportForm({ ...reportForm, isActive: e.target.checked })}
                  className="rounded border-input text-primary focus:ring-primary"
                />
                <span className="font-medium text-xs">
                  Publikasikan Sekarang (Dapat dilihat dan diunduh di website publik)
                </span>
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setReportModalOpen(false)}>
              Batal
            </Button>
            <Button
              size="sm"
              onClick={handleSaveReport}
              disabled={uploadingPdf}
              className="bg-rose-600 hover:bg-rose-700 text-white font-semibold"
            >
              Simpan Laporan PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
