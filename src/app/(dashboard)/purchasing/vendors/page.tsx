"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2,
  PlusCircle,
  Search,
  RefreshCw,
  Phone,
  Mail,
  CreditCard,
  MapPin,
  ShoppingCart,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const CATEGORIES = [
  "ALL",
  "IT & Komputer",
  "Percetakan & Formulir",
  "Alat Tulis Kantor",
  "Kendaraan Operasional",
  "Elektronik & Perawatan",
  "Lainnya",
];

export default function VendorsPage() {
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCat, setSelectedCat] = useState("ALL");

  // Create Modal
  const [newVendorOpen, setNewVendorOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [form, setForm] = useState({
    code: "",
    name: "",
    category: "IT & Komputer",
    contactPerson: "",
    phone: "",
    email: "",
    address: "",
    bankName: "BCA",
    bankAccount: "",
    bankHolder: "",
  });

  const fetchVendors = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (selectedCat !== "ALL") params.set("category", selectedCat);

      const res = await fetch(`/api/purchasing/vendors?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setVendors(data.vendors || []);
      }
    } catch (err) {
      console.error("Failed to load vendors:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVendors();
  }, [search, selectedCat]);

  const handleCreateVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setFeedbackMsg(null);
    try {
      const res = await fetch("/api/purchasing/vendors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mendaftarkan vendor.");

      setFeedbackMsg({ type: "success", text: "Vendor rekanan baru berhasil didaftarkan!" });
      setNewVendorOpen(false);
      setForm({
        code: "",
        name: "",
        category: "IT & Komputer",
        contactPerson: "",
        phone: "",
        email: "",
        address: "",
        bankName: "BCA",
        bankAccount: "",
        bankHolder: "",
      });
      fetchVendors();
    } catch (err: any) {
      setFeedbackMsg({ type: "error", text: err.message });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Link href="/purchasing" className="hover:underline">
              Pengadaan
            </Link>
            <span>/</span>
            <span>Vendor Rekanan</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Vendor & Supplier Rekanan BPR</h1>
          <p className="text-muted-foreground text-sm">
            Database rekanan pengadaan barang kantor, percetakan, perangkat IT, dan nomor rekening pembayaran resmi.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={() => setNewVendorOpen(true)} className="gap-2">
            <PlusCircle className="h-4 w-4" />
            Tambah Vendor Baru
          </Button>
        </div>
      </div>

      {/* Notifications */}
      {feedbackMsg && (
        <div
          className={`p-4 rounded-lg text-sm flex items-center justify-between ${
            feedbackMsg.type === "success"
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          <span>{feedbackMsg.text}</span>
          <button onClick={() => setFeedbackMsg(null)} className="text-xs font-semibold hover:underline">
            Tutup
          </button>
        </div>
      )}

      {/* Filter and Search */}
      <Card className="shadow-sm">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari kode vendor, nama perusahaan, kontak..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={selectedCat}
                onChange={(e) => setSelectedCat(e.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c === "ALL" ? "Semua Kategori" : c}
                  </option>
                ))}
              </select>

              <Button variant="ghost" size="sm" onClick={fetchVendors} className="gap-1 text-xs">
                <RefreshCw className="h-3.5 w-3.5" /> Segarkan
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Vendors Grid */}
      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Memuat data vendor rekanan...</div>
      ) : vendors.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground bg-muted/20 rounded-lg">
          Belum ada vendor rekanan yang sesuai kriteria pencarian.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {vendors.map((v) => (
            <Card key={v.id} className="shadow-sm hover:border-primary transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-mono text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      {v.code}
                    </span>
                    <CardTitle className="text-base font-bold mt-1 text-foreground">{v.name}</CardTitle>
                    <Badge variant="outline" className="text-[10px] mt-1 text-primary">
                      {v.category}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="space-y-1 text-muted-foreground">
                  {v.contactPerson && (
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-foreground">PIC:</span> {v.contactPerson}
                    </div>
                  )}
                  {v.phone && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{v.phone}</span>
                    </div>
                  )}
                  {v.email && (
                    <div className="flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="truncate">{v.email}</span>
                    </div>
                  )}
                  {v.address && (
                    <div className="flex items-start gap-1.5 pt-1">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{v.address}</span>
                    </div>
                  )}
                </div>

                {/* Bank Account Info */}
                {v.bankAccount && (
                  <div className="p-2.5 rounded bg-muted/40 border space-y-0.5">
                    <div className="flex items-center gap-1 font-semibold text-foreground">
                      <CreditCard className="h-3.5 w-3.5 text-primary" />
                      <span>Bank {v.bankName}</span>
                    </div>
                    <div className="font-mono font-bold text-foreground">{v.bankAccount}</div>
                    <div className="text-[10px] text-muted-foreground">a/n {v.bankHolder || v.name}</div>
                  </div>
                )}

                <div className="flex items-center justify-between border-t pt-2 text-[11px] text-muted-foreground">
                  <span>Pesanan Diterbitkan:</span>
                  <span className="font-bold text-foreground">{v._count?.purchaseOrders || 0} PO</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal: Tambah Rekanan Baru */}
      <Dialog open={newVendorOpen} onOpenChange={setNewVendorOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Daftarkan Rekanan / Vendor Baru</DialogTitle>
            <DialogDescription>
              Tambahkan data supplier penyedia barang & jasa operasional BPR.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateVendor} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="vCategory">Kategori *</Label>
                <select
                  id="vCategory"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  required
                >
                  {CATEGORIES.filter((c) => c !== "ALL").map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="vCode">Kode Vendor (Opsional)</Label>
                <Input
                  id="vCode"
                  placeholder="Otomatis jika kosong"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="vName">Nama Perusahaan / Toko *</Label>
              <Input
                id="vName"
                placeholder="Contoh: CV Bali Grafika Offset"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="vPic">Contact Person (PIC)</Label>
                <Input
                  id="vPic"
                  placeholder="Contoh: Bpk. Hendra Gunawan"
                  value={form.contactPerson}
                  onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="vPhone">Nomor Telepon / WA</Label>
                <Input
                  id="vPhone"
                  placeholder="Contoh: 081234567890"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="vEmail">Email Perusahaan</Label>
              <Input
                id="vEmail"
                type="email"
                placeholder="sales@perusahaan.co.id"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="vAddress">Alamat Lengkap</Label>
              <Input
                id="vAddress"
                placeholder="Alamat kantor / gudang supplier"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>

            {/* Banking */}
            <div className="grid grid-cols-3 gap-3 pt-2">
              <div className="space-y-2">
                <Label htmlFor="vBankName">Nama Bank</Label>
                <Input
                  id="vBankName"
                  placeholder="BCA / BPD / Mandiri"
                  value={form.bankName}
                  onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="vAcc">No. Rekening</Label>
                <Input
                  id="vAcc"
                  placeholder="0408891234"
                  value={form.bankAccount}
                  onChange={(e) => setForm({ ...form, bankAccount: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="vHolder">Atas Nama (a/n)</Label>
                <Input
                  id="vHolder"
                  placeholder="Nama pemilik rekening"
                  value={form.bankHolder}
                  onChange={(e) => setForm({ ...form, bankHolder: e.target.value })}
                />
              </div>
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setNewVendorOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? "Menyimpan..." : "Daftarkan Vendor"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
