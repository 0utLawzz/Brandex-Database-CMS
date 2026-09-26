import { Navbar } from "./Navbar";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-[#F8F6F1] flex flex-col">
      <Navbar />
      {/* Main content - full width */}
      <main className="flex-1 flex flex-col w-full h-[calc(100vh-6rem)] overflow-hidden">
        {children}
      </main>
      <footer className="min-h-8 shrink-0 bg-[#6C1C1F] text-[#FFF9F0] px-4 flex items-center justify-center font-mono text-xs uppercase tracking-wider text-center print:hidden">
        <span>BRANDEX LAW ASSOCIATES · WWW.BRANDEX.PK · INFO@BRANDEX.PK · +92 336 0015009 · ISLAMABAD · KARACHI · LAHORE · MULTAN · RAWALPINDI · XI'AN</span>
      </footer>
    </div>
  );
}
