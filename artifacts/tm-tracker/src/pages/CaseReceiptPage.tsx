import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { money } from "@/lib/billing";
export function CaseReceiptPage() {
  const { id } = useParams<{ id: string }>();
  const q = useQuery({
    queryKey: ["case-receipt", id],
    queryFn: async () => {
      const { data: r, error } = await supabase
        .from("billing_receipts")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      const results = await Promise.all([
        supabase
          .from("billing_receivings")
          .select("*")
          .eq("id", r.receiving_id)
          .single(),
        supabase
          .from("billing_case_links")
          .select("*, billing_clients(name)")
          .eq("trademark_id", r.trademark_id)
          .single(),
        supabase
          .from("billing_allocations")
          .select("*, billing_charges(description,trademark_id)")
          .eq("receiving_id", r.receiving_id),
      ]);
      for (const x of results) if (x.error) throw x.error;
      return {
        receipt: r,
        receiving: results[0].data,
        link: results[1].data,
        lines: (results[2].data ?? []).filter(
          (a: any) => a.billing_charges.trademark_id === r.trademark_id,
        ),
      };
    },
  });
  if (q.isLoading) return <p>Loading receipt…</p>;
  if (q.error) return <p role="alert">{q.error.message}</p>;
  const d = q.data!;
  return (
    <main className="max-w-3xl mx-auto bg-white p-8">
      <div className="print:hidden flex gap-4">
        <Link href="/ledger">BACK TO LEDGER</Link>
        <button onClick={() => window.print()}>PRINT RECEIPT</button>
      </div>
      <h1 className="text-3xl font-serif mt-8">BRANDEX — PAYMENT RECEIPT</h1>
      <p>{d.receipt.receipt_no}</p>
      <p>
        {d.link?.case_reference} — {d.link?.billing_clients?.name}
      </p>
      <p>
        {d.receiving?.entry_date} — {d.receiving?.method}
      </p>
      {(d.receiving?.voided_at || !d.lines.length) && (
        <p className="text-red-700 font-bold text-4xl">
          VOID / NO ACTIVE ALLOCATION
        </p>
      )}
      <table className="w-full my-8">
        <thead>
          <tr>
            <th>Case charge / stage</th>
            <th>Amount received</th>
          </tr>
        </thead>
        <tbody>
          {d.lines.map((a: any) => (
            <tr key={a.id}>
              <td>{a.billing_charges.description}</td>
              <td>{money(a.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xl font-bold">
        Case receipt total:{" "}
        {money(d.lines.reduce((n: number, a: any) => n + Number(a.amount), 0))}
      </p>
      <p>
        Receiving revision {d.receiving?.version}. Earlier details remain in the
        financial audit history.
      </p>
    </main>
  );
}
