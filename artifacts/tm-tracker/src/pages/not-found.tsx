import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#F0E8D0] text-[#0C0C0C]">
      <h1 className="text-8xl font-serif mb-4">404</h1>
      <p className="text-xl font-mono mb-8">Page not found</p>
      <Link href="/" className="bg-[#6C1C1F] text-[#F0E8D0] px-6 py-3 font-mono font-bold uppercase tracking-widest nb-border nb-shadow nb-button">
        Return to Dashboard
      </Link>
    </div>
  );
}
