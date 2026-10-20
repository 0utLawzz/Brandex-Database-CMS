import type { Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "request" | "update">(() =>
    /(?:[?#&])type=recovery(?:&|$)/.test(window.location.href) ? "update" : "signin",
  );
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
      if (event === "PASSWORD_RECOVERY") setMode("update");
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

  if (mode === "update") {
    const updatePassword = async (event: React.FormEvent) => {
      event.preventDefault();
      setError("");
      if (password.length < 8) return setError("Use at least 8 characters for the new password.");
      if (password !== confirmPassword) return setError("Passwords do not match.");
      setSubmitting(true);
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) setError(updateError.message);
      else {
        await supabase.auth.signOut();
        setPassword("");
        setConfirmPassword("");
        setMode("signin");
        setMessage("Password updated. Sign in with your new password.");
        window.history.replaceState({}, "", window.location.pathname);
      }
      setSubmitting(false);
    };
    return (
      <main className="min-h-screen bg-[#F0E8D0] grid place-items-center p-6">
        <form onSubmit={updatePassword} className="w-full max-w-md rounded-[6px] border-[3px] border-[#0C0C0C] bg-[#FAF6EE] p-6 shadow-[5px_5px_0_#0C0C0C] sm:p-8">
          <h1 className="font-serif text-3xl tracking-wider">SET NEW PASSWORD</h1>
          <p className="mt-2 mb-5 font-mono text-sm text-[#6d6658]">{session ? "Enter a new password for this staff account." : "This recovery link is invalid or expired. Request a fresh link."}</p>
          {session && <>
            <label htmlFor="new-password" className="mb-1 block font-mono text-xs font-medium tracking-widest">NEW PASSWORD</label>
            <input id="new-password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} className="mb-4 h-11 w-full border-2 border-[#0C0C0C] bg-[#FAF6EE] px-3" />
            <label htmlFor="confirm-password" className="mb-1 block font-mono text-xs font-medium tracking-widest">CONFIRM PASSWORD</label>
            <input id="confirm-password" type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="h-11 w-full border-2 border-[#0C0C0C] bg-[#FAF6EE] px-3" />
          </>}
          {error && <p role="alert" className="mt-3 font-mono text-xs font-bold text-[#CC0000]">{error}</p>}
          {session && <button disabled={submitting} className="nb-button mt-6 h-11 w-full bg-[#C94A00] text-white disabled:opacity-50">{submitting ? "SAVING…" : "SAVE PASSWORD"}</button>}
          <button type="button" onClick={() => { setMode("request"); setError(""); }} className="mt-5 block font-mono text-sm underline">Request a new link</button>
        </form>
      </main>
    );
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
    const requestReset = async (event: React.FormEvent) => {
      event.preventDefault();
      setSubmitting(true);
      setError("");
      setMessage("");
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/`,
      });
      if (resetError) setError(resetError.message);
      else setMessage("If this email belongs to a staff account, a reset link has been sent. Check Inbox and Spam.");
      setSubmitting(false);
    };

    return (
        <main className="min-h-screen bg-[#F0E8D0] grid place-items-center p-6">
        <form onSubmit={mode === "request" ? requestReset : signIn} className="w-full max-w-md rounded-[6px] border-[3px] border-[#0C0C0C] bg-[#FAF6EE] p-6 shadow-[5px_5px_0_#0C0C0C] sm:p-8">
          <img src="/branding/brandex-logo-14.png" alt="Brandex Law Associates" className="mx-auto mb-5 h-40 w-40 object-contain sm:h-48 sm:w-48" />
          <h1 className="font-serif text-3xl tracking-wider text-[#0C0C0C]">{mode === "request" ? "RESET PASSWORD" : "STAFF SIGN IN"}</h1>
          <p className="font-mono text-xs text-[#6d6658] mt-1 mb-6">{mode === "request" ? "WE WILL EMAIL A SECURE RESET LINK" : "BRANDEX SECURE DATASHEET"}</p>
          <label className="mb-1 block font-mono text-xs font-medium tracking-widest">EMAIL</label>
          <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="mb-4 h-11 w-full border-2 border-[#0C0C0C] bg-[#FAF6EE] px-3 font-sans text-base focus:border-[#C94A00] focus:outline-2 focus:outline-[#C94A00] focus:outline-offset-1" />
          {mode === "signin" && <>
            <label className="mb-1 block font-mono text-xs font-medium tracking-widest">PASSWORD</label>
            <input type="password" required value={password} onChange={(event) => setPassword(event.target.value)} className="h-11 w-full border-2 border-[#0C0C0C] bg-[#FAF6EE] px-3 font-sans text-base focus:border-[#C94A00] focus:outline-2 focus:outline-[#C94A00] focus:outline-offset-1" />
          </>}
          {error && <p className="mt-3 font-mono text-xs font-bold text-[#CC0000]">{error}</p>}
          {message && <p role="status" className="mt-3 font-mono text-xs font-bold text-[#0A6B52]">{message}</p>}
          <button disabled={submitting} className="nb-button mt-6 h-11 w-full rounded-[6px] border-[3px] border-[#0C0C0C] bg-[#C94A00] font-mono font-medium uppercase tracking-widest text-white shadow-[3px_3px_0_#0C0C0C] transition-all disabled:opacity-50">
            {submitting ? "PLEASE WAIT…" : mode === "request" ? "SEND RESET LINK" : "SIGN IN"}
          </button>
          <button type="button" onClick={() => { setMode(mode === "request" ? "signin" : "request"); setError(""); setMessage(""); }} className="mt-5 block font-mono text-sm underline">{mode === "request" ? "Back to sign in" : "Forgot password?"}</button>
        </form>
      </main>
    );
  }

  return <>{children}</>;
}
