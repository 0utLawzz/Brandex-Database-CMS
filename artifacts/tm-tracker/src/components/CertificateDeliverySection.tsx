import { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { billingRows, caseOperations } from "@/lib/billing";
export function CertificateDeliverySection({
  id,
  canWrite,
}: {
  id: string;
  canWrite: boolean;
}) {
  const pendingUpload = useRef<{ key: string; id: string } | null>(null);
  const cache = useQueryClient(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [method, setMethod] = useState("courier");
  const deliveries = useQuery({
    queryKey: ["case-deliveries", id],
    queryFn: () => billingRows("case_deliveries", "trademark_id", id),
  });
  const files = useQuery({
    queryKey: ["case-drive-files", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("case_drive_files")
        .select("*")
        .eq("trademark_id", id)
        .order("uploaded_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });
  const ops = useQuery({
    queryKey: ["case-operations", id],
    queryFn: () => caseOperations(id),
  });
  async function syncFolder() {
    setError("");
    const f = new FormData();
    f.set("case_id", id);
    f.set("action", "sync");
    const { error } = await supabase.functions.invoke("case-drive-upload", {
      body: f,
    });
    if (error) setError("Drive folder sync pending: " + error.message);
    else await cache.invalidateQueries({ queryKey: ["case-operations", id] });
  }
  useEffect(() => {
    if (canWrite && ops.data?.drive_sync_pending) void syncFolder();
  }, [canWrite, id, ops.data?.drive_sync_pending]);
  async function upload(file: File) {
    const f = new FormData();
    f.set("case_id", id);
    const key = `${id}:${file.name}:${file.size}:${file.lastModified}`;
    if (pendingUpload.current?.key !== key)
      pendingUpload.current = { key, id: crypto.randomUUID() };
    f.set("upload_id", pendingUpload.current.id);
    f.set("file", file);
    const { data, error } = await supabase.functions.invoke(
      "case-drive-upload",
      { body: f },
    );
    if (error) throw error;
    await cache.invalidateQueries({ queryKey: ["case-drive-files", id] });
    return data.file_id as string;
  }
  async function receive(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const f = new FormData(e.currentTarget);
    const { error } = await supabase
      .from("case_operations")
      .upsert(
        { trademark_id: id, certificate_received_date: f.get("date") },
        { onConflict: "trademark_id" },
      );
    if (error) setError(error.message);
    else await cache.invalidateQueries({ queryKey: ["case-operations", id] });
  }
  async function dispatch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      const file = f.get("receipt") as File;
      const receipt = file?.size ? await upload(file) : null;
      const { error } = await supabase
        .from("case_deliveries")
        .insert({
          trademark_id: id,
          method,
          company: method === "courier" ? f.get("company") : null,
          tracking_no: method === "courier" ? f.get("tracking") : null,
          destination: f.get("destination"),
          dispatch_date: f.get("date"),
          delivered_date: method === "hand_collected" ? f.get("date") : null,
          receipt_file_id: receipt,
        });
      if (error) throw error;
      await cache.invalidateQueries({ queryKey: ["case-deliveries", id] });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="border-2 p-4 space-y-3">
      <h2 className="font-serif text-xl">CERTIFICATE & DELIVERY</h2>
      <p>
        Office received: {ops.data?.certificate_received_date ?? "Not recorded"}
        . Waiting for client collection does not create an overdue flag.
      </p>
      {canWrite && (
        <form onSubmit={receive}>
          <label>
            Office received date{" "}
            <input
              name="date"
              type="date"
              required
              className="border p-2"
              defaultValue={ops.data?.certificate_received_date ?? ""}
            />
          </label>
          <button className="border-2 p-2">SAVE RECEIPT DATE</button>
        </form>
      )}
      {deliveries.error && <p role="alert">{deliveries.error.message}</p>}
      {deliveries.data?.map((d) => (
        <div key={d.id} className="border-b p-2">
          <p>
            {d.method === "courier"
              ? `${d.company} — ${d.tracking_no}`
              : "Hand Collected"}{" "}
            — {d.dispatch_date} — {d.destination}
          </p>
          <p>Delivered/collected: {d.delivered_date ?? "Pending"}</p>
          {d.receipt_file_id && (
            <a
              className="underline"
              href={`https://drive.google.com/file/d/${encodeURIComponent(d.receipt_file_id)}/view`}
              target="_blank"
              rel="noreferrer"
            >
              OPEN UPLOADED RECEIPT
            </a>
          )}
          {canWrite && d.method === "courier" && !d.delivered_date && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                const { error } = await supabase
                  .from("case_deliveries")
                  .update({ delivered_date: f.get("date") })
                  .eq("id", d.id);
                if (error) setError(error.message);
                else
                  await cache.invalidateQueries({
                    queryKey: ["case-deliveries", id],
                  });
              }}
            >
              <label>
                Delivered date{" "}
                <input
                  name="date"
                  type="date"
                  min={d.dispatch_date}
                  required
                  className="border p-2"
                />
              </label>
              <button className="border p-2">CONFIRM DELIVERY</button>
            </form>
          )}
        </div>
      ))}
      <h3 className="font-serif text-lg">Case files in Drive</h3>
      {files.error && <p role="alert">{files.error.message}</p>}
      {files.data?.map((f) => (
        <p key={f.upload_id}>
          <a
            className="underline"
            href={`https://drive.google.com/file/d/${encodeURIComponent(f.drive_file_id)}/view`}
            target="_blank"
            rel="noreferrer"
          >
            {f.original_name}
          </a>
        </p>
      ))}
      {files.data?.length === 100 && <p>Showing latest 100 uploads.</p>}
      {canWrite && (
        <form onSubmit={dispatch} className="space-y-2">
          <fieldset disabled={busy} className="flex flex-wrap gap-3">
            <label>
              Method{" "}
              <select
                className="border p-2"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
              >
                <option value="courier">Courier</option>
                <option value="hand_collected">Hand Collected</option>
              </select>
            </label>
            {method === "courier" && (
              <>
                <label>
                  Company{" "}
                  <input name="company" required className="border p-2" />
                </label>
                <label>
                  Tracking number{" "}
                  <input name="tracking" required className="border p-2" />
                </label>
              </>
            )}
            <label>
              Destination / collected by{" "}
              <input name="destination" required className="border p-2" />
            </label>
            <label>
              Date{" "}
              <input name="date" type="date" required className="border p-2" />
            </label>
            <label>
              Receipt upload (optional){" "}
              <input
                name="receipt"
                type="file"
                accept="application/pdf,image/png,image/jpeg"
              />
            </label>
            <button className="border-2 p-2">
              {busy ? "SAVING…" : "SAVE DELIVERY EVENT"}
            </button>
          </fieldset>
        </form>
      )}
      {canWrite && ops.data?.drive_sync_pending && (
        <button className="border p-2" onClick={() => void syncFolder()}>
          RETRY DRIVE FOLDER SYNC
        </button>
      )}
      {canWrite && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            const f = new FormData(e.currentTarget);
            try {
              await upload(f.get("file") as File);
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Case document upload to Drive{" "}
            <input
              type="file"
              name="file"
              accept="application/pdf,image/png,image/jpeg"
              required
            />
          </label>
          <button disabled={busy} className="border p-2">
            UPLOAD
          </button>
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
