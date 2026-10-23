import { Navbar } from "./Navbar";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="h-screen w-full flex flex-col overflow-hidden bg-[#F0E8D0] bg-dot-grid text-[#0C0C0C]">
      <Navbar />
      <main className="flex-1 flex flex-col w-full overflow-hidden">
        {children}
      </main>
      <footer className="h-8 bg-[#0A6B52] text-[#FAF6EE] border-t-[3px] border-[#0C0C0C] px-4 flex items-center justify-center gap-4 sm:gap-6 font-mono text-[11px] font-bold uppercase tracking-wider shrink-0 z-20 print:hidden overflow-x-auto whitespace-nowrap">
        <span>&copy; BRANDEX LAW ASSOCIATES</span>
        <span className="opacity-40">|</span>
        <a href="https://brandex.pk" target="_blank" rel="noreferrer" className="text-white hover:underline underline-offset-2">
          BRANDEX.PK
        </a>
        <span className="opacity-40">|</span>
        <span>INFO@BRANDEX.PK &middot; +92 336 0015009</span>
        <span className="opacity-40">|</span>
        <span className="hidden md:inline">ISLAMABAD | KARACHI | LAHORE | MULTAN | RAWALPINDI</span>
      </footer>
    </div>
  );
}
