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
        <section className="max-w-xl border-2 border-[#0C0C0C] bg-white p-8 shadow-[8px_8px_0_#0C0C0C]">
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
        <form onSubmit={signIn} className="w-full max-w-md border-2 border-[#0C0C0C] bg-white p-8 shadow-[8px_8px_0_#0C0C0C]">
          <img src="/brandex-wordmark.svg" alt="Brandex Law Associates" className="h-24 w-full object-contain object-left mb-5" />
          <h1 className="font-serif text-3xl tracking-wider text-[#0C0C0C]">STAFF SIGN IN</h1>
          <p className="font-mono text-xs text-[#6d6658] mt-1 mb-6">BRANDEX SECURE DATASHEET</p>
          <label className="block font-mono text-[10px] font-bold tracking-widest mb-1">EMAIL</label>
          <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="w-full h-11 border-2 border-[#0C0C0C] px-3 font-mono mb-4" />
          <label className="block font-mono text-[10px] font-bold tracking-widest mb-1">PASSWORD</label>
          <input type="password" required value={password} onChange={(event) => setPassword(event.target.value)} className="w-full h-11 border-2 border-[#0C0C0C] px-3 font-mono" />
          {error && <p className="mt-3 font-mono text-xs font-bold text-[#CC0000]">{error}</p>}
          <button disabled={submitting} className="w-full mt-6 h-11 bg-[#6C1C1F] text-white border-2 border-[#6C1C1F] font-mono font-bold tracking-widest disabled:opacity-50">
            {submitting ? "SIGNING IN…" : "SIGN IN"}
          </button>
        </form>
      </main>
    );
  }

  return <>{children}</>;
}
