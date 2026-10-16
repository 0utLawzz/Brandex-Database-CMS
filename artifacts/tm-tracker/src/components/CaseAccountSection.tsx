import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { caseAccount, caseOperations, money } from "@/lib/billing";
import { caseFlag, pakistanToday } from "@/lib/case-timing";
import { supabase } from "@/lib/supabase";
import type { TrademarkRecord } from "@/lib/api";
export function CaseAccountSection({
  record,
  canEdit,
}: {
  record: TrademarkRecord;
  canEdit: boolean;
}) {
  const cache = useQueryClient(),
    [error, setError] = useState("");
  const account = useQuery({
    queryKey: ["case-account", record.id],
    queryFn: () => caseAccount(record.id),
  });
  const ops = useQuery({
    queryKey: ["case-operations", record.id],
    queryFn: () => caseOperations(record.id),
  });
  const opposition = useQuery({
    queryKey: ["case-objection-count", record.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("opposition_events")
        .select("id", { count: "exact", head: true })
        .eq("trademark_id", record.id);
      if (error) throw error;
      return count ?? 0;
    },
  });
  const flag =
    ops.data && opposition.isSuccess
      ? caseFlag(
          {
            stage: record.stage,
            subStage: record.subStage,
            filingDate: record.date,
            eventDate: ops.data.event_date,
            acceptedDate: ops.data.accepted_date,
            publicationDate: record.publicationDate,
            feeSubmittedDate:
              ops.data.fee_submitted_date ?? record.demandNoteSubmittedDate,
            certificateReceivedDate: ops.data.certificate_received_date,
            reactivatedDate: ops.data.reactivated_date,
            hasObjection: opposition.data > 0,
          },
          pakistanToday(),
        )
      : null;
  async function change(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const f = new FormData(event.currentTarget);
    try {
      const { error } = await supabase.rpc("set_case_event_date", {
        p_case: record.id,
        p_date: f.get("date"),
      });
      if (error) throw error;
      await cache.invalidateQueries({
        queryKey: ["case-operations", record.id],
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
  async function reactivate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const f = new FormData(event.currentTarget);
    const { error } = await supabase.rpc("reactivate_case", {
      p_case: record.id,
      p_amount: f.get("amount"),
      p_date: f.get("date"),
    });
    if (error) setError(error.message);
    else await cache.invalidateQueries();
  }
  return (
    <section className="border-2 border-[#0C0C0C] bg-white p-4 space-y-4">
      <h2 className="font-serif text-xl">CASE ACCOUNT & FOLLOW-UP</h2>
      {account.isLoading ? (
        <p>Loading Ledger…</p>
      ) : account.error ? (
        <p role="alert">Ledger unavailable: {account.error.message}</p>
      ) : account.data ? (
        <>
          <p>
            {account.data.case_reference} — {account.data.client_name}
          </p>
          <p>
            <strong>Payment Terms:</strong>{" "}
            {account.data.terms === "monthly"
              ? "Monthly Billing / Credit"
              : "Advance Payment"}
          </p>
          <table className="w-full text-left">
            <thead>
              <tr>
                <th>Charge</th>
                <th>Billed</th>
                <th>Received</th>
                <th>Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {account.data.stages.map((s) => (
                <tr key={s.id}>
                  <td>{s.description}</td>
                  <td>{money(s.billed)}</td>
                  <td>{money(s.received)}</td>
                  <td>{money(s.outstanding)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Link className="underline" href="/ledger">
            OPEN CLIENT LEDGER
          </Link>
        </>
      ) : (
        <p>
          Legacy case not yet linked. Reconcile its client account before
          relying on payment confirmation.
        </p>
      )}
      {(ops.error || opposition.error) && (
        <p role="alert">
          Timing data unavailable. No due-status claim can be made.
        </p>
      )}
      {record.stage === "STOPPED" ? (
        <p>STOPPED — timing rules paused. Financial balances remain.</p>
      ) : (
        flag && (
          <p
            className={`p-3 border-2 ${flag.tone === "red" ? "border-red-700 bg-red-50" : flag.tone === "yellow" ? "border-yellow-600 bg-yellow-50" : "border-green-700 bg-green-50"}`}
          >
            <strong>{flag.tone.toUpperCase()}</strong> — {flag.reason}; due{" "}
            {flag.dueDate}; {flag.elapsedDays} calendar days.
          </p>
        )
      )}
      {canEdit && record.stage !== "STOPPED" && (
        <form onSubmit={change} className="flex gap-2 flex-wrap">
          <label>
            Actual current-event date{" "}
            <input
              name="date"
              type="date"
              required
              max={pakistanToday()}
              defaultValue={ops.data?.event_date ?? ""}
              className="border p-2"
            />
          </label>
          <button className="border-2 p-2">SAVE EVENT DATE</button>
        </form>
      )}
      {canEdit && record.stage === "STOPPED" && (
        <form onSubmit={reactivate} className="flex gap-2 flex-wrap">
          <label>
            TM-57 submitted{" "}
            <input
              name="date"
              type="date"
              max={pakistanToday()}
              required
              className="border p-2"
            />
          </label>
          <label>
            Extra charge{" "}
            <input
              name="amount"
              type="number"
              min="0"
              step="0.01"
              required
              className="border p-2"
            />
          </label>
          <button className="border-2 p-2">REACTIVATE PREVIOUS STAGE</button>
          <p>Internal Active; IPO restoration approval is separate.</p>
        </form>
      )}
      {canEdit && account.data && (
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const { error } = await supabase
              .from("billing_case_links")
              .update({
                drive_folder_id: String(f.get("folder")).trim() || null,
              })
              .eq("trademark_id", record.id);
            if (error) setError(error.message);
          }}
        >
          <label>
            Existing case Drive folder ID{" "}
            <input name="folder" className="border p-2" />
          </label>
          <button className="border p-2">LINK VERIFIED FOLDER</button>
        </form>
      )}
      {canEdit && account.data?.terms === "advance" && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const n = Number(f.get("stage"));
            const { error } = await supabase.rpc("billing_ensure_charge", {
              p_case: record.id,
              p_stage: n,
              p_event: `${record.id}:stage:${n}`,
            });
            if (error) setError(error.message);
            else
              await cache.invalidateQueries({
                queryKey: ["case-account", record.id],
              });
          }}
        >
          <label>
            Prepare next stage charge for receiving{" "}
            <select name="stage" className="border p-2">
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  Stage {n}
                </option>
              ))}
            </select>
          </label>
          <button className="border p-2">PREPARE CHARGE</button>
        </form>
      )}
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}
