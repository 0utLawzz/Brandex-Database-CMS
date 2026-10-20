import { supabase } from "./supabase";
export async function billingRows(
  table: string,
  column?: string,
  value?: string,
) {
  const rows: any[] = [];
  for (let offset = 0; ; offset += 500) {
    let q = supabase
      .from(table)
      .select("*")
      .order(
        table === "billing_receipts"
          ? "id"
          : table === "case_operations"
            ? "trademark_id"
            : "id",
      )
      .range(offset, offset + 499);
    if (column && value) q = q.eq(column, value);
    const { data, error } = await q;
    if (error) throw error;
    rows.push(...data);
    if (data.length < 500) return rows;
  }
}
export async function billingRowsIn(table: string, column: string, values: string[]) {
  if (!values.length) return [];
  const rows: any[] = [];
  for (let start = 0; start < values.length; start += 100) {
    const ids = values.slice(start, start + 100);
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .in(column, ids)
        .order("id")
        .range(offset, offset + 499);
      if (error) throw error;
      rows.push(...data);
      if (data.length < 500) break;
    }
  }
  return rows;
}
export async function caseAccount(id: string) {
  const { data, error } = await supabase.rpc("case_payment_position", {
    p_case: id,
  });
  if (error) throw error;
  return data as {
    case_reference: string;
    client_name: string;
    terms: "monthly" | "advance";
    stages: {
      id: string;
      stage: number | null;
      description: string;
      billed: string | number | null;
      received: string | number;
      outstanding: string | number | null;
    }[];
  } | null;
}
export async function caseOperations(id: string) {
  const { data, error } = await supabase
    .from("case_operations")
    .select("*")
    .eq("trademark_id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}
export async function saveReceiving(input: {
  id: string;
  client: string;
  amount: string;
  date: string;
  method: string;
  version: number;
  allocations: { charge_id: string; amount: string }[];
}) {
  const { data, error } = await supabase.rpc("save_client_receiving", {
    p_id: input.id,
    p_client: input.client,
    p_amount: input.amount,
    p_date: input.date,
    p_method: input.method,
    p_version: input.version,
    p_allocations: input.allocations,
  });
  if (error) throw error;
  return data;
}
export const money = (value: unknown) =>
  value === null || value === undefined
    ? "Rate needed"
    : Number(value).toLocaleString("en-PK", {
        style: "currency",
        currency: "PKR",
      });
