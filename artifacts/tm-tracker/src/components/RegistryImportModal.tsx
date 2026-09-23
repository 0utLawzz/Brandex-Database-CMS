import { useMemo, useState } from "react";
import { Upload, X, FileSpreadsheet, CheckCircle2, AlertTriangle, Loader2, Database } from "lucide-react";
import {
  commitFormImport,
  commitJournalImport,
  dryRunFormImport,
  dryRunJournalImport,
  type DryRunResult,
  type FormRegistryRow,
  type JournalRegistryRow,
} from "@/lib/registryImport";
import {
  dryRunTmImport,
  commitTmImport,
  type TmImportDryRunResult,
  type TmImportRow,
} from "@/lib/trademarkImport";

type Kind = "form" | "journal" | "trademark";

interface Props {
  onClose: () => void;
  onCommitted?: () => void;
}

export function RegistryImportModal({ onClose, onCommitted }: Props) {
  const [kind, setKind] = useState<Kind>("form");
  const [fileName, setFileName] = useState("");
  const [csvText, setCsvText] = useState("");
  // Registry dry-run state
  const [dryRun, setDryRun] = useState<DryRunResult | null>(null);
  // Trademark dry-run state
  const [tmDryRun, setTmDryRun] = useState<TmImportDryRunResult | null>(null);
  const [running, setRunning] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [commitMsg, setCommitMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Registry insert rows (form / journal)
  const insertRows = useMemo(() => {
    if (!dryRun) return [];
    return dryRun.items.filter((i) => i.action === "insert").map((i) => i.row);
  }, [dryRun]);

  // Trademark insert rows
  const tmInsertRows = useMemo<TmImportRow[]>(() => {
    if (!tmDryRun) return [];
    return tmDryRun.items.filter((i) => i.action === "insert").map((i) => i.row);
  }, [tmDryRun]);

  const resetState = () => {
    setDryRun(null);
    setTmDryRun(null);
    setCommitMsg(null);
    setError(null);
    setFileName("");
    setCsvText("");
  };

  const onFile = async (file: File | null) => {
    setError(null);
    setDryRun(null);
    setTmDryRun(null);
    setCommitMsg(null);
    if (!file) return;
    setFileName(file.name);
    const text = await file.text();
    setCsvText(text);
  };

  const runDry = async () => {
    if (!csvText.trim()) {
      setError("Choose a CSV file first.");
      return;
    }
    setRunning(true);
    setError(null);
    setCommitMsg(null);
    try {
      if (kind === "form") {
        setDryRun(await dryRunFormImport(csvText));
      } else if (kind === "journal") {
        setDryRun(await dryRunJournalImport(csvText));
      } else {
        setTmDryRun(await dryRunTmImport(csvText));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Dry-run failed");
    } finally {
      setRunning(false);
    }
  };

  const runCommit = async () => {
    setCommitting(true);
    setError(null);
    try {
      if (kind === "trademark") {
        if (!tmInsertRows.length) return;
        const result = await commitTmImport(tmInsertRows);
        if (result.errors.length) setError(result.errors.join("; "));
        setCommitMsg(
          `Imported ${result.inserted} trademark record${result.inserted === 1 ? "" : "s"}` +
            (result.skipped ? ` · ${result.skipped} skipped` : "") +
            (result.errors.length ? ` · ${result.errors.length} error(s)` : ""),
        );
        onCommitted?.();
      } else {
        if (!insertRows.length) return;
        const result =
          kind === "form"
            ? await commitFormImport(insertRows as FormRegistryRow[])
            : await commitJournalImport(insertRows as JournalRegistryRow[]);
        if (result.errors.length) setError(result.errors.join("; "));
        setCommitMsg(
          `Committed ${result.inserted} row(s)` +
            (result.skipped ? ` · ${result.skipped} skipped` : "") +
            (result.errors.length ? ` · ${result.errors.length} error(s)` : ""),
        );
        onCommitted?.();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Commit failed");
    } finally {
      setCommitting(false);
    }
  };

  const commitDisabled =
    committing ||
    Boolean(commitMsg) ||
    (kind === "trademark" ? tmInsertRows.length === 0 : insertRows.length === 0);

  const commitLabel =
    kind === "trademark"
      ? `Import ${tmInsertRows.length} record${tmInsertRows.length === 1 ? "" : "s"}`
      : `Commit ${insertRows.length} insert${insertRows.length === 1 ? "" : "s"}`;

  // Determine which dry-run result is active
  const hasDryRun = kind === "trademark" ? Boolean(tmDryRun) : Boolean(dryRun);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col border-2 border-[#0C0C0C] bg-[#FFF9F0] shadow-xl">
        {/* Header */}
        <div className="flex items-center gap-3 border-b-2 border-[#0C0C0C] bg-[#E8DFC7] px-4 py-3">
          <FileSpreadsheet className="h-5 w-5 text-[#6C1C1F]" />
          <h2 className="font-serif text-xl uppercase tracking-widest text-[#0C0C0C]">
            Admin CSV Import
          </h2>
          <span className="ml-auto font-mono text-[10px] font-bold uppercase tracking-widest text-[#6d6658]">
            Dry-run first
          </span>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-[#0C0C0C]/10"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Kind toggle */}
        <div className="flex flex-wrap gap-2 border-b border-[#0C0C0C]/15 px-4 py-3">
          {(["form", "journal", "trademark"] as Kind[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                setKind(k);
                resetState();
              }}
              className={`h-9 px-4 font-mono text-xs font-bold uppercase tracking-wider border-2 border-[#0C0C0C] ${
                kind === k ? "bg-[#0C0C0C] text-[#F0E8D0]" : "bg-white text-[#0C0C0C]"
              }`}
            >
              {k === "form"
                ? "Form registry (TM5–56)"
                : k === "journal"
                  ? "Journal registry"
                  : "Trademark database"}
            </button>
          ))}
        </div>

        {/* File + actions */}
        <div className="space-y-3 border-b border-[#0C0C0C]/15 px-4 py-4">
          {/* Column hints */}
          {kind === "trademark" ? (
            <div className="space-y-1">
              <p className="font-mono text-[11px] text-[#6d6658]">
                <span className="font-bold text-[#6C1C1F]">Required:</span>{" "}
                type (X/A/N), client_code, case_number, application_name, city
              </p>
              <p className="font-mono text-[11px] text-[#6d6658]">
                <span className="font-bold">Optional:</span>{" "}
                filing_date, client_name, tm_cpr_number, nice_class, case_type, agent, notes (status defaults to STAGE 1 / Filing)
              </p>
              <div className="mt-1 flex items-start gap-2 border border-[#B0740E]/50 bg-[#B0740E]/8 px-3 py-2">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#B0740E]" />
                <p className="font-mono text-[10px] text-[#6d6658]">
                  <span className="font-bold text-[#B0740E]">Safety rules:</span>{" "}
                  Imported records start at Stage&nbsp;1 / Filing with payment <span className="font-bold">UNVERIFIED</span>.
                  Use the Record&nbsp;View payment section to manually attest payment after import.
                  System fields (id, version, payment fields, image fields) are never imported.
                </p>
              </div>
            </div>
          ) : (
            <p className="font-mono text-[11px] text-[#6d6658]">
              {kind === "form"
                ? "Expected columns: serial, office, TM number, class, type (tm5/tm6/tm11/tm16/tm56), status, date (col G)."
                : "Expected columns: Journal No, Journal Date, Application No (TM), Class, Applicant, Agent, Date of Filing, Generated Doc."}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex h-10 cursor-pointer items-center gap-2 border-2 border-[#0C0C0C] bg-white px-4 font-mono text-xs font-bold uppercase tracking-wider hover:bg-[#E8DFC7]">
              <Upload className="h-4 w-4" />
              Choose CSV
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => onFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <span className="font-mono text-xs text-[#0C0C0C]">{fileName || "No file selected"}</span>
            <button
              type="button"
              onClick={runDry}
              disabled={running || !csvText}
              className="ml-auto flex h-10 items-center gap-2 border-2 border-[#0A6B52] bg-[#0A6B52] px-4 font-mono text-xs font-bold uppercase tracking-wider text-white disabled:opacity-40"
            >
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {running ? "Running…" : "Dry-run"}
            </button>
          </div>
          {error && (
            <div className="flex items-start gap-2 border-2 border-[#CC0000] bg-[#CC0000]/10 px-3 py-2 font-mono text-xs text-[#CC0000]">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {commitMsg && (
            <div className="flex items-start gap-2 border-2 border-[#0A6B52] bg-[#0A6B52]/10 px-3 py-2 font-mono text-xs text-[#0A6B52]">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{commitMsg}</span>
            </div>
          )}
        </div>

        {/* Results */}
        <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
          {!hasDryRun && (
            <p className="py-8 text-center font-mono text-xs font-bold uppercase tracking-widest text-[#9d9488]">
              Upload a CSV and run dry-run to preview inserts.
            </p>
          )}

          {/* Trademark dry-run results */}
          {kind === "trademark" && tmDryRun && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                {[
                  ["Valid", tmDryRun.valid],
                  ["Invalid", tmDryRun.invalid],
                  ["CSV Dups", tmDryRun.csvDuplicates],
                  ["DB Dups", tmDryRun.dbDuplicates],
                  ["Will Insert", tmDryRun.wouldInsert],
                  ["Total Parsed", tmDryRun.totalParsed],
                ].map(([label, value]) => (
                  <div
                    key={String(label)}
                    className="border-2 border-[#0C0C0C] bg-white px-3 py-2 text-center"
                  >
                    <div className="font-mono text-[9px] font-bold uppercase tracking-widest text-[#6d6658]">
                      {label}
                    </div>
                    <div className="font-serif text-2xl text-[#0C0C0C]">{value}</div>
                  </div>
                ))}
              </div>

              {tmDryRun.errors.length > 0 && (
                <div className="max-h-28 overflow-auto border border-[#CC0000]/40 bg-[#CC0000]/5 p-2 font-mono text-[10px] text-[#CC0000]">
                  {tmDryRun.errors.slice(0, 40).map((e, i) => (
                    <div key={i}>{e}</div>
                  ))}
                  {tmDryRun.errors.length > 40 && (
                    <div>…and {tmDryRun.errors.length - 40} more</div>
                  )}
                </div>
              )}

              <div className="max-h-56 overflow-auto border-2 border-[#0C0C0C] bg-white">
                <table className="w-full font-mono text-[10px]">
                  <thead className="sticky top-0 bg-[#0C0C0C] text-[#F0E8D0]">
                    <tr>
                      <th className="px-2 py-1.5 text-left">Row</th>
                      <th className="px-2 py-1.5 text-left">Action</th>
                      <th className="px-2 py-1.5 text-left">Type</th>
                      <th className="px-2 py-1.5 text-left">Client Code</th>
                      <th className="px-2 py-1.5 text-left">Case No</th>
                      <th className="px-2 py-1.5 text-left">Application Name</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tmDryRun.items.slice(0, 200).map((item, idx) => (
                      <tr
                        key={idx}
                        className={
                          item.action === "insert"
                            ? "border-b border-[#0C0C0C]/10 bg-[#0A6B52]/5"
                            : item.action === "skip_db_dup"
                              ? "border-b border-[#0C0C0C]/10 bg-[#B0740E]/8"
                              : "border-b border-[#0C0C0C]/10 bg-[#9d9488]/10"
                        }
                      >
                        <td className="px-2 py-1 text-[#6d6658]">{item.sourceRow}</td>
                        <td className="px-2 py-1 font-bold uppercase">
                          {item.action === "insert"
                            ? "INSERT"
                            : item.action === "skip_db_dup"
                              ? "DB DUP"
                              : "CSV DUP"}
                        </td>
                        <td className="px-2 py-1">{item.row.type}</td>
                        <td className="px-2 py-1">{item.row.clientCode}</td>
                        <td className="px-2 py-1">{item.row.caseNumber}</td>
                        <td className="px-2 py-1 max-w-[160px] truncate">{item.row.applicationName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {tmDryRun.items.length > 200 && (
                  <p className="px-2 py-1 text-center font-mono text-[10px] text-[#6d6658]">
                    Showing first 200 of {tmDryRun.items.length}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Registry (form/journal) dry-run results */}
          {kind !== "trademark" && dryRun && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  ["Valid", dryRun.valid],
                  ["Invalid", dryRun.invalid],
                  ["Would insert", dryRun.wouldInsert],
                  ["Duplicates", dryRun.wouldSkipDuplicate],
                ].map(([label, value]) => (
                  <div
                    key={String(label)}
                    className="border-2 border-[#0C0C0C] bg-white px-3 py-2 text-center"
                  >
                    <div className="font-mono text-[9px] font-bold uppercase tracking-widest text-[#6d6658]">
                      {label}
                    </div>
                    <div className="font-serif text-2xl text-[#0C0C0C]">{value}</div>
                  </div>
                ))}
              </div>

              {dryRun.errors.length > 0 && (
                <div className="max-h-28 overflow-auto border border-[#CC0000]/40 bg-[#CC0000]/5 p-2 font-mono text-[10px] text-[#CC0000]">
                  {dryRun.errors.slice(0, 40).map((e, i) => (
                    <div key={i}>{e}</div>
                  ))}
                  {dryRun.errors.length > 40 && (
                    <div>…and {dryRun.errors.length - 40} more</div>
                  )}
                </div>
              )}

              <div className="max-h-56 overflow-auto border-2 border-[#0C0C0C] bg-white">
                <table className="w-full font-mono text-[10px]">
                  <thead className="sticky top-0 bg-[#0C0C0C] text-[#F0E8D0]">
                    <tr>
                      <th className="px-2 py-1.5 text-left">Action</th>
                      <th className="px-2 py-1.5 text-left">Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dryRun.items.slice(0, 200).map((item, idx) => (
                      <tr
                        key={idx}
                        className={
                          item.action === "insert"
                            ? "border-b border-[#0C0C0C]/10 bg-[#0A6B52]/5"
                            : "border-b border-[#0C0C0C]/10 bg-[#9d9488]/10"
                        }
                      >
                        <td className="px-2 py-1 font-bold uppercase">
                          {item.action === "insert" ? "INSERT" : "SKIP"}
                        </td>
                        <td className="px-2 py-1">{item.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {dryRun.items.length > 200 && (
                  <p className="px-2 py-1 text-center text-[#6d6658]">
                    Showing first 200 of {dryRun.items.length}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 border-t-2 border-[#0C0C0C] bg-[#E8DFC7] px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="h-10 border-2 border-[#0C0C0C] bg-white px-4 font-mono text-xs font-bold uppercase tracking-wider"
          >
            Close
          </button>
          {kind === "trademark" && (
            <div className="flex items-center gap-1.5 font-mono text-[10px] text-[#6d6658]">
              <Database className="h-3.5 w-3.5" />
              Main trademark database
            </div>
          )}
          <button
            type="button"
            onClick={runCommit}
            disabled={commitDisabled}
            className="ml-auto flex h-10 items-center gap-2 border-2 border-[#6C1C1F] bg-[#6C1C1F] px-4 font-mono text-xs font-bold uppercase tracking-wider text-white disabled:opacity-40"
          >
            {committing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {committing ? "Importing…" : commitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
