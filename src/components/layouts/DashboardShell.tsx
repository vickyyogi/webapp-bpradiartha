"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu,
  X,
  ChevronDown,
  LayoutDashboard,
  Users,
  CreditCard,
  MapPin,
  FileText,
  Package,
  ShoppingBag,
  BarChart3,
  ShieldCheck,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  CircleDot,
  Building,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LogoutButton } from "@/app/(dashboard)/LogoutButton";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { ThemeToggle } from "@/components/public/ThemeToggle";

export type MenuVisibility = {
  showCrm: boolean;
  showCredit: boolean;
  showField: boolean;
  showDocuments: boolean;
  showInventory: boolean;
  showPurchasing: boolean;
  showReports: boolean;
  showAudit: boolean;
  showAdmin: boolean;
  showAdminUsers: boolean;
  showAdminRoles: boolean;
  showAdminMaster: boolean;
  showAdminBranches?: boolean;
  showAdminDepartments?: boolean;
  showAdminCms: boolean;
};

interface Props {
  userName: string;
  userRoleLabel: string;
  menuVisibility: MenuVisibility;
  children: React.ReactNode;
}

type NavLinkItem = {
  type: "link";
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  visible?: boolean;
};

type NavDropdownItem = {
  type: "dropdown";
  key: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  basePath: string;
  visible?: boolean;
  children: {
    title: string;
    href: string;
    visible?: boolean;
  }[];
};

type NavItem = NavLinkItem | NavDropdownItem;

type NavSection = {
  label: string;
  items: NavItem[];
};

export function DashboardShell({
  userName,
  userRoleLabel,
  menuVisibility,
  children,
}: Props) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Read sidebar preference from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("bpr_sidebar_open");
    if (saved !== null) {
      setIsOpen(saved === "true");
    }
  }, []);

  const toggleSidebar = () => {
    const nextState = !isOpen;
    setIsOpen(nextState);
    localStorage.setItem("bpr_sidebar_open", String(nextState));
  };

  const toggleMobileSidebar = () => {
    setIsMobileOpen((prev) => !prev);
  };

  const {
    showCrm,
    showCredit,
    showField,
    showDocuments,
    showInventory,
    showPurchasing,
    showReports,
    showAudit,
    showAdmin,
    showAdminUsers,
    showAdminRoles,
    showAdminMaster,
    showAdminBranches = true,
    showAdminDepartments = true,
    showAdminCms,
  } = menuVisibility;

  // Toggle Dropdowns State
  const [openDropdowns, setOpenDropdowns] = useState<Record<string, boolean>>({
    crm: pathname.startsWith("/crm"),
    credit: pathname.startsWith("/credit"),
    inventory: pathname.startsWith("/inventory"),
    purchasing: pathname.startsWith("/purchasing"),
    admin: pathname.startsWith("/admin"),
  });

  // Automatically expand dropdown for current active route
  useEffect(() => {
    setOpenDropdowns((prev) => ({
      ...prev,
      crm: prev.crm || pathname.startsWith("/crm"),
      credit: prev.credit || pathname.startsWith("/credit"),
      inventory: prev.inventory || pathname.startsWith("/inventory"),
      purchasing: prev.purchasing || pathname.startsWith("/purchasing"),
      admin: prev.admin || pathname.startsWith("/admin"),
    }));
  }, [pathname]);

  const toggleDropdown = (key: string) => {
    setOpenDropdowns((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const isExactActive = (path: string) => pathname === path;
  const isModuleActive = (basePath: string) => pathname.startsWith(basePath);

  // Categorized Navigation Sections
  const navSections: NavSection[] = [
    {
      label: "Utama",
      items: [
        {
          type: "link",
          title: "Dashboard",
          href: "/dashboard",
          icon: LayoutDashboard,
        },
      ],
    },
    {
      label: "Operasional & Kredit",
      items: [
        {
          type: "dropdown",
          key: "crm",
          title: "CRM & Prospek",
          icon: Users,
          basePath: "/crm",
          visible: showCrm,
          children: [
            { title: "Ringkasan CRM", href: "/crm" },
            { title: "Data Prospek (Leads)", href: "/crm/leads" },
          ],
        },
        {
          type: "dropdown",
          key: "credit",
          title: "Kredit & Analisis",
          icon: CreditCard,
          basePath: "/credit",
          visible: showCredit,
          children: [
            { title: "Pipeline & Analisis", href: "/credit" },
            { title: "Pengajuan Kredit", href: "/credit/applications" },
            { title: "Analisa SLIK OJK", href: "/credit/slik-analyzer" },
          ],
        },
        {
          type: "link",
          title: "Petugas Lapangan",
          href: "/field",
          icon: MapPin,
          visible: showField,
        },
        {
          type: "link",
          title: "Dokumen Digital",
          href: "/documents",
          icon: FileText,
          visible: showDocuments,
        },
      ],
    },
    {
      label: "Logistik & Aset",
      items: [
        {
          type: "dropdown",
          key: "inventory",
          title: "Inventaris & Aset",
          icon: Package,
          basePath: "/inventory",
          visible: showInventory,
          children: [
            { title: "Ringkasan Aset & Stok", href: "/inventory" },
            { title: "Stok Barang & ATK", href: "/inventory/items" },
            { title: "Aset Operasional", href: "/inventory/assets" },
            { title: "Pemeliharaan Aset", href: "/inventory/maintenance" },
          ],
        },
        {
          type: "dropdown",
          key: "purchasing",
          title: "Pengadaan (Purchasing)",
          icon: ShoppingBag,
          basePath: "/purchasing",
          visible: showPurchasing,
          children: [
            { title: "Ringkasan Pengadaan", href: "/purchasing" },
            { title: "Pengajuan (PR)", href: "/purchasing/requests" },
            { title: "Pesanan Pembelian (PO)", href: "/purchasing/orders" },
            { title: "Penerimaan Barang (GRN)", href: "/purchasing/receipts" },
            { title: "Rekanan & Vendor", href: "/purchasing/vendors" },
          ],
        },
      ],
    },
    {
      label: "Pengawasan & Audit",
      items: [
        {
          type: "link",
          title: "Laporan & Analitika",
          href: "/reports",
          icon: BarChart3,
          visible: showReports,
        },
        {
          type: "link",
          title: "Audit Trail Log",
          href: "/audit",
          icon: ShieldCheck,
          visible: showAudit,
        },
      ],
    },
    {
      label: "Administrasi Sistem",
      items: [
        {
          type: "dropdown",
          key: "admin",
          title: "Admin & Pengaturan",
          icon: Settings,
          basePath: "/admin",
          visible: showAdmin,
          children: [
            { title: "Panel Admin", href: "/admin" },
            { title: "Pengguna (Users)", href: "/admin/users", visible: showAdminUsers },
            { title: "Peran & Izin (Roles)", href: "/admin/roles", visible: showAdminRoles },
            { title: "Master Data", href: "/admin/master-data", visible: showAdminMaster },
            { title: "Kantor Cabang", href: "/admin/branches", visible: showAdminBranches },
            { title: "Departemen & Divisi", href: "/admin/departments", visible: showAdminDepartments },
            { title: "CMS & Konten Website", href: "/admin/cms", visible: showAdminCms },
          ],
        },
      ],
    },
  ];

  // Helper renderer for nav item
  const renderNavItem = (item: NavItem, onNavigate?: () => void) => {
    if (item.visible === false) return null;

    if (item.type === "link") {
      const active = isExactActive(item.href);
      return (
        <Link
          key={item.href}
          href={item.href}
          onClick={onNavigate}
          className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-all group ${
            active
              ? "bg-primary text-primary-foreground font-semibold shadow-xs"
              : "text-foreground/75 hover:bg-primary-soft hover:text-primary"
          }`}
        >
          <item.icon
            className={`h-4 w-4 shrink-0 transition-colors ${
              active ? "text-primary-foreground" : "text-muted-foreground group-hover:text-primary"
            }`}
          />
          <span className="truncate">{item.title}</span>
        </Link>
      );
    }

    if (item.type === "dropdown") {
      const isParentActive = isModuleActive(item.basePath);
      const isDropdownOpen = !!openDropdowns[item.key];
      const validChildren = item.children.filter((c) => c.visible !== false);

      if (validChildren.length === 0) return null;

      return (
        <div key={item.key} className="space-y-1">
          <button
            type="button"
            onClick={() => toggleDropdown(item.key)}
            className={`w-full flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition-all cursor-pointer select-none group ${
              isParentActive
                ? "bg-primary-soft text-primary font-bold border border-primary/20"
                : "text-foreground/75 hover:bg-primary-soft hover:text-primary"
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <item.icon
                className={`h-4 w-4 shrink-0 transition-colors ${
                  isParentActive ? "text-primary" : "text-muted-foreground group-hover:text-primary"
                }`}
              />
              <span className="truncate">{item.title}</span>
            </div>
            <ChevronDown
              className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${
                isDropdownOpen ? "rotate-180 text-primary" : "text-muted-foreground group-hover:text-primary"
              }`}
            />
          </button>

          {isDropdownOpen && (
            <div className="relative pl-3 ml-3 my-1 space-y-0.5 border-l-2 border-border/60 animate-in fade-in slide-in-from-top-1 duration-150">
              {validChildren.map((child) => {
                const isChildActive = pathname === child.href;
                return (
                  <Link
                    key={child.href}
                    href={child.href}
                    onClick={onNavigate}
                    className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs transition-all ${
                      isChildActive
                        ? "text-primary font-bold bg-primary-soft border-l-2 border-primary -ml-[14px] pl-[20px]"
                        : "text-muted-foreground hover:text-primary hover:bg-primary-soft/50"
                    }`}
                  >
                    <CircleDot
                      className={`h-1.5 w-1.5 shrink-0 ${
                        isChildActive ? "text-primary" : "text-muted-foreground/40"
                      }`}
                    />
                    <span className="truncate">{child.title}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    return null;
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 flex h-16 items-center gap-3 border-b border-border bg-background/95 backdrop-blur px-4 md:px-6 shadow-2xs">
        {/* Toggle Button for Desktop */}
        
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          title={isOpen ? "Tutup Sidebar Menu" : "Buka Sidebar Menu"}
          className="hidden md:flex text-muted-foreground hover:text-primary hover:bg-primary-soft cursor-pointer"
        >
          {isOpen ? <PanelLeftClose className="h-5 w-5" /> : <PanelLeftOpen className="h-5 w-5" />}
        </Button>

        {/* Toggle Button for Mobile */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleMobileSidebar}
          className="md:hidden text-muted-foreground hover:text-primary hover:bg-primary-soft cursor-pointer"
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2.5 font-bold tracking-tight">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-white font-black text-sm shadow-xs border border-gold/40">
            A
          </div>
          <div className="flex flex-col">
            <span className="text-base font-bold text-foreground leading-tight">BPR Adiartha</span>
            <span className="text-[10px] font-semibold text-gold-dark uppercase tracking-wider">
              Sistem Operasional
            </span>
          </div>
        </Link>

        {/* Header Right Actions */}
        <div className="ml-auto flex items-center gap-3">
          <ThemeToggle />
          <NotificationBell />
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-sm font-semibold leading-none text-foreground">{userName}</span>
            <span className="text-[11px] font-medium text-gold-dark bg-gold-soft px-1.5 py-0.5 rounded mt-1 border border-gold/30">
              {userRoleLabel}
            </span>
          </div>
          <LogoutButton />
          
        </div>
      </header>

      <div className="flex flex-1 relative overflow-hidden">
        {/* Desktop Sidebar */}
        <aside
          className={`hidden md:block border-r border-border bg-background transition-all duration-300 ease-in-out select-none ${
            isOpen ? "w-64" : "w-0 border-r-0 opacity-0 pointer-events-none"
          }`}
        >
          <div className="w-64 h-full overflow-y-auto p-3 space-y-4">
            {navSections.map((section) => {
              const visibleItems = section.items.filter((item) => item.visible !== false);
              if (visibleItems.length === 0) return null;

              return (
                <div key={section.label} className="space-y-1">
                  <div className="px-3 pt-2 pb-1 text-[10px] font-bold tracking-wider text-muted-foreground/70 uppercase">
                    {section.label}
                  </div>
                  <nav className="grid gap-1">
                    {visibleItems.map((item) => renderNavItem(item))}
                  </nav>
                </div>
              );
            })}
          </div>
        </aside>

        {/* Mobile Drawer Overlay */}
        {isMobileOpen && (
          <div className="md:hidden fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex">
            <div className="w-72 bg-background border-r border-border h-full overflow-y-auto p-4 flex flex-col shadow-xl">
              <div className="flex items-center justify-between pb-4 mb-2 border-b border-border">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center text-white font-black text-xs shadow-xs border border-gold/40">
                    A
                  </div>
                  <span className="font-bold text-foreground text-base">BPR Adiartha</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleMobileSidebar}
                  className="hover:bg-primary-soft hover:text-primary cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              <div className="text-xs bg-primary-soft/60 border border-primary/10 p-2.5 rounded-lg mb-3">
                <div className="font-semibold text-foreground">{userName}</div>
                <div className="text-[11px] font-medium text-gold-dark mt-0.5">{userRoleLabel}</div>
              </div>

              <div className="space-y-4 flex-1">
                {navSections.map((section) => {
                  const visibleItems = section.items.filter((item) => item.visible !== false);
                  if (visibleItems.length === 0) return null;

                  return (
                    <div key={section.label} className="space-y-1">
                      <div className="px-3 pt-2 pb-1 text-[10px] font-bold tracking-wider text-muted-foreground/70 uppercase">
                        {section.label}
                      </div>
                      <nav className="grid gap-1">
                        {visibleItems.map((item) =>
                          renderNavItem(item, () => setIsMobileOpen(false))
                        )}
                      </nav>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="flex-1" onClick={toggleMobileSidebar} />
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
