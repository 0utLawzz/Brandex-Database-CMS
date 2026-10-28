import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  LayoutDashboard,
  Search,
  Database,
  ScrollText,
  RefreshCw,
  BriefcaseBusiness,
  Menu,
  X,
  Users2,
  LogOut,
  BookOpen,
  CreditCard,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getStaffRole } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { BrandingSettingsModal } from "@/components/BrandingSettingsModal";

const NAV_ITEMS = [
  { href: "/",            label: "DASHBOARD",   icon: LayoutDashboard },
  { href: "/search",      label: "SEARCH TM",   icon: Search },
  { href: "/database",    label: "DATABASE",    icon: Database },
  { href: "/assigned",    label: "ASSIGNED",    icon: Users2 },
  { href: "/agents",      label: "AGENTS",      icon: BriefcaseBusiness },
  { href: "/publication", label: "PUBLICATION", icon: BookOpen },
  { href: "/payments",    label: "PAYMENTS",    icon: CreditCard },
  { href: "/logs",        label: "LOGS",        icon: ScrollText },
];

export function Navbar() {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [brandingModalOpen, setBrandingModalOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: staffRole } = useQuery({
    queryKey: ["staff-role"],
    queryFn: getStaffRole,
    staleTime: 5 * 60_000,
  });
  const isAdmin = staffRole === "admin";

  const handleRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries();
    setTimeout(() => setRefreshing(false), 800);
  };

  const isActive = (href: string) =>
    href === "/" ? location === "/" : location.startsWith(href);

  return (
    <>
      <header className="header-strip sticky top-0 z-40 bg-[#000000] min-h-[60px] border-b-[3px] border-[#000000] text-white flex items-center px-4 sm:px-8 gap-6 sm:gap-8 shrink-0 print:hidden justify-between">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-3 shrink-0 text-white no-underline hover:opacity-95 transition-opacity">
          <div className="w-8 h-8 bg-[#E14E27] border-2 border-white rounded-[2px] flex items-center justify-center font-serif text-xl leading-none text-white shadow-[2px_2px_0_#000000]">
            B
          </div>
          <div className="flex flex-col">
            <h1 className="font-serif text-2xl sm:text-3xl tracking-wider leading-none text-white m-0">
              BRANDEX LAW ASSOCIATES
            </h1>
            <span className="font-mono text-[10px] text-[#D6A200] uppercase tracking-widest font-bold leading-tight mt-0.5">
              STAFF TRADEMARK REGISTRY
            </span>
          </div>
        </Link>

        {/* Desktop Nav */}
        <nav className="header-nav hidden xl:flex flex-1 items-center justify-center gap-2">
          {NAV_ITEMS.map(({ href, label }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                className={`px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider transition-all ${
                  active
                    ? "bg-[#E14E27] text-white border-2 border-white shadow-[2px_2px_0_#000000]"
                    : "text-[#999999] hover:text-white border-b-2 border-transparent hover:border-[#E14E27]"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Header Actions */}
        <div className="flex items-center gap-2.5 ml-auto shrink-0">
          <div className="hidden 2xl:flex items-center gap-1.5 px-2.5 py-1 bg-[#111111] border border-white/20 text-[#D6A200] font-mono text-[11px] font-bold tracking-wider">
            <span className="w-2 h-2 rounded-full bg-[#008169] animate-pulse shrink-0" />
            <span>ACTIVE REGISTRY</span>
          </div>

          {isAdmin && (
            <button
              onClick={() => setBrandingModalOpen(true)}
              className="hidden sm:inline-flex items-center gap-1.5 bg-[#D6A200] border-2 border-white text-black font-mono font-bold text-xs uppercase px-3 py-1.5 cursor-pointer shadow-[2px_2px_0_#000000] hover:brightness-105 active:translate-x-0.5 active:translate-y-0.5 transition-all"
            >
              <Sparkles className="w-3.5 h-3.5 text-black" />
              BRANDING
            </button>
          )}

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="hidden sm:inline-flex items-center gap-1.5 bg-[#E14E27] border-2 border-white text-white font-mono font-bold text-xs uppercase px-3 py-1.5 cursor-pointer shadow-[2px_2px_0_#000000] hover:brightness-110 active:translate-x-0.5 active:translate-y-0.5 transition-all disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "REFRESHING…" : "REFRESH DATA"}
          </button>

          <button
            onClick={() => supabase.auth.signOut()}
            title="Sign out"
            className="hidden sm:inline-flex items-center justify-center border-2 border-white/40 p-1.5 text-white/80 hover:text-white hover:border-white transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>

          <button
            className="xl:hidden p-2 text-white hover:text-white"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </header>

      {/* Admin Branding Modal */}
      <BrandingSettingsModal
        isOpen={brandingModalOpen}
        onClose={() => setBrandingModalOpen(false)}
      />

      {mobileOpen && (
        <div className="xl:hidden fixed inset-0 top-16 z-50 bg-[#000000] border-t-[3px] border-[#000000] flex flex-col p-4 print:hidden">
          <nav className="flex-1 space-y-2">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const active = isActive(href);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 font-mono font-bold text-sm tracking-wider uppercase transition-all ${
                    active
                      ? "bg-[#E14E27] text-white border-2 border-white shadow-[3px_3px_0_#000000]"
                      : "text-[#999999] hover:text-white border-2 border-transparent hover:border-[#E14E27]"
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {label}
                </Link>
              );
            })}
          </nav>

          <div className="pt-4 border-t border-white/20 flex flex-col gap-2">
            {isAdmin && (
              <button
                onClick={() => { setBrandingModalOpen(true); setMobileOpen(false); }}
                className="w-full bg-[#D6A200] border-2 border-white text-black font-mono font-bold text-xs uppercase py-2.5 flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                BRANDING SETTINGS
              </button>
            )}
            <button
              onClick={() => { handleRefresh(); setMobileOpen(false); }}
              disabled={refreshing}
              className="w-full bg-[#E14E27] border-2 border-white text-white font-mono font-bold text-xs uppercase py-2.5 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "REFRESHING…" : "REFRESH DATA"}
            </button>
            <button
              onClick={() => supabase.auth.signOut()}
              className="w-full border-2 border-white/30 text-white font-mono font-bold text-xs uppercase py-2 flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              SIGN OUT
            </button>
          </div>
        </div>
      )}
    </>
  );
}
