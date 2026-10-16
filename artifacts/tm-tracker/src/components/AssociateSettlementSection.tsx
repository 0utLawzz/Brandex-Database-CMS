import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listAgentProfiles } from "@/lib/api";
import { billingRows, money } from "@/lib/billing";
import { supabase } from "@/lib/supabase";
import { pakistanToday } from "@/lib/case-timing";
export function AssociateSettlementSection({
  canWrite,
}: {
  canWrite: boolean;
}) {
  const [paymentId, setPaymentId] = useState(() => crypto.randomUUID());
  const [associate, setAssociate] = useState(""),
    [editing, setEditing] = useState<any>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    cache = useQueryClient();
  const people = useQuery({
    queryKey: ["agents-master"],
    queryFn: listAgentProfiles,
  });
  const payments = useQuery({
    queryKey: ["associate-settlements", associate],
    enabled: !!associate,
    queryFn: () =>
      billingRows("associate_settlements", "associate_id", associate),
  });
  const fees = useQuery({
    queryKey: ["associate-unpaid", associate],
    enabled: !!associate,
    queryFn: () => billingRows("agent_fees", "agent_id", associate),
  });
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await change({
      p_id: editing?.id ?? paymentId,
      p_associate: associate,
      p_amount: f.get("amount"),
      p_date: f.get("date"),
      p_version: editing?.version ?? 0,
      p_void: false,
    });
  }
  async function change(args: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const { error } = await supabase.rpc("save_associate_settlement", args);
      if (error) throw error;
      setEditing(null);
      setPaymentId(crypto.randomUUID());
      await cache.invalidateQueries();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="border-2 p-4 space-y-3 m-4">
      <h2 className="font-serif text-xl">
        Weekly / partial Service Associate payments
      </h2>
      <label>
        Associate{" "}
        <select
          className="border p-2"
          value={associate}
          onChange={(e) => {
            setAssociate(e.target.value);
            setEditing(null);
          }}
        >
          <option value="">Choose associate</option>
          {people.data?.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </label>
      {fees.data && (
        <p>
          Outstanding:{" "}
          {money(
            fees.data.reduce(
              (n, f) => n + Number(f.amount_billed) - Number(f.amount_paid),
              0,
            ),
          )}
          . Payments settle oldest unpaid fees first.
        </p>
      )}
      {payments.error && <p role="alert">{payments.error.message}</p>}
      {associate && canWrite && (
        <form
          onSubmit={save}
          key={editing?.id ?? `${associate}-${paymentId}`}
          className="flex gap-3 flex-wrap"
        >
          <label>
            Amount{" "}
            <input
              className="border p-2"
              name="amount"
              type="number"
              min="0.01"
              step="0.01"
              required
              defaultValue={editing?.amount}
            />
          </label>
          <label>
            Payment date{" "}
            <input
              className="border p-2"
              name="date"
              type="date"
              required
              defaultValue={editing?.payment_date ?? pakistanToday()}
            />
          </label>
          <button disabled={busy} className="border-2 p-2">
            {editing ? "SAVE REVISION" : "RECORD PAYMENT"}
          </button>
          {editing && (
            <button type="button" onClick={() => setEditing(null)}>
              CANCEL EDIT
            </button>
          )}
        </form>
      )}
      {payments.data?.map((p) => (
        <div key={p.id} className="flex gap-4 border-b p-2">
          <span>
            {p.payment_date} — {money(p.amount)} {p.voided_at ? "VOID" : ""}
          </span>
          {canWrite && !p.voided_at && (
            <>
              <button className="underline" onClick={() => setEditing(p)}>
                EDIT
              </button>
              <button
                className="underline"
                disabled={busy}
                onClick={() => {
                  if (
                    window.confirm(
                      "Void this payment and return its allocations to unpaid fees?",
                    )
                  )
                    void change({
                      p_id: p.id,
                      p_associate: associate,
                      p_amount: p.amount,
                      p_date: p.payment_date,
                      p_version: p.version,
                      p_void: true,
                    });
                }}
              >
                VOID
              </button>
            </>
          )}
        </div>
      ))}
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}
