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
      <footer className="shrink-0 bg-[#6C1C1F] text-[#FFF9F0] px-4 py-2 font-mono text-xs uppercase tracking-normal print:hidden">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-4 gap-y-1 text-center">
          <span>BRANDEX LAW ASSOCIATES</span>
          <a href="https://brandex.pk" target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-white">BRANDEX.PK</a>
          <a href="https://facebook.com/brandex.pk" target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-white">FACEBOOK.COM/BRANDEX.PK</a>
          <span>INFO@BRANDEX.PK · +92 336 0015009 · ISLAMABAD · KARACHI · LAHORE · MULTAN · RAWALPINDI · XI'AN</span>
        </div>
      </footer>
    </div>
  );
}
