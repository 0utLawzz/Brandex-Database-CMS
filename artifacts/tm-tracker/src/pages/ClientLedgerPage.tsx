import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { AppShell } from "@/components/layout/AppShell";
import { getStaffRole } from "@/lib/api";
import { billingRows, saveReceiving, money } from "@/lib/billing";
import { pakistanToday } from "@/lib/case-timing";
import { supabase } from "@/lib/supabase";
const input = "border border-stone-400 bg-white p-2 rounded-none";
export function ClientLedgerPage() {
  const [receivingId, setReceivingId] = useState(() => crypto.randomUUID());
  const cache = useQueryClient(),
    [client, setClient] = useState(""),
    [search, setSearch] = useState(""),
    [series, setSeries] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [editing, setEditing] = useState<any>(null);
  const role = useQuery({ queryKey: ["staff-role"], queryFn: getStaffRole }),
    canWrite = role.data === "admin";
  const clients = useQuery({
    queryKey: ["billing-clients", search, series],
    queryFn: async () => {
      let q = supabase
        .from("billing_clients")
        .select("*")
        .order("series")
        .order("code")
        .limit(100);
      if (search) q = q.ilike("name", `%${search.replace(/[%_]/g, "")}%`);
      if (series) q = q.eq("series", series);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
  const groups = useQuery({
    queryKey: ["billing-series"],
    queryFn: async () =>
      await supabase
        .from("billing_series")
        .select("*")
        .order("code")
        .then(({ data, error }) => {
          if (error) throw error;
          return data;
        }),
  });
  const account = useQuery({
    queryKey: ["client-account", client],
    enabled: !!client,
    queryFn: async () => {
      const links = await billingRows(
          "billing_case_links",
          "client_id",
          client,
        ),
        receivings = await billingRows(
          "billing_receivings",
          "client_id",
          client,
        );
      const charges: any[] = [],
        allocations: any[] = [],
        receipts: any[] = [];
      for (const l of links)
        charges.push(
          ...(await billingRows(
            "billing_stage_position",
            "trademark_id",
            l.trademark_id,
          )),
        );
      for (const r of receivings) {
        allocations.push(
          ...(await billingRows("billing_allocations", "receiving_id", r.id)),
        );
        receipts.push(
          ...(await billingRows("billing_receipts", "receiving_id", r.id)),
        );
      }
      return { links, charges, receivings, allocations, receipts };
    },
  });
  const selected = clients.data?.find((c) => c.id === client),
    data = account.data;
  async function action(fn: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await fn();
      await cache.invalidateQueries({ queryKey: ["client-account"] });
      await cache.invalidateQueries({ queryKey: ["case-account"] });
      await cache.invalidateQueries({ queryKey: ["billing-clients"] });
      setEditing(null);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function receiving(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const saved = await action(() =>
      saveReceiving({
        id: editing?.id ?? receivingId,
        client,
        amount: String(f.get("amount")),
        date: String(f.get("date")),
        method: String(f.get("method")),
        version: editing?.version ?? 0,
        allocations: (data?.charges ?? [])
          .filter((c) => !c.voided_at && Number(f.get(c.id)) > 0)
          .map((c) => ({ charge_id: c.id, amount: String(f.get(c.id)) })),
      }),
    );
    if (saved) setReceivingId(crypto.randomUUID());
  }
  async function rates(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await action(async () => {
      const rates = Object.fromEntries(
        [1, 2, 3, 4].map((n) => [n, String(f.get(`rate${n}`))]),
      );
      const { error } = await supabase
        .from("billing_clients")
        .update({
          terms: f.get("terms"),
          drive_folder_id: String(f.get("folder") ?? "").trim() || null,
          rates,
        })
        .eq("id", client);
      if (error) throw error;
    });
  }
  const totals = data
    ? {
        billed: data.charges
          .filter((c) => !c.voided_at)
          .reduce((n, c) => n + Number(c.billed ?? 0), 0),
        received: data.receivings
          .filter((r) => !r.voided_at)
          .reduce((n, r) => n + Number(r.amount), 0),
      }
    : { billed: 0, received: 0 };
  return (
    <AppShell>
      <div className="overflow-auto p-4 md:p-6 space-y-5">
        <div className="flex justify-between">
          <h1 className="font-serif text-3xl">CLIENT LEDGER</h1>
          <Link href="/database" className="underline">
            CASE DATABASE
          </Link>
        </div>
        <p>
          Shared records, separate client accounts. Receiving is allocated
          manually to cases and stages.
        </p>
        <div className="flex gap-3 flex-wrap">
          <label>
            Client name{" "}
            <input
              className={input}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <label>
            Series{" "}
            <select
              className={input}
              value={series}
              onChange={(e) => setSeries(e.target.value)}
            >
              <option value="">All series</option>
              {groups.data?.map((s) => (
                <option key={s.code}>{s.code}</option>
              ))}
            </select>
          </label>
          <label>
            Client{" "}
            <select
              className={input}
              value={client}
              onChange={(e) => {
                setClient(e.target.value);
                setEditing(null);
              }}
            >
              <option value="">Choose client</option>
              {clients.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.series}-{c.code} — {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {(clients.error || account.error) && (
          <p role="alert">{clients.error?.message ?? account.error?.message}</p>
        )}
        {clients.data?.length === 100 && (
          <p>Showing first 100 matches. Narrow the client search.</p>
        )}
        {canWrite && (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void action(async () => {
                const { error } = await supabase
                  .from("billing_series")
                  .insert({
                    code: String(f.get("code")).toUpperCase(),
                    name: f.get("name"),
                  });
                if (error) throw error;
                await cache.invalidateQueries({ queryKey: ["billing-series"] });
              });
            }}
          >
            <input
              name="code"
              placeholder="New series code"
              required
              pattern="[A-Za-z][A-Za-z0-9_-]*"
              className={input}
            />
            <input
              name="name"
              placeholder="Series name"
              required
              className={input}
            />
            <button disabled={busy} className={input}>
              ADD SERIES
            </button>
          </form>
        )}
        {canWrite && (
          <details>
            <summary>New client and Drive destinations</summary>
            <form
              className="flex gap-2 flex-wrap"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void action(async () => {
                  const { error } = await supabase
                    .from("billing_clients")
                    .insert({
                      series: f.get("series"),
                      code: String(f.get("code")).trim().toUpperCase(),
                      name: f.get("name"),
                      terms: "monthly",
                      rates: Object.fromEntries(
                        [1, 2, 3, 4].map((n) => [n, String(f.get(`rate${n}`))]),
                      ),
                    });
                  if (error) throw error;
                });
              }}
            >
              <label>
                Series{" "}
                <select name="series" required className={input}>
                  {groups.data?.map((g) => (
                    <option key={g.code}>{g.code}</option>
                  ))}
                </select>
              </label>
              <label>
                Client code <input name="code" required className={input} />
              </label>
              <label>
                Name <input name="name" required className={input} />
              </label>
              {[1, 2, 3, 4].map((n) => (
                <label key={n}>
                  Stage {n}
                  <input
                    name={`rate${n}`}
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    className={input}
                  />
                </label>
              ))}
              <button disabled={busy} className={input}>
                CREATE MONTHLY CLIENT
              </button>
            </form>
            <form
              className="flex gap-2 flex-wrap mt-3"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void action(async () => {
                  const { error } = await supabase
                    .from("billing_series")
                    .update({ drive_root_id: String(f.get("root")).trim() })
                    .eq("code", f.get("series"));
                  if (error) throw error;
                  await cache.invalidateQueries({
                    queryKey: ["billing-series"],
                  });
                });
              }}
            >
              <label>
                Series{" "}
                <select name="series" className={input}>
                  {groups.data?.map((g) => (
                    <option key={g.code}>{g.code}</option>
                  ))}
                </select>
              </label>
              <label>
                Verified Drive root folder ID{" "}
                <input
                  name="root"
                  required
                  pattern="[A-Za-z0-9_-]+"
                  className={input}
                />
              </label>
              <button disabled={busy} className={input}>
                SET SERIES DRIVE ROOT
              </button>
            </form>
          </details>
        )}
        {error && (
          <p role="alert" className="border-2 border-red-600 p-3">
            {error}
          </p>
        )}
        {selected && data && (
          <>
            <h2 className="font-serif text-2xl">
              {selected.series}-{selected.code} — {selected.name}
            </h2>
            <p className="font-bold">
              Billed {money(totals.billed)} · Received {money(totals.received)}{" "}
              · Client balance {money(totals.billed - totals.received)}
            </p>
            <p>
              Unpriced charges remain visible as Rate needed; totals exclude
              unknown amounts.
            </p>
            {canWrite && (
              <details>
                <summary>Client payment terms and preset rates</summary>
                <form
                  onSubmit={rates}
                  key={client}
                  className="flex gap-3 flex-wrap p-3"
                >
                  <label>
                    Terms{" "}
                    <select
                      name="terms"
                      defaultValue={selected.terms}
                      className={input}
                    >
                      <option value="monthly">Monthly Billing / Credit</option>
                      <option value="advance">Advance Payment</option>
                    </select>
                  </label>
                  {[1, 2, 3, 4].map((n) => (
                    <label key={n}>
                      Stage {n}{" "}
                      <input
                        className={input}
                        name={`rate${n}`}
                        type="number"
                        min="0"
                        step="0.01"
                        required
                        defaultValue={selected.rates[n] ?? ""}
                      />
                    </label>
                  ))}
                  <label>
                    Existing client Drive folder ID{" "}
                    <input
                      name="folder"
                      className={input}
                      defaultValue={selected.drive_folder_id ?? ""}
                    />
                  </label>
                  <button disabled={busy} className={input}>
                    SAVE FOR NEW CHARGES
                  </button>
                </form>
              </details>
            )}
            <h3 className="font-serif text-xl">Case charges</h3>
            <table className="w-full text-left border">
              <thead>
                <tr>
                  <th>Case</th>
                  <th>Charge</th>
                  <th>Billed</th>
                  <th>Received</th>
                  <th>Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {data.charges.map((c) => (
                  <tr
                    key={c.id}
                    className={c.voided_at ? "line-through opacity-50" : ""}
                  >
                    <td>
                      <Link
                        className="underline"
                        href={`/record/${c.trademark_id}`}
                      >
                        {
                          data.links.find(
                            (l) => l.trademark_id === c.trademark_id,
                          )?.case_reference
                        }
                      </Link>
                    </td>
                    <td>
                      {c.description}
                      {canWrite && c.billed === null && (
                        <button
                          className="underline ml-2"
                          onClick={() => {
                            const value = window.prompt(
                              "Confirm this unpriced charge amount (PKR)",
                            );
                            if (
                              value !== null &&
                              /^\d+(\.\d{1,2})?$/.test(value)
                            )
                              void action(async () => {
                                const { error } = await supabase
                                  .from("billing_charges")
                                  .update({ amount: value })
                                  .eq("id", c.id)
                                  .is("amount", null);
                                if (error) throw error;
                              });
                          }}
                        >
                          SET AMOUNT
                        </button>
                      )}
                    </td>
                    <td>{money(c.billed)}</td>
                    <td>{money(c.received)}</td>
                    <td>{money(c.outstanding)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {canWrite && (
              <form
                onSubmit={receiving}
                key={editing?.id ?? `${client}-${receivingId}`}
                className="border-2 p-4 space-y-3"
              >
                <h3 className="font-serif text-xl">
                  {editing
                    ? "Edit receiving"
                    : "Record receiving / allocate advance"}
                </h3>
                <fieldset disabled={busy} className="flex flex-wrap gap-3">
                  <label>
                    Total amount{" "}
                    <input
                      name="amount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      defaultValue={editing?.amount}
                      className={input}
                    />
                  </label>
                  <label>
                    Date{" "}
                    <input
                      name="date"
                      type="date"
                      required
                      defaultValue={editing?.entry_date ?? pakistanToday()}
                      className={input}
                    />
                  </label>
                  <label>
                    Method{" "}
                    <input
                      name="method"
                      required
                      defaultValue={editing?.method ?? "Bank"}
                      className={input}
                    />
                  </label>
                </fieldset>
                <p>
                  Allocate to the charges below, or leave blank to retain an
                  advance. Edit an existing receiving to allocate its remaining
                  advance.
                </p>
                {data.charges
                  .filter((c) => !c.voided_at && c.billed !== null)
                  .map((c) => (
                    <label key={c.id} className="block">
                      {
                        data.links.find(
                          (l) => l.trademark_id === c.trademark_id,
                        )?.case_reference
                      }{" "}
                      — {c.description}{" "}
                      <input
                        disabled={busy}
                        name={c.id}
                        type="number"
                        min="0"
                        step="0.01"
                        defaultValue={
                          editing
                            ? (data.allocations.find(
                                (a) =>
                                  a.receiving_id === editing.id &&
                                  a.charge_id === c.id,
                              )?.amount ?? "")
                            : ""
                        }
                        className={input}
                      />
                    </label>
                  ))}
                <button disabled={busy} className={input}>
                  SAVE RECEIVING
                </button>
                {editing && (
                  <button
                    type="button"
                    onClick={() => setEditing(null)}
                    className={input}
                  >
                    CANCEL EDIT
                  </button>
                )}
              </form>
            )}
            <h3 className="font-serif text-xl">Receiving and case receipts</h3>
            {data.receivings.map((r) => (
              <div key={r.id} className="border p-3">
                <strong>
                  {r.entry_date} — {money(r.amount)} — {r.method}{" "}
                  {r.voided_at && "VOID"}
                </strong>
                <div className="flex gap-3 flex-wrap">
                  {data.receipts
                    .filter((x) => x.receiving_id === r.id)
                    .map((x) => (
                      <Link
                        key={x.id}
                        className="underline"
                        href={`/ledger/receipt/${x.id}`}
                      >
                        {
                          data.links.find(
                            (l) => l.trademark_id === x.trademark_id,
                          )?.case_reference
                        }{" "}
                        receipt
                      </Link>
                    ))}
                  {canWrite && !r.voided_at && (
                    <>
                      <button
                        className="underline"
                        onClick={() => setEditing(r)}
                      >
                        EDIT / ALLOCATE
                      </button>
                      <button
                        className="underline text-red-700"
                        disabled={busy}
                        onClick={() => {
                          if (
                            window.confirm(
                              "Void this receiving? The entry and receipt history will remain.",
                            )
                          )
                            void action(async () => {
                              const { data: changed, error } = await supabase
                                .from("billing_receivings")
                                .update({ voided_at: new Date().toISOString() })
                                .eq("id", r.id)
                                .eq("version", r.version)
                                .select("id");
                              if (error) throw error;
                              if (!changed?.length)
                                throw new Error("Receiving changed; reload");
                            });
                        }}
                      >
                        VOID
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </AppShell>
  );
}
