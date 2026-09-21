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
} from "lucide-react";
import { supabase } from "@/lib/supabase";

const NAV_ITEMS = [
  { href: "/",           label: "DASHBOARD",    icon: LayoutDashboard },
  { href: "/search",     label: "SEARCH TM",    icon: Search },
  { href: "/database",   label: "DATABASE",     icon: Database },
  { href: "/assigned",   label: "ASSIGNED",     icon: Users2 },
  { href: "/agents",     label: "AGENTS",       icon: BriefcaseBusiness },
  { href: "/publication", label: "PUBLICATION", icon: BookOpen },
  { href: "/logs",       label: "LOGS",         icon: ScrollText },
];

export function Navbar() {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const queryClient = useQueryClient();

  const handleRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries();
    setTimeout(() => setRefreshing(false), 800);
  };

  const isActive = (href: string) =>
    href === "/" ? location === "/" : location.startsWith(href);

  return (
    <>
      <header className="sticky top-0 z-40 bg-[#0C0C0C] border-b-2 border-[#1A1A1A] text-[#F0E8D0] shadow-md print:hidden">
        <div className="flex items-center justify-between px-4 h-16 w-full">
          {/* Logo & Brand */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0 hover:opacity-90 transition-opacity">
            <img
              src="/brandex-mark.svg"
              alt="Brandex Law Associates Logo"
              className="w-10 h-10 object-contain"
              onError={(e) => {
                // Fallback icon if logo not loaded
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
            <div className="hidden sm:block">
              <div className="font-serif text-base leading-none text-[#F0E8D0] tracking-wider whitespace-nowrap">
                BRANDEX LAW ASSOCIATES
              </div>
              <div className="font-mono text-[8px] text-[#D6A64B] tracking-widest uppercase font-bold mt-0.5">
                Trademark & IP Registry
              </div>
            </div>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex flex-1 justify-center items-center gap-1">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const active = isActive(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-2 px-3 py-2 font-mono font-bold text-[11px] tracking-widest uppercase transition-all border-2 ${
                    active
                      ? "bg-[#6C1C1F] border-[#B0740E] text-white"
                      : "border-transparent text-[#C5B89A] hover:bg-[#1A1A1A] hover:border-[#333] hover:text-[#F0E8D0]"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </Link>
              );
            })}
          </nav>

          {/* Right Actions */}
          <div className="flex items-center justify-end gap-2 w-52 shrink-0">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              title="Refresh data from Supabase"
              className="hidden sm:flex items-center justify-center gap-2 bg-[#B0740E] text-white border-2 border-[#B0740E] px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider hover:brightness-105 active:brightness-95 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "REFRESHING..." : "REFRESH"}
            </button>

            <button
              onClick={() => supabase.auth.signOut()}
              title="Sign out"
              className="hidden sm:flex items-center justify-center border-2 border-[#333] p-2 text-[#C5B89A] hover:text-white hover:border-[#C5B89A]"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>

            <button
              className="lg:hidden p-2 text-[#F0E8D0] hover:text-white"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </header>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 top-16 z-30 bg-[#0C0C0C] border-t-2 border-[#1A1A1A] flex flex-col p-4 print:hidden">
          <nav className="flex-1 space-y-2">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const active = isActive(href);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 font-mono font-bold text-sm tracking-widest uppercase transition-all border-2 ${
                    active
                      ? "bg-[#6C1C1F] border-[#B0740E] text-white"
                      : "border-transparent text-[#C5B89A] hover:bg-[#1A1A1A] hover:border-[#333] hover:text-[#F0E8D0]"
                  }`}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  {label}
                </Link>
              );
            })}
          </nav>
          <button
            onClick={() => { handleRefresh(); setMobileOpen(false); }}
            disabled={refreshing}
            className="mt-auto w-full flex items-center justify-center gap-2 bg-[#B0740E] text-white border-2 border-[#B0740E] px-4 py-3 font-mono text-sm font-bold uppercase tracking-wider disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "REFRESHING..." : "REFRESH DATA"}
          </button>
        </div>
      )}
    </>
  );
}
