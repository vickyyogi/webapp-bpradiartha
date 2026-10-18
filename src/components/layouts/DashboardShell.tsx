"use client";

import { useState, useSyncExternalStore } from "react";
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
  LifeBuoy,
} from "lucide-react";
import type { NavSectionConfig } from "@/lib/navigation";
import { Button } from "@/components/ui/button";
import { LogoutButton } from "@/app/(dashboard)/LogoutButton";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { ThemeToggle } from "@/components/public/ThemeToggle";

const NAV_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  dashboard: LayoutDashboard,
  crm: Users,
  credit: CreditCard,
  field: MapPin,
  documents: FileText,
  inventory: Package,
  purchasing: ShoppingBag,
  reports: BarChart3,
  audit: ShieldCheck,
  admin: Settings,
};

interface Props {
  userName: string;
  userRoleLabel: string;
  /** Navigasi yang sudah disaring server sesuai permission + cakupan pengguna. */
  navSections: NavSectionConfig[];
  children: React.ReactNode;
}

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

// Preferensi sidebar dibaca dari localStorage lewat useSyncExternalStore:
// aman untuk hidrasi server dan tidak memerlukan efek sinkronisasi.
const subscribeNoop = () => () => {};
const getSidebarPref = () => localStorage.getItem("bpr_sidebar_open");
const getSidebarPrefServer = () => null;

export function DashboardShell({
  userName,
  userRoleLabel,
  navSections,
  children,
}: Props) {
  const pathname = usePathname();
  const savedSidebarPref = useSyncExternalStore(subscribeNoop, getSidebarPref, getSidebarPrefServer);
  const [sidebarOverride, setSidebarOverride] = useState<boolean | null>(null);
  // Prefer tersimpan: "false" = tertutup; selain itu (termasuk belum ada) = terbuka.
  const isOpen = sidebarOverride ?? savedSidebarPref !== "false";
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const toggleSidebar = () => {
    const nextState = !isOpen;
    setSidebarOverride(nextState);
    localStorage.setItem("bpr_sidebar_open", String(nextState));
  };

  const toggleMobileSidebar = () => {
    setIsMobileOpen((prev) => !prev);
  };

  // State dropdown: hanya override dari pengguna; default terbuka saat modulnya aktif.
  const [dropdownOverrides, setDropdownOverrides] = useState<Record<string, boolean>>({});

  const isDropdownOpenFor = (item: NavSectionConfig["items"][number]) =>
    dropdownOverrides[item.key] ?? isModuleActive(item.basePath || "/");

  const toggleDropdown = (key: string, currentlyOpen: boolean) => {
    setDropdownOverrides((prev) => ({
      ...prev,
      [key]: !currentlyOpen,
    }));
  };

  const isExactActive = (path: string) => pathname === path;
  const isModuleActive = (basePath: string) => pathname.startsWith(basePath);

  // Helper renderer for nav item
  const renderNavItem = (item: NavSectionConfig["items"][number], onNavigate?: () => void) => {
    const Icon = NAV_ICONS[item.icon] ?? CircleDot;

    if (item.type === "link") {
      const href = item.href || "/";
      const active = isExactActive(href);
      return (
        <Link
          key={item.key}
          href={href}
          onClick={onNavigate}
          className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium transition-colors group ${
            active
              ? "bg-lp-accent text-lp-on-accent font-semibold shadow-[0_10px_22px_-12px_var(--lp-glow-lime)]"
              : "text-lp-muted hover:bg-lp-brand-soft hover:text-lp-brand"
          }`}
        >
          <Icon
            className={`h-4 w-4 shrink-0 transition-colors ${
              active ? "text-lp-on-accent" : "text-lp-muted/80 group-hover:text-lp-brand"
            }`}
          />
          <span className="truncate">{item.title}</span>
        </Link>
      );
    }

    const basePath = item.basePath || "/";
    const isParentActive = isModuleActive(basePath);
    const isDropdownOpen = isDropdownOpenFor(item);
    const children = item.children ?? [];

    if (children.length === 0) return null;

    return (
      <div key={item.key} className="space-y-1">
        <button
          type="button"
          onClick={() => toggleDropdown(item.key, isDropdownOpen)}
          className={`w-full flex items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition-colors cursor-pointer select-none group ${
            isParentActive
              ? "bg-lp-accent text-lp-on-accent font-semibold shadow-[0_10px_22px_-12px_var(--lp-glow-lime)]"
              : "text-lp-muted hover:bg-lp-brand-soft hover:text-lp-brand"
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <Icon
              className={`h-4 w-4 shrink-0 transition-colors ${
                isParentActive ? "text-lp-on-accent" : "text-lp-muted/80 group-hover:text-lp-brand"
              }`}
            />
            <span className="truncate">{item.title}</span>
          </div>
          <ChevronDown
            className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${
              isDropdownOpen
                ? `rotate-180 ${isParentActive ? "text-lp-on-accent" : "text-lp-brand"}`
                : isParentActive
                  ? "text-lp-on-accent"
                  : "text-lp-muted/80 group-hover:text-lp-brand"
            }`}
          />
        </button>

        {isDropdownOpen && (
          <div className="relative pl-3 ml-3 my-1 space-y-0.5 border-l-2 border-lp-border animate-in fade-in slide-in-from-top-1 duration-150">
            {children.map((child) => {
              const isChildActive = pathname === child.href;
              return (
                <Link
                  key={child.key}
                  href={child.href}
                  onClick={onNavigate}
                  className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
                    isChildActive
                      ? "bg-lp-brand-soft text-lp-brand font-semibold"
                      : "text-lp-muted hover:text-lp-brand hover:bg-lp-brand-soft/50"
                  }`}
                >
                  <CircleDot
                    className={`h-1.5 w-1.5 shrink-0 ${
                      isChildActive ? "text-lp-accent" : "text-lp-muted/40"
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
  };

  const brandMark = (
    <div className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-lp-brand text-lp-on-brand text-sm font-black shadow-[0_10px_22px_-12px_var(--lp-glow-violet)]">
        A
      </div>
      <div className="flex flex-col">
        <span className="text-base font-bold leading-tight text-lp-text">BPR Adiartha</span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-lp-muted">
          Sistem Operasional
        </span>
      </div>
    </div>
  );

  const helpCard = (
    <div className="m-3 rounded-2xl border border-lp-border bg-lp-card-2 p-4">
      <div className="flex items-center gap-2">
        <span className="lp-circle lp-circle-dark h-8 w-8">
          <LifeBuoy className="h-4 w-4" />
        </span>
        <p className="text-xs font-semibold text-lp-text">Butuh bantuan?</p>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-lp-muted">
        Jangan ragu menghubungi tim TI untuk dukungan operasional Anda.
      </p>
      <a
        href="mailto:support@bpradiartha.com"
        className="lp-btn lp-btn-accent mt-3 w-full py-2 text-xs"
      >
        Hubungi Support
      </a>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-lp-bg text-lp-text">
      {/* Desktop Sidebar — panel kartu ala referensi */}
      <aside
        className={`hidden md:flex shrink-0 flex-col border-r border-lp-border bg-lp-card transition-all duration-300 ease-in-out select-none ${
          isOpen ? "w-64" : "w-0 overflow-hidden border-r-0"
        }`}
      >
        <div className="flex h-full w-64 flex-col">
          <Link href="/dashboard" className="px-5 py-5">
            {brandMark}
          </Link>

          <div className="flex-1 overflow-y-auto px-3 space-y-4">
            {navSections.map((section) => (
              <div key={section.label} className="space-y-1">
                <div className="px-3 pt-2 pb-1 text-[10px] font-bold tracking-[0.12em] text-lp-muted/70 uppercase">
                  {section.label}
                </div>
                <nav className="grid gap-1">
                  {section.items.map((item) => renderNavItem(item))}
                </nav>
              </div>
            ))}
          </div>

          {helpCard}
        </div>
      </aside>

      {/* Mobile Drawer Overlay */}
      {isMobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="flex h-full w-72 flex-col bg-lp-card border-r border-lp-border shadow-xl">
            <div className="flex items-center justify-between px-4 py-4">
              <Link href="/dashboard" onClick={() => setIsMobileOpen(false)}>
                {brandMark}
              </Link>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleMobileSidebar}
                className="text-lp-muted hover:text-lp-brand hover:bg-lp-brand-soft cursor-pointer"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="mx-3 mb-3 flex items-center gap-2.5 rounded-2xl border border-lp-border bg-lp-card-2 p-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-lp-brand text-lp-on-brand text-xs font-bold">
                {initialsOf(userName)}
              </span>
              <div className="min-w-0">
                <div className="truncate text-xs font-semibold text-lp-text">{userName}</div>
                <div className="truncate text-[11px] text-lp-muted">{userRoleLabel}</div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-3 space-y-4">
              {navSections.map((section) => (
                <div key={section.label} className="space-y-1">
                  <div className="px-3 pt-2 pb-1 text-[10px] font-bold tracking-[0.12em] text-lp-muted/70 uppercase">
                    {section.label}
                  </div>
                  <nav className="grid gap-1">
                    {section.items.map((item) =>
                      renderNavItem(item, () => setIsMobileOpen(false))
                    )}
                  </nav>
                </div>
              ))}
            </div>
          </div>
          <div className="flex-1 bg-lp-band/40 backdrop-blur-sm" onClick={toggleMobileSidebar} />
        </div>
      )}

      {/* Content Column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-lp-border bg-lp-bg/90 px-4 backdrop-blur-md md:px-6">
          {/* Toggle Button for Desktop */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            title={isOpen ? "Tutup Sidebar Menu" : "Buka Sidebar Menu"}
            className="hidden md:flex text-lp-muted hover:text-lp-brand hover:bg-lp-brand-soft cursor-pointer"
          >
            {isOpen ? <PanelLeftClose className="h-5 w-5" /> : <PanelLeftOpen className="h-5 w-5" />}
          </Button>

          {/* Toggle Button for Mobile */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleMobileSidebar}
            className="md:hidden text-lp-muted hover:text-lp-brand hover:bg-lp-brand-soft cursor-pointer"
          >
            <Menu className="h-5 w-5" />
          </Button>

          {/* Logo (mobile) */}
          <Link href="/dashboard" className="md:hidden">
            {brandMark}
          </Link>

          {/* Header Right Actions */}
          <div className="ml-auto flex items-center gap-1.5 md:gap-2">
            <ThemeToggle />
            <NotificationBell />
            <Link
              href="/account/password"
              title="Keamanan akun: ganti kata sandi & keluar dari semua perangkat"
              className="hidden sm:flex items-center gap-2.5 rounded-full border border-lp-border bg-lp-card px-2.5 py-1.5 transition-colors hover:border-lp-brand/40"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-lp-brand text-lp-on-brand text-xs font-bold">
                {initialsOf(userName)}
              </span>
              <span className="flex flex-col items-start">
                <span className="max-w-[160px] truncate text-xs font-semibold leading-tight text-lp-text">
                  {userName}
                </span>
                <span className="max-w-[160px] truncate text-[10px] font-medium text-lp-muted">
                  {userRoleLabel}
                </span>
              </span>
            </Link>
            <LogoutButton />
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
