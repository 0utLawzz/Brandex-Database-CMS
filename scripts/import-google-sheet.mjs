import { createClient } from "@supabase/supabase-js";

const required = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "GOOGLE_APPS_SCRIPT_URL",
  "GOOGLE_APPS_SCRIPT_SECRET",
];

for (const name of required) {
  if (!process.env[name]) throw new Error(`Missing ${name}`);
}

const response = await fetch(process.env.GOOGLE_APPS_SCRIPT_URL, {
  method: "POST",
  redirect: "follow",
  headers: { "content-type": "text/plain;charset=utf-8" },
  body: JSON.stringify({
    action: "mirrorExport",
    secret: process.env.GOOGLE_APPS_SCRIPT_SECRET,
  }),
});
const result = await response.json();
if (!response.ok || !result.ok) {
  throw new Error(result.error || `Sheet export failed (${response.status})`);
}

const yes = (value) => ["yes", "true", "1", "y"].includes(String(value ?? "").trim().toLowerCase());
const text = (value) => String(value ?? "").trim() || null;
const date = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? null : parsed.toISOString().slice(0, 10);
};
const legacyImageUrl = (value) => {
  const image = text(value);
  if (!image) return null;
  if (/^https?:\/\//i.test(image)) return image;
  return `https://drive.google.com/thumbnail?id=${encodeURIComponent(image)}&sz=w800`;
};

const rows = result.data
  .filter((row) => text(row.ID))
  .map((row) => ({
    id: text(row.ID),
    filing_date: date(row.DATE) || new Date().toISOString().slice(0, 10),
    type: ["X", "A", "N"].includes(text(row.TYPE)) ? text(row.TYPE) : "X",
    client_code: text(row["CLIENT CODE"]) || "UNASSIGNED",
    client_name: text(row["CLIENT NAME"]),
    case_number: text(row["CASE NUMBER"]) || text(row.ID),
    application_name: text(row["APPLICATION NAME"]) || "Untitled",
    tm_cpr_number: text(row["TM/CPR NUMBER"]),
    nice_class: text(row.CLASS),
    status: text(row.STATUS) || "STAGE 1",
    sub_status: text(row["SUB STATUS"]),
    case_type: text(row["CASE TYPE"]),
    agent: text(row.AGENT),
    city: text(row.CITY) || "Islamabad",
    notes: text(row.NOTES),
    tm5: yes(row.TM5),
    tm6: yes(row.TM6),
    tm11: yes(row.TM11),
    tm16: yes(row.TM16),
    tm56: yes(row.TM56),
    journal_number: text(row["JOURNAL NUMBER"]),
    journal_date: date(row["JOURNAL DATE"]),
    logo_path: null,
    legacy_image_url: legacyImageUrl(row.IMAGE),
    updated_at: text(row["LAST MODIFIED"]) || new Date().toISOString(),
  }));

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const clients = Array.from(
  new Map(
    rows
      .filter((row) => row.client_code && row.client_name)
      .map((row) => [row.client_code, { code: row.client_code, name: row.client_name }]),
  ).values(),
);
if (clients.length) {
  const { error } = await supabase.from("clients").upsert(clients, { onConflict: "code" });
  if (error) throw new Error(`Client import failed: ${error.message}`);
}

for (let index = 0; index < rows.length; index += 500) {
  const batch = rows.slice(index, index + 500);
  const { error } = await supabase.from("trademarks").upsert(batch, { onConflict: "id" });
  if (error) throw new Error(`Import failed at row ${index + 1}: ${error.message}`);
  const { error: outboxError } = await supabase
    .from("sheet_sync_outbox")
    .update({ state: "synced", processed_at: new Date().toISOString(), last_error: null })
    .in("trademark_id", batch.map((row) => row.id))
    .in("state", ["pending", "failed"]);
  if (outboxError) throw new Error(`Could not close import outbox jobs: ${outboxError.message}`);
  process.stdout.write(`Imported ${Math.min(index + batch.length, rows.length)}/${rows.length}\n`);
}

process.stdout.write(`Import complete: ${rows.length} records.\n`);
