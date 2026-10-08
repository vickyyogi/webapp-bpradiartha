"use client";

import { useState, useEffect } from "react";
import {
  Database,
  Plus,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Search,
  Filter,
  Layers,
  Percent,
  FileCheck,
  Package,
  Users,
  Briefcase,
  Sliders,
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

interface MasterItem {
  id: string;
  category: string;
  code: string;
  name: string;
  description: string | null;
  attributes: any | null;
  isActive: boolean;
  sortOrder: number;
}

const CATEGORIES = [
  { key: "ALL", label: "Semua Kategori", icon: Database },
  { key: "LOAN_PRODUCT", label: "Produk Kredit", icon: Percent },
  { key: "LEAD_SOURCE", label: "Sumber Prospek (Leads)", icon: Users },
  { key: "ASSET_CATEGORY", label: "Kategori Aset", icon: Layers },
  { key: "INVENTORY_CATEGORY", label: "Kategori Stok ATK", icon: Package },
  { key: "DOCUMENT_TYPE", label: "Jenis Dokumen", icon: FileCheck },
  { key: "VENDOR_CATEGORY", label: "Kategori Vendor", icon: Briefcase },
  { key: "POSITION", label: "Jabatan Pegawai", icon: Sliders },
];

export default function MasterDataPage() {
  const [items, setItems] = useState<MasterItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MasterItem | null>(null);
  const [form, setForm] = useState({
    category: "LOAN_PRODUCT",
    code: "",
    name: "",
    description: "",
    sortOrder: 1,
    isActive: true,
    // attributes for loan product
    interestRate: 1.25,
    minAmount: 10000000,
    maxAmount: 500000000,
    minTenor: 6,
    maxTenor: 36,
  });

  const fetchItems = async () => {
    setLoading(true);
    try {
      const url =
        selectedCategory === "ALL"
          ? "/api/admin/master-data"
          : `/api/admin/master-data?category=${selectedCategory}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setItems(data);
      }
    } catch (e) {
      console.error("Failed to fetch master data:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [selectedCategory]);

  const openAddModal = () => {
    setEditingItem(null);
    setForm({
      category: selectedCategory === "ALL" ? "LOAN_PRODUCT" : selectedCategory,
      code: "",
      name: "",
      description: "",
      sortOrder: items.length + 1,
      isActive: true,
      interestRate: 1.25,
      minAmount: 10000000,
      maxAmount: 500000000,
      minTenor: 6,
      maxTenor: 36,
    });
    setModalOpen(true);
  };

  const openEditModal = (item: MasterItem) => {
    setEditingItem(item);
    const attrs = item.attributes || {};
    setForm({
      category: item.category,
      code: item.code,
      name: item.name,
      description: item.description || "",
      sortOrder: item.sortOrder,
      isActive: item.isActive,
      interestRate: attrs.interestRate || 1.25,
      minAmount: attrs.minAmount || 10000000,
      maxAmount: attrs.maxAmount || 500000000,
      minTenor: attrs.minTenor || 6,
      maxTenor: attrs.maxTenor || 36,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      let attributes: any = null;
      if (form.category === "LOAN_PRODUCT") {
        attributes = {
          interestRate: Number(form.interestRate),
          minAmount: Number(form.minAmount),
          maxAmount: Number(form.maxAmount),
          minTenor: Number(form.minTenor),
          maxTenor: Number(form.maxTenor),
        };
      }

      const payload = {
        category: form.category,
        code: form.code,
        name: form.name,
        description: form.description,
        sortOrder: Number(form.sortOrder),
        isActive: form.isActive,
        attributes,
      };

      const url = editingItem
        ? `/api/admin/master-data/${editingItem.id}`
        : "/api/admin/master-data";
      const method = editingItem ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setModalOpen(false);
        fetchItems();
      } else {
        const err = await res.json();
        alert(err.error || "Gagal menyimpan item");
      }
    } catch (e) {
      console.error("Save master item error:", e);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus item master data ini?")) return;
    try {
      const res = await fetch(`/api/admin/master-data/${id}`, { method: "DELETE" });
      if (res.ok) fetchItems();
    } catch (e) {
      console.error("Delete error:", e);
    }
  };

  const filteredItems = items.filter((item) => {
    const q = searchQuery.toLowerCase();
    return (
      item.name.toLowerCase().includes(q) ||
      item.code.toLowerCase().includes(q) ||
      (item.description && item.description.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Database className="h-6 w-6 text-primary" />
            Master Data Terpusat
          </h1>
          <p className="text-sm text-muted-foreground">
            Standarisasi definisi kode produk, jenis dokumen, kategori inventaris & aset, serta parameter operasional bank.
          </p>
        </div>
        <Button onClick={openAddModal} className="gap-2 shrink-0">
          <Plus className="h-4 w-4" /> Tambah Item Master
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="border">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs">Total Master Item</CardDescription>
            <CardTitle className="text-2xl">{items.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs">Produk Kredit Aktif</CardDescription>
            <CardTitle className="text-2xl text-primary">
              {items.filter((i) => i.category === "LOAN_PRODUCT" && i.isActive).length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="border">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs">Jenis Dokumen Legal</CardDescription>
            <CardTitle className="text-2xl">
              {items.filter((i) => i.category === "DOCUMENT_TYPE").length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="border">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs">Kategori Aset & ATK</CardDescription>
            <CardTitle className="text-2xl">
              {items.filter((i) => i.category === "ASSET_CATEGORY" || i.category === "INVENTORY_CATEGORY").length}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Category Pills & Search */}
      <div className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isSelected = selectedCategory === cat.key;
            return (
              <button
                key={cat.key}
                onClick={() => setSelectedCategory(cat.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  isSelected
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {cat.label}
              </button>
            );
          })}
        </div>

        <div className="relative w-full md:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari kode atau nama..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 text-xs h-9"
          />
        </div>
      </div>

      {/* Table */}
      <Card className="border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b bg-muted/50 text-muted-foreground font-semibold">
                <th className="p-3 w-12 text-center">No</th>
                <th className="p-3 w-28">Kategori</th>
                <th className="p-3 w-32">Kode Unik</th>
                <th className="p-3">Nama & Keterangan</th>
                <th className="p-3 w-48">Parameter Tambahan</th>
                <th className="p-3 w-24 text-center">Status</th>
                <th className="p-3 w-20 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    Memuat master data...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    Tidak ada item master data yang sesuai kriteria.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-3 text-center text-muted-foreground font-mono">
                      {idx + 1}
                    </td>
                    <td className="p-3">
                      <Badge variant="outline" className="text-[10px] font-medium">
                        {item.category}
                      </Badge>
                    </td>
                    <td className="p-3 font-mono font-semibold text-primary">
                      {item.code}
                    </td>
                    <td className="p-3">
                      <div className="font-semibold text-foreground">{item.name}</div>
                      {item.description && (
                        <div className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                          {item.description}
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-[11px] text-muted-foreground">
                      {item.category === "LOAN_PRODUCT" && item.attributes ? (
                        <div className="space-y-0.5">
                          <div>
                            Bunga: <strong className="text-foreground">{item.attributes.interestRate}%/bln</strong>
                          </div>
                          <div>
                            Tenor: {item.attributes.minTenor}-{item.attributes.maxTenor} bln
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground/60">-</span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      {item.isActive ? (
                        <Badge className="bg-emerald-600 hover:bg-emerald-700 text-[10px]">
                          Aktif
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">
                          Non-aktif
                        </Badge>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => openEditModal(item)}
                        >
                          <Edit className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:bg-destructive/10"
                          onClick={() => handleDelete(item.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal Add / Edit */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "Edit Item Master Data" : "Tambah Item Master Data"}
            </DialogTitle>
            <DialogDescription>
              Isi data definisi master item secara lengkap dan valid.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-medium text-foreground block mb-1">Kategori</label>
                <select
                  disabled={!!editingItem}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                >
                  <option value="LOAN_PRODUCT">LOAN_PRODUCT</option>
                  <option value="LEAD_SOURCE">LEAD_SOURCE</option>
                  <option value="ASSET_CATEGORY">ASSET_CATEGORY</option>
                  <option value="INVENTORY_CATEGORY">INVENTORY_CATEGORY</option>
                  <option value="DOCUMENT_TYPE">DOCUMENT_TYPE</option>
                  <option value="VENDOR_CATEGORY">VENDOR_CATEGORY</option>
                  <option value="POSITION">POSITION</option>
                </select>
              </div>
              <div>
                <label className="font-medium text-foreground block mb-1">Kode Unik</label>
                <Input
                  disabled={!!editingItem}
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  placeholder="Contoh: KREDIT-MK"
                  className="font-mono uppercase"
                />
              </div>
            </div>

            <div>
              <label className="font-medium text-foreground block mb-1">Nama Master Item</label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Contoh: Kredit Modal Kerja"
              />
            </div>

            <div>
              <label className="font-medium text-foreground block mb-1">Deskripsi / Keterangan</label>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Fungsi atau cakupan penggunaan item ini..."
              />
            </div>

            {form.category === "LOAN_PRODUCT" && (
              <div className="p-3 bg-muted/40 rounded-lg space-y-2 border">
                <h4 className="font-semibold text-xs text-foreground">Parameter Produk Pinjaman</h4>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[11px] text-muted-foreground block mb-0.5">Bunga (%/bln)</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={form.interestRate}
                      onChange={(e) => setForm({ ...form, interestRate: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-muted-foreground block mb-0.5">Min Tenor (bln)</label>
                    <Input
                      type="number"
                      value={form.minTenor}
                      onChange={(e) => setForm({ ...form, minTenor: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-muted-foreground block mb-0.5">Max Tenor (bln)</label>
                    <Input
                      type="number"
                      value={form.maxTenor}
                      onChange={(e) => setForm({ ...form, maxTenor: Number(e.target.value) })}
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 items-center pt-1">
              <div>
                <label className="font-medium text-foreground block mb-1">Urutan (Sort Order)</label>
                <Input
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
                />
              </div>
              <div className="pt-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                    className="rounded border-input text-primary focus:ring-primary"
                  />
                  <span className="font-medium text-xs">Status Aktif</span>
                </label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setModalOpen(false)}>
              Batal
            </Button>
            <Button size="sm" onClick={handleSave}>
              Simpan Master Data
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
