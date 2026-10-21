/**
 * Sumber kebenaran navigasi & visibilitas modul (Tahap 3D — P0.3).
 *
 * Visibilitas ditentukan MURNI dari kode izin (permission) milik pengguna dan
 * cakupan data (ORGANIZATION). Tidak ada lagi daftar role-code manual — sehingga
 * menu selalu sinkron dengan penegakan izin di server (requireAuthAndPermission).
 *
 * Ini hanya lapisan UX. Batas keamanan tetap pengecekan di server/API.
 */
import type { ScopeLevel } from "./access-scope";

export interface NavChildConfig {
  key: string;
  title: string;
  href: string;
  permissions: string[];
  /** Bila diisi, hanya pengguna dengan cakupan ini yang melihat item. */
  scope?: "ORGANIZATION";
}

export interface NavItemConfig {
  key: string;
  type: "link" | "dropdown";
  title: string;
  href?: string;
  basePath?: string;
  /** Kunci ikon yang dipetakan di DashboardShell. */
  icon: string;
  permissions: string[];
  scope?: "ORGANIZATION";
  children?: NavChildConfig[];
}

export interface NavSectionConfig {
  label: string;
  items: NavItemConfig[];
}

/** Katalog izin per modul (satu tempat untuk menu & penjaga halaman). */
export const MODULE_PERMISSIONS = {
  dashboard: [],
  crm: ["crm.lead.view", "crm.customer.view", "credit.application.view", "credit.application.create"],
  crmLeads: ["crm.lead.view"],
  crmCustomers: ["crm.customer.view"],
  credit: [
    "credit.application.view",
    "credit.analysis.view",
    "credit.survey.view",
    "credit.review.view",
    "credit.decision.view",
    "credit.realization.view",
  ],
  creditApplications: ["credit.application.view"],
  creditCollaterals: ["credit.collateral.view"],
  creditSlik: ["credit.analysis.view", "credit.application.view"],
  field: ["field.task.view", "field.activity.view", "field.performance.view", "credit.survey.view"],
  fieldTasks: ["field.task.view", "credit.survey.view"],
  fieldPerformance: ["field.performance.view"],
  documents: ["document.view"],
  inventory: ["inventory.item.view", "asset.view"],
  inventoryItems: ["inventory.item.view"],
  inventoryAssets: ["asset.view"],
  inventoryMaintenance: ["asset.view"],
  purchasing: ["purchase.request.view", "purchase.order.view", "purchase.receipt.view", "vendor.view"],
  purchasingRequests: ["purchase.request.view"],
  purchasingOrders: ["purchase.order.view"],
  purchasingReceipts: ["purchase.receipt.view"],
  purchasingVendors: ["vendor.view"],
  reports: ["report.credit.view", "report.field.view", "report.inventory.view", "report.purchasing.view", "report.management.view"],
  audit: ["audit.log.view"],
  admin: ["admin.user.view", "admin.role.view", "admin.master_data.view", "admin.settings.view", "cms.page.view", "cms.post.view"],
  adminUsers: ["admin.user.view"],
  adminRoles: ["admin.role.view"],
  adminMaster: ["admin.master_data.view"],
  adminCms: ["cms.page.view", "cms.post.view"],
} as const;

export const NAV_SECTIONS: NavSectionConfig[] = [
  {
    label: "Utama",
    items: [
      { key: "dashboard", type: "link", title: "Dashboard", href: "/dashboard", icon: "dashboard", permissions: [...MODULE_PERMISSIONS.dashboard] },
    ],
  },
  {
    label: "Operasional & Kredit",
    items: [
      {
        key: "crm",
        type: "dropdown",
        title: "CRM & Prospek",
        basePath: "/crm",
        icon: "crm",
        permissions: [...MODULE_PERMISSIONS.crm],
        children: [
          { key: "crm.home", title: "Ringkasan CRM", href: "/crm", permissions: [...MODULE_PERMISSIONS.crm] },
          { key: "crm.leads", title: "Data Prospek (Leads)", href: "/crm/leads", permissions: [...MODULE_PERMISSIONS.crmLeads] },
          { key: "crm.customers", title: "Data Nasabah (Customers)", href: "/crm/customers", permissions: [...MODULE_PERMISSIONS.crmCustomers] },
        ],
      },
      {
        key: "credit",
        type: "dropdown",
        title: "Kredit & Analisis",
        basePath: "/credit",
        icon: "credit",
        permissions: [...MODULE_PERMISSIONS.credit],
        children: [
          { key: "credit.home", title: "Pipeline & Analisis", href: "/credit", permissions: [...MODULE_PERMISSIONS.credit] },
          { key: "credit.applications", title: "Pengajuan Kredit", href: "/credit/applications", permissions: [...MODULE_PERMISSIONS.creditApplications] },
          { key: "credit.collaterals", title: "Agunan & Jaminan", href: "/credit/collaterals", permissions: [...MODULE_PERMISSIONS.creditCollaterals] },
          { key: "credit.slik", title: "Analisa SLIK OJK", href: "/credit/slik-analyzer", permissions: [...MODULE_PERMISSIONS.creditSlik] },
        ],
      },
      { key: "field", type: "link", title: "Petugas Lapangan", href: "/field", icon: "field", permissions: [...MODULE_PERMISSIONS.field] },
      { key: "documents", type: "link", title: "Dokumen Digital", href: "/documents", icon: "documents", permissions: [...MODULE_PERMISSIONS.documents] },
    ],
  },
  {
    label: "Logistik & Aset",
    items: [
      {
        key: "inventory",
        type: "dropdown",
        title: "Inventaris & Aset",
        basePath: "/inventory",
        icon: "inventory",
        permissions: [...MODULE_PERMISSIONS.inventory],
        children: [
          { key: "inventory.home", title: "Ringkasan Aset & Stok", href: "/inventory", permissions: [...MODULE_PERMISSIONS.inventory] },
          { key: "inventory.items", title: "Stok Barang & ATK", href: "/inventory/items", permissions: [...MODULE_PERMISSIONS.inventoryItems] },
          { key: "inventory.assets", title: "Aset Operasional", href: "/inventory/assets", permissions: [...MODULE_PERMISSIONS.inventoryAssets] },
          { key: "inventory.maintenance", title: "Pemeliharaan Aset", href: "/inventory/maintenance", permissions: [...MODULE_PERMISSIONS.inventoryMaintenance] },
        ],
      },
      {
        key: "purchasing",
        type: "dropdown",
        title: "Pengadaan (Purchasing)",
        basePath: "/purchasing",
        icon: "purchasing",
        permissions: [...MODULE_PERMISSIONS.purchasing],
        children: [
          { key: "purchasing.home", title: "Ringkasan Pengadaan", href: "/purchasing", permissions: [...MODULE_PERMISSIONS.purchasing] },
          { key: "purchasing.requests", title: "Pengajuan (PR)", href: "/purchasing/requests", permissions: [...MODULE_PERMISSIONS.purchasingRequests] },
          { key: "purchasing.orders", title: "Pesanan Pembelian (PO)", href: "/purchasing/orders", permissions: [...MODULE_PERMISSIONS.purchasingOrders] },
          { key: "purchasing.receipts", title: "Penerimaan Barang (GRN)", href: "/purchasing/receipts", permissions: [...MODULE_PERMISSIONS.purchasingReceipts] },
          { key: "purchasing.vendors", title: "Rekanan & Vendor", href: "/purchasing/vendors", permissions: [...MODULE_PERMISSIONS.purchasingVendors] },
        ],
      },
    ],
  },
  {
    label: "Pengawasan & Audit",
    items: [
      { key: "reports", type: "link", title: "Laporan & Analitika", href: "/reports", icon: "reports", permissions: [...MODULE_PERMISSIONS.reports] },
      { key: "audit", type: "link", title: "Audit Trail Log", href: "/audit", icon: "audit", permissions: [...MODULE_PERMISSIONS.audit], scope: "ORGANIZATION" },
    ],
  },
  {
    label: "Administrasi Sistem",
    items: [
      {
        key: "admin",
        type: "dropdown",
        title: "Admin & Pengaturan",
        basePath: "/admin",
        icon: "admin",
        permissions: [...MODULE_PERMISSIONS.admin],
        children: [
          { key: "admin.home", title: "Panel Admin", href: "/admin", permissions: ["admin.user.view", "admin.role.view", "admin.master_data.view", "admin.settings.view"], scope: "ORGANIZATION" },
          { key: "admin.users", title: "Pengguna (Users)", href: "/admin/users", permissions: [...MODULE_PERMISSIONS.adminUsers], scope: "ORGANIZATION" },
          { key: "admin.roles", title: "Peran & Izin (Roles)", href: "/admin/roles", permissions: [...MODULE_PERMISSIONS.adminRoles], scope: "ORGANIZATION" },
          { key: "admin.master", title: "Master Data", href: "/admin/master-data", permissions: [...MODULE_PERMISSIONS.adminMaster], scope: "ORGANIZATION" },
          { key: "admin.creditLimits", title: "Limit Kewenangan Kredit", href: "/admin/credit-limits", permissions: [...MODULE_PERMISSIONS.adminMaster], scope: "ORGANIZATION" },
          { key: "admin.branches", title: "Kantor Cabang", href: "/admin/branches", permissions: [...MODULE_PERMISSIONS.adminMaster], scope: "ORGANIZATION" },
          { key: "admin.departments", title: "Departemen & Divisi", href: "/admin/departments", permissions: [...MODULE_PERMISSIONS.adminMaster], scope: "ORGANIZATION" },
          { key: "admin.cms", title: "CMS & Konten Website", href: "/admin/cms", permissions: [...MODULE_PERMISSIONS.adminCms] },
        ],
      },
    ],
  },
];

/** Menilai apakah sebuah item/child boleh diakses pengguna. */
export function hasNavAccess(
  permissions: Set<string>,
  scopeLevel: ScopeLevel,
  requirement: { permissions: readonly string[]; scope?: "ORGANIZATION" }
): boolean {
  if (requirement.scope === "ORGANIZATION" && scopeLevel !== "ORGANIZATION") return false;
  if (requirement.permissions.length === 0) return true;
  return requirement.permissions.some((p) => permissions.has(p) || permissions.has("admin.super"));
}

/**
 * Menyaring katalog navigasi menjadi hanya item yang boleh dilihat pengguna.
 * Dropdown tanpa child yang lolos akan ikut disembunyikan.
 */
export function buildVisibleNav(permissions: Set<string>, scopeLevel: ScopeLevel): NavSectionConfig[] {
  return NAV_SECTIONS.map((section) => {
    const items = section.items
      .map((item) => {
        if (!hasNavAccess(permissions, scopeLevel, item)) return null;
        if (item.type === "dropdown") {
          const children = (item.children ?? []).filter((c) => hasNavAccess(permissions, scopeLevel, c));
          if (children.length === 0) return null;
          return { ...item, children };
        }
        return item;
      })
      .filter((x): x is NavItemConfig => x !== null);
    return { label: section.label, items };
  }).filter((section) => section.items.length > 0);
}

/**
 * Pemetaan prefiks rute → izin minimum, dipakai penjaga halaman terpusat di layout.
 * Prefiks terpanjang yang menang (mis. /crm/customers mengalahkan /crm).
 */
export const NAV_ROUTE_REQUIREMENTS: Array<{
  prefix: string;
  permissions: readonly string[];
  scope?: "ORGANIZATION";
}> = [
  { prefix: "/crm/customers", permissions: MODULE_PERMISSIONS.crmCustomers },
  { prefix: "/crm/leads", permissions: MODULE_PERMISSIONS.crmLeads },
  { prefix: "/crm", permissions: MODULE_PERMISSIONS.crm },
  { prefix: "/credit/applications", permissions: MODULE_PERMISSIONS.creditApplications },
  { prefix: "/credit/collaterals", permissions: MODULE_PERMISSIONS.creditCollaterals },
  { prefix: "/credit/slik-analyzer", permissions: MODULE_PERMISSIONS.creditSlik },
  { prefix: "/credit", permissions: MODULE_PERMISSIONS.credit },
  { prefix: "/field/tasks", permissions: MODULE_PERMISSIONS.fieldTasks },
  { prefix: "/field/performance", permissions: MODULE_PERMISSIONS.fieldPerformance },
  { prefix: "/field", permissions: MODULE_PERMISSIONS.field },
  { prefix: "/documents", permissions: MODULE_PERMISSIONS.documents },
  { prefix: "/inventory/items", permissions: MODULE_PERMISSIONS.inventoryItems },
  { prefix: "/inventory/assets", permissions: MODULE_PERMISSIONS.inventoryAssets },
  { prefix: "/inventory/maintenance", permissions: MODULE_PERMISSIONS.inventoryMaintenance },
  { prefix: "/inventory", permissions: MODULE_PERMISSIONS.inventory },
  { prefix: "/purchasing/requests", permissions: MODULE_PERMISSIONS.purchasingRequests },
  { prefix: "/purchasing/orders", permissions: MODULE_PERMISSIONS.purchasingOrders },
  { prefix: "/purchasing/receipts", permissions: MODULE_PERMISSIONS.purchasingReceipts },
  { prefix: "/purchasing/vendors", permissions: MODULE_PERMISSIONS.purchasingVendors },
  { prefix: "/purchasing", permissions: MODULE_PERMISSIONS.purchasing },
  { prefix: "/reports", permissions: MODULE_PERMISSIONS.reports },
  { prefix: "/audit", permissions: MODULE_PERMISSIONS.audit, scope: "ORGANIZATION" },
  { prefix: "/admin/users", permissions: MODULE_PERMISSIONS.adminUsers, scope: "ORGANIZATION" },
  { prefix: "/admin/roles", permissions: MODULE_PERMISSIONS.adminRoles, scope: "ORGANIZATION" },
  { prefix: "/admin/master-data", permissions: MODULE_PERMISSIONS.adminMaster, scope: "ORGANIZATION" },
  { prefix: "/admin/credit-limits", permissions: MODULE_PERMISSIONS.adminMaster, scope: "ORGANIZATION" },
  { prefix: "/admin/branches", permissions: MODULE_PERMISSIONS.adminMaster, scope: "ORGANIZATION" },
  { prefix: "/admin/departments", permissions: MODULE_PERMISSIONS.adminMaster, scope: "ORGANIZATION" },
  { prefix: "/admin/cms", permissions: MODULE_PERMISSIONS.adminCms },
  { prefix: "/admin", permissions: ["admin.user.view", "admin.role.view", "admin.master_data.view", "admin.settings.view"], scope: "ORGANIZATION" },
];

/** Mengembalikan syarat izin untuk sebuah pathname (prefiks terpanjang). */
export function requirementForPath(
  pathname: string
): { permissions: readonly string[]; scope?: "ORGANIZATION" } | null {
  let match: (typeof NAV_ROUTE_REQUIREMENTS)[number] | null = null;
  for (const req of NAV_ROUTE_REQUIREMENTS) {
    if (pathname === req.prefix || pathname.startsWith(`${req.prefix}/`)) {
      if (!match || req.prefix.length > match.prefix.length) match = req;
    }
  }
  return match;
}

