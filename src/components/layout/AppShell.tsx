import { Navbar } from "./Navbar";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="h-screen w-full flex flex-col overflow-hidden bg-[#FFFDF0] text-[#000000] font-sans antialiased">
      <Navbar />
      <main className="flex-1 flex flex-col w-full overflow-hidden">
        {children}
      </main>
      <footer className="status-footer min-h-[48px] h-12 sm:h-14 bg-[#000000] text-white border-t-[3px] border-[#000000] px-4 sm:px-8 flex items-center justify-between gap-4 font-mono text-[11px] font-bold uppercase tracking-wider shrink-0 z-20 print:hidden overflow-x-auto whitespace-nowrap">
        <div className="flex items-center gap-2 text-white/90">
          <span className="w-2.5 h-2.5 rounded-full bg-[#008169] shadow-[0_0_8px_#008169] inline-block shrink-0" />
          <span>LIVE CONNECTED: ISLAMABAD | KARACHI | LAHORE | RAWALPINDI | MULTAN</span>
        </div>
        <div className="hidden md:flex items-center gap-2 text-[#D6A200]">
          <span>BRANDEX.PK REGISTRY SYSTEM V2.04</span>
          <span className="text-white/30">&middot;</span>
          <a
            href="https://brandex.pk"
            target="_blank"
            rel="noreferrer"
            className="text-white hover:underline underline-offset-2"
          >
            BRANDEX.PK
          </a>
        </div>
        <div className="text-white/70">
          &copy; {new Date().getFullYear()} BRANDEX LAW ASSOCIATES &middot; ALL RIGHTS RESERVED
        </div>
      </footer>
    </div>
  );
}
