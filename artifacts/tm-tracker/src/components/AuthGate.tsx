import type { Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  if (!isSupabaseConfigured) {
    return (
      <main className="min-h-screen bg-[#F0E8D0] grid place-items-center p-6">
        <section className="max-w-xl rounded-[6px] border-[3px] border-[#0C0C0C] bg-[#FAF6EE] p-6 shadow-[5px_5px_0_#0C0C0C] sm:p-8">
          <h1 className="font-serif text-3xl text-[#0C0C0C]">SUPABASE SETUP REQUIRED</h1>
          <p className="mt-3 font-mono text-sm text-[#6d6658]">
            Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to the environment, then restart the app.
          </p>
        </section>
      </main>
    );
  }

  if (loading) {
    return <main className="min-h-screen bg-[#F0E8D0] grid place-items-center font-mono font-bold">LOADING SECURE WORKSPACE…</main>;
  }

  if (!session) {
    const signIn = async (event: React.FormEvent) => {
      event.preventDefault();
      setSubmitting(true);
      setError("");
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) setError(signInError.message);
      setSubmitting(false);
    };

    return (
        <main className="min-h-screen bg-[#F0E8D0] grid place-items-center p-6">
        <form onSubmit={signIn} className="w-full max-w-md rounded-[6px] border-[3px] border-[#0C0C0C] bg-[#FAF6EE] p-6 shadow-[5px_5px_0_#0C0C0C] sm:p-8">
          <img src="/branding/brandex-logo-14.png" alt="Brandex Law Associates" className="mx-auto mb-5 h-40 w-40 object-contain sm:h-48 sm:w-48" />
          <h1 className="font-serif text-3xl tracking-wider text-[#0C0C0C]">STAFF SIGN IN</h1>
          <p className="font-mono text-xs text-[#6d6658] mt-1 mb-6">BRANDEX SECURE DATASHEET</p>
          <label className="mb-1 block font-mono text-xs font-medium tracking-widest">EMAIL</label>
          <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="mb-4 h-11 w-full border-2 border-[#0C0C0C] bg-[#FAF6EE] px-3 font-sans text-base focus:border-[#C94A00] focus:outline-2 focus:outline-[#C94A00] focus:outline-offset-1" />
          <label className="mb-1 block font-mono text-xs font-medium tracking-widest">PASSWORD</label>
          <input type="password" required value={password} onChange={(event) => setPassword(event.target.value)} className="h-11 w-full border-2 border-[#0C0C0C] bg-[#FAF6EE] px-3 font-sans text-base focus:border-[#C94A00] focus:outline-2 focus:outline-[#C94A00] focus:outline-offset-1" />
          {error && <p className="mt-3 font-mono text-xs font-bold text-[#CC0000]">{error}</p>}
          <button disabled={submitting} className="nb-button mt-6 h-11 w-full rounded-[6px] border-[3px] border-[#0C0C0C] bg-[#C94A00] font-mono font-medium uppercase tracking-widest text-white shadow-[3px_3px_0_#0C0C0C] transition-all disabled:opacity-50">
            {submitting ? "SIGNING IN…" : "SIGN IN"}
          </button>
        </form>
      </main>
    );
  }

  return <>{children}</>;
}
