import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { supabase } from "@/lib/supabase";
import { Search, RefreshCw, Printer, ReceiptText, Users, Wallet, AlertCircle } from "lucide-react";

type Client = {
  id: string; client_code: string; client_name: string | null; city: string | null;
  header_balance: number | string; is_active: boolean; series_id: string | null;
};
type LedgerCase = {
  id: string; client_id: string; tm_no: string | null; folder_no: string | null;
  case_ref: string | null; application_name: string | null; status: string;
  reconciliation_status: string; cms_trademark_id: string | null;
};
type LedgerEntry = {
  id: string; client_id: string; case_id: string | null; entry_date: string;
  entry_type: "charge" | "receiving"; stage: string | null; details: string | null;
  amount_due: number | string | null; amount_received: number | string | null;
  running_balance: number | string | null; payment_method: string | null;
  bank_name: string | null; cheque_no: string | null; receipt_no: string | null;
  notes: string | null; voided_at: string | null; void_reason: string | null;
};

const STAGES = [
  { value: "S1", label: "Stage 1 — Filing and Acknowledgement" },
  { value: "S2", label: "Stage 2 — Assignment and Outcome" },
  { value: "S3", label: "Stage 3 — Publication and Demand Note" },
  { value: "S4", label: "Stage 4 — Certificate (CER) Processing" },
] as const;
const money = (value: unknown) => new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", maximumFractionDigits: 2 }).format(Number(value || 0));
const shortDate = (value: string) => value ? new Date(value + (value.length === 10 ? "T00:00:00" : "")).toLocaleDateString("en-GB") : "—";

async function loadEntries(clientId: string): Promise<LedgerEntry[]> {
  const rows: LedgerEntry[] = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase.from("ledger_entries").select("*")
      .eq("client_id", clientId).order("entry_date", { ascending: false })
      .order("created_at", { ascending: false }).range(offset, offset + pageSize - 1);
    if (error) throw new Error("Could not load client ledger: " + error.message);
    const batch = (data ?? []) as LedgerEntry[];
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }
  return rows;
}

export function PaymentsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedEntryIds, setSelectedEntryIds] = useState<string[]>([]);
  const [showReceiptForm, setShowReceiptForm] = useState(false);
  const [caseId, setCaseId] = useState("");
  const [stage, setStage] = useState<string>("S1");
  const [amount, setAmount] = useState("");
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState("bank_transfer");
  const [details, setDetails] = useState("");
  const [notes, setNotes] = useState("");
  const [receiptError, setReceiptError] = useState("");

  const clientsQuery = useQuery({
    queryKey: ["client-ledger-clients"],
    queryFn: async () => {
      const rows: Client[] = [];
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await supabase.from("ledger_clients").select("*")
          .order("client_name", { ascending: true }).range(offset, offset + 999);
        if (error) throw new Error("Could not load ledger clients: " + error.message);
        const batch = (data ?? []) as Client[];
        rows.push(...batch);
        if (batch.length < 1000) break;
      }
      return rows;
    },
  });
  const clients = clientsQuery.data ?? [];
  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clients.filter((c) => !q || [c.client_name, c.client_code, c.city].some(v => String(v ?? "").toLowerCase().includes(q)));
  }, [clients, search]);
  const activeClient = clients.find(c => c.id === selectedClientId) ?? null;

  const casesQuery = useQuery({
    queryKey: ["client-ledger-cases", selectedClientId],
    enabled: Boolean(selectedClientId),
    queryFn: async () => {
      const rows: LedgerCase[] = [];
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await supabase.from("ledger_cases").select("*")
          .eq("client_id", selectedClientId).order("created_at", { ascending: false })
          .range(offset, offset + 999);
        if (error) throw new Error("Could not load client cases: " + error.message);
        const batch = (data ?? []) as LedgerCase[];
        rows.push(...batch);
        if (batch.length < 1000) break;
      }
      return rows;
    },
  });
  const entriesQuery = useQuery({
    queryKey: ["client-ledger-entries", selectedClientId],
    enabled: Boolean(selectedClientId),
    queryFn: () => loadEntries(selectedClientId),
  });
  const cases = casesQuery.data ?? [];
  const entries = entriesQuery.data ?? [];
  const activeEntries = entries.filter(e => !e.voided_at);
  const totalCharges = activeEntries.filter(e => e.entry_type === "charge").reduce((n,e) => n + Number(e.amount_due || 0), 0);
  const totalReceived = activeEntries.filter(e => e.entry_type === "receiving").reduce((n,e) => n + Number(e.amount_received || 0), 0);
  const balance = totalCharges - totalReceived;

  const receiptMutation = useMutation({
    mutationFn: async () => {
      const num = Number(amount);
      if (!activeClient) throw new Error("Select a client first.");
      if (!Number.isFinite(num) || num <= 0) throw new Error("Enter a receipt amount greater than zero.");
      const chosenCase = cases.find(c => c.id === caseId);
      if (caseId && !chosenCase) throw new Error("The selected case does not belong to this client.");
      const { data, error } = await supabase.rpc("record_ledger_receiving", {
        p_client_id: activeClient.id,
        p_case_id: caseId || null,
        p_entry_date: entryDate,
        p_stage: stage || null,
        p_amount: num,
        p_payment_method: method,
        p_details: details.trim() || null,
        p_notes: notes.trim() || null,
        p_linked_entry_id: null,
        p_request_id: crypto.randomUUID(),
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: async () => {
      setReceiptError("");
      setAmount(""); setDetails(""); setNotes(""); setShowReceiptForm(false);
      await queryClient.invalidateQueries({ queryKey: ["client-ledger-entries", selectedClientId] });
      await queryClient.invalidateQueries({ queryKey: ["client-ledger-clients"] });
    },
    onError: (error: Error) => setReceiptError(error.message),
  });

  const printLedger = () => {
    setTimeout(() => window.print(), 50);
  };
  const toggleEntry = (id: string) => setSelectedEntryIds(old => old.includes(id) ? old.filter(x => x !== id) : [...old, id]);
  // Full Ledger preserves voided rows for audit visibility; totals exclude them.
  const printableEntries = selectedEntryIds.length ? entries.filter(e => selectedEntryIds.includes(e.id)) : entries;

  return (
    <AppShell>
      <div className="min-h-full flex-1 overflow-auto bg-[#F0E8D0] text-[#0C0C0C]">
        <style>{`@media print { body * { visibility: hidden !important; } #client-ledger-print, #client-ledger-print * { visibility: visible !important; } #client-ledger-print { position: absolute; left: 0; top: 0; width: 100%; padding: 16px; background: white !important; color: black !important; } .no-print { display: none !important; } }`}</style>
        <div className="mx-auto max-w-[1600px] space-y-5 p-4 md:p-8">
          <header className="flex flex-col gap-4 border-b-[3px] border-[#0C0C0C] pb-5 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-widest text-[#0A6B52]"><Wallet className="h-4 w-4" /> Unified Client Ledger</div>
              <h1 className="font-serif text-4xl font-bold uppercase leading-none sm:text-5xl">Client Accounts & Ledger</h1>
              <p className="mt-3 max-w-3xl text-sm text-stone-700">Client-wide charges, receipts and balances from the consolidated Ledger tables. CMS trademark records are shown only when an explicit link exists; unlinked Ledger cases remain visible here.</p>
            </div>
            <div className="no-print flex flex-wrap gap-2">
              <button onClick={() => { void clientsQuery.refetch(); if (selectedClientId) { void casesQuery.refetch(); void entriesQuery.refetch(); } }} className="inline-flex h-10 items-center gap-2 border-2 border-black bg-white px-3 font-mono text-xs font-bold uppercase shadow-[2px_2px_0_#0C0C0C]"><RefreshCw className="h-4 w-4" /> Refresh</button>
              <button onClick={printLedger} disabled={!activeClient} className="inline-flex h-10 items-center gap-2 border-2 border-black bg-[#0A6B52] px-3 font-mono text-xs font-bold uppercase text-white shadow-[2px_2px_0_#0C0C0C] disabled:opacity-40"><Printer className="h-4 w-4" /> {selectedEntryIds.length ? "Print Selected" : "Print Full Ledger"}</button>
            </div>
          </header>

          {(clientsQuery.isError || casesQuery.isError || entriesQuery.isError) && <div className="border-2 border-red-700 bg-red-50 p-3 text-sm font-bold text-red-800"><AlertCircle className="mr-2 inline h-4 w-4" />{String(clientsQuery.error?.message || casesQuery.error?.message || entriesQuery.error?.message || "Ledger query failed")}</div>}

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
            <aside className="no-print border-2 border-black bg-[#FAF6EE] shadow-[4px_4px_0_#0C0C0C]">
              <div className="border-b-2 border-black bg-[#0C0C0C] p-4 text-white">
                <div className="flex items-center gap-2 font-mono text-sm font-bold uppercase"><Users className="h-4 w-4" /> Client Accounts ({filteredClients.length})</div>
                <label className="mt-3 flex items-center gap-2 border-2 border-stone-400 bg-white px-2 text-black"><Search className="h-4 w-4" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or client code" className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none" /></label>
              </div>
              <div className="max-h-[65vh] overflow-auto">
                {clientsQuery.isLoading ? <p className="p-4 text-sm">Loading clients…</p> : filteredClients.map(client => <button key={client.id} onClick={() => { setSelectedClientId(client.id); setSelectedEntryIds([]); setCaseId(""); }} className={`block w-full border-b border-stone-300 p-3 text-left hover:bg-[#E8DFC7] ${selectedClientId === client.id ? "bg-[#D7E9E0] border-l-4 border-l-[#0A6B52]" : ""}`}>
                  <span className="block font-bold uppercase">{client.client_name || "Unnamed client"}</span><span className="mt-1 block font-mono text-xs text-stone-600">{client.client_code}{client.city ? " · " + client.city : ""}</span>
                </button>)}
                {!clientsQuery.isLoading && !filteredClients.length && <p className="p-4 text-sm text-stone-600">No client accounts match this search.</p>}
              </div>
            </aside>

            <section className="min-w-0 space-y-5">
              {!activeClient ? <div className="border-2 border-black bg-[#FAF6EE] p-10 text-center shadow-[4px_4px_0_#0C0C0C]"><Users className="mx-auto mb-3 h-8 w-8" /><h2 className="text-xl font-bold uppercase">Select a Client Account</h2><p className="mt-2 text-sm text-stone-600">Choose a client from the left to see all of their cases and ledger transactions.</p></div> : <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="border-2 border-black bg-[#FAF6EE] p-4 shadow-[3px_3px_0_#0C0C0C]"><div className="font-mono text-xs font-bold uppercase text-stone-600">Client / Code</div><div className="mt-2 text-lg font-bold uppercase">{activeClient.client_name || "Unnamed client"}</div><div className="font-mono text-xs">{activeClient.client_code}</div></div>
                  <div className="border-2 border-black bg-[#FAF6EE] p-4 shadow-[3px_3px_0_#0C0C0C]"><div className="font-mono text-xs font-bold uppercase text-stone-600">Total Charges</div><div className="mt-2 text-2xl font-bold">{money(totalCharges)}</div></div>
                  <div className="border-2 border-black bg-[#FAF6EE] p-4 shadow-[3px_3px_0_#0C0C0C]"><div className="font-mono text-xs font-bold uppercase text-stone-600">Received · Balance</div><div className="mt-2 text-xl font-bold">{money(totalReceived)}</div><div className={`mt-1 font-mono text-sm font-bold ${balance > 0 ? "text-red-700" : balance < 0 ? "text-amber-700" : "text-[#0A6B52]"}`}>Balance: {money(balance)}</div></div>
                </div>
                <div className="border-2 border-black bg-[#FAF6EE] shadow-[4px_4px_0_#0C0C0C]">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-black bg-[#E8DFC7] p-4"><div><h2 className="font-serif text-2xl font-bold uppercase">Client Cases ({cases.length})</h2><p className="text-xs text-stone-600">Case ownership shown as stored in Ledger.</p></div><button onClick={() => setShowReceiptForm(v => !v)} className="no-print inline-flex h-10 items-center gap-2 border-2 border-black bg-[#C94A00] px-3 font-mono text-xs font-bold uppercase text-white shadow-[2px_2px_0_#0C0C0C]"><ReceiptText className="h-4 w-4" /> Record Receipt</button></div>
                  {casesQuery.isLoading ? <p className="p-4">Loading cases…</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-stone-100 font-mono text-[11px] uppercase"><tr><th className="p-3">TM / Folder</th><th className="p-3">Application / Case Ref</th><th className="p-3">Status</th><th className="p-3">CMS Link</th></tr></thead><tbody>{cases.map(c => <tr key={c.id} className="border-t border-stone-300"><td className="p-3 font-mono">{c.tm_no || "TM pending"}<div className="text-xs text-stone-500">{c.folder_no || "No folder"}</div></td><td className="p-3">{c.application_name || "Unnamed application"}<div className="text-xs text-stone-500">{c.case_ref || "No case ref"}</div></td><td className="p-3 uppercase">{c.status}</td><td className="p-3"><span className={`inline-block border px-2 py-1 font-mono text-[10px] font-bold uppercase ${c.reconciliation_status === "approved_link" && c.cms_trademark_id ? "border-emerald-700 bg-emerald-50 text-emerald-800" : "border-amber-700 bg-amber-50 text-amber-800"}`}>{c.reconciliation_status === "approved_link" && c.cms_trademark_id ? "Linked" : "Unlinked / Review"}</span></td></tr>)}</tbody></table>{!cases.length && <p className="p-4 text-sm text-stone-600">No Ledger cases for this client.</p>}</div>}
                </div>
                {showReceiptForm && <form onSubmit={e => { e.preventDefault(); setReceiptError(""); receiptMutation.mutate(); }} className="no-print border-2 border-black bg-white p-5 shadow-[4px_4px_0_#0C0C0C]">
                  <h2 className="mb-4 font-serif text-2xl font-bold uppercase">Record Client Receipt</h2>
                  {receiptError && <p className="mb-3 border-2 border-red-700 bg-red-50 p-3 text-sm font-bold text-red-800">{receiptError}</p>}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <label className="text-xs font-bold uppercase">Case (optional)<select value={caseId} onChange={e => setCaseId(e.target.value)} className="mt-1 h-10 w-full border-2 border-black bg-white px-2 text-sm"><option value="">Client-level receipt</option>{cases.map(c => <option key={c.id} value={c.id}>{c.tm_no || c.folder_no || c.case_ref || c.id.slice(0,8)} — {c.application_name || "Case"}</option>)}</select></label>
                    <label className="text-xs font-bold uppercase">Stage<select value={stage} onChange={e => setStage(e.target.value)} className="mt-1 h-10 w-full border-2 border-black bg-white px-2 text-sm"><option value="">Client-level / no stage</option>{STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</select></label>
                    <label className="text-xs font-bold uppercase">Amount (PKR)<input required min="0.01" step="0.01" type="number" value={amount} onChange={e => setAmount(e.target.value)} className="mt-1 h-10 w-full border-2 border-black px-2 text-sm" /></label>
                    <label className="text-xs font-bold uppercase">Receipt Date<input required type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} className="mt-1 h-10 w-full border-2 border-black px-2 text-sm" /></label>
                    <label className="text-xs font-bold uppercase">Payment Method<select value={method} onChange={e => setMethod(e.target.value)} className="mt-1 h-10 w-full border-2 border-black bg-white px-2 text-sm"><option value="bank_transfer">Bank transfer</option><option value="cash">Cash</option><option value="cheque">Cheque</option><option value="online">Online</option><option value="other">Other</option></select></label>
                    <label className="text-xs font-bold uppercase">Details<input value={details} onChange={e => setDetails(e.target.value)} className="mt-1 h-10 w-full border-2 border-black px-2 text-sm" /></label>
                    <label className="text-xs font-bold uppercase sm:col-span-2">Notes<textarea value={notes} onChange={e => setNotes(e.target.value)} className="mt-1 min-h-20 w-full border-2 border-black p-2 text-sm" /></label>
                  </div>
                  <div className="mt-4 flex gap-2"><button disabled={receiptMutation.isPending} className="h-10 border-2 border-black bg-[#0A6B52] px-4 font-mono text-xs font-bold uppercase text-white disabled:opacity-50">{receiptMutation.isPending ? "Saving…" : "Save Official Receipt"}</button><button type="button" onClick={() => setShowReceiptForm(false)} className="h-10 border-2 border-black bg-white px-4 font-mono text-xs font-bold uppercase">Cancel</button></div>
                  <p className="mt-3 text-xs text-stone-600">Receipt number is generated by the database. Admin authorization, ownership checks and request idempotency are enforced server-side.</p>
                </form>}
                <div id="client-ledger-print" className="border-2 border-black bg-[#FAF6EE] shadow-[4px_4px_0_#0C0C0C]">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-black bg-[#0C0C0C] p-4 text-white"><div><h2 className="font-serif text-2xl font-bold uppercase">Full Client Ledger</h2><p className="font-mono text-xs">{activeClient.client_name || "Unnamed client"} · {activeClient.client_code} · {selectedEntryIds.length ? "Selected entries only" : "All ledger entries"}</p></div><div className="no-print font-mono text-xs">{entries.length} entries · {selectedEntryIds.length} selected</div></div>
                  <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="bg-stone-100 font-mono uppercase"><tr><th className="no-print p-2">Select</th><th className="p-2">Date</th><th className="p-2">TM / Case</th><th className="p-2">Type / Stage</th><th className="p-2">Details / Receipt</th><th className="p-2 text-right">Charge</th><th className="p-2 text-right">Receipt</th><th className="p-2">State</th></tr></thead><tbody>{printableEntries.map(e => { const c = cases.find(row => row.id === e.case_id); return <tr key={e.id} className={`border-t border-stone-300 ${e.voided_at ? "text-stone-400 line-through" : ""}`}><td className="no-print p-2"><input aria-label="Select ledger entry" type="checkbox" checked={selectedEntryIds.includes(e.id)} onChange={() => toggleEntry(e.id)} /></td><td className="whitespace-nowrap p-2">{shortDate(e.entry_date)}</td><td className="p-2">{c?.tm_no || c?.case_ref || "Client-level"}</td><td className="p-2 uppercase">{e.entry_type}<div>{STAGES.find(s => s.value === e.stage)?.label || e.stage || "Client-level"}</div></td><td className="p-2">{e.details || "—"}<div className="font-mono">{e.receipt_no || ""}</div></td><td className="p-2 text-right">{e.entry_type === "charge" ? money(e.amount_due) : "—"}</td><td className="p-2 text-right">{e.entry_type === "receiving" ? money(e.amount_received) : "—"}</td><td className="p-2">{e.voided_at ? "Voided: " + (e.void_reason || "") : "Active"}</td></tr>; })}</tbody></table>{!printableEntries.length && <p className="p-5 text-sm text-stone-600">No ledger entries recorded for this client yet.</p>}</div>
                  <div className="border-t-2 border-black p-4 text-xs"><div className="flex flex-wrap justify-between gap-3"><span>Charges: <b>{money(totalCharges)}</b> · Receipts: <b>{money(totalReceived)}</b> · Calculated balance: <b>{money(balance)}</b></span><span>Printed {new Date().toLocaleString()}</span></div><p className="mt-2 text-stone-500">Balance shown is calculated from active charge and receipt entries; it does not infer charges from the fee schedule.</p></div>
                </div>
              </>}
            </section>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
