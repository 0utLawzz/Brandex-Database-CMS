import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { supabase } from "@/lib/supabase";
import {
  Search,
  RefreshCw,
  Printer,
  ReceiptText,
  Users,
  Wallet,
  AlertCircle,
  Plus,
  FolderPlus,
  FilePlus,
  CheckCircle2,
  X,
  Building,
  ArrowLeft,
  Edit2,
  Download,
  Calendar,
  DollarSign,
  Link as LinkIcon,
  Check,
  TrendingUp,
  FileText,
  Clock,
  Layers,
} from "lucide-react";
import {
  createLedgerClient,
  updateLedgerClient,
  createLedgerSeries,
  createLedgerCase,
  updateLedgerCase,
  linkCaseToCmsTrademark,
  recordLedgerCharge,
  recordLedgerReceiving,
  voidClientReceipt,
  lookupCaseOrTrademarkByTm,
  normalizeTmDigits,
} from "@/lib/ledgerPayments";

// Types matching the Brandex Client Ledger schema
export type LedgerSeries = {
  id: string;
  code: string;
  name: string;
  prefix: string;
  sort_order: number;
  is_active: boolean;
};

export type LedgerClient = {
  id: string;
  series_id: string | null;
  client_code: string;
  client_name: string | null;
  city: string | null;
  email: string | null;
  phone: string | null;
  header_balance: number | string;
  bank_name: string | null;
  bank_account: string | null;
  bank_iban: string | null;
  notes: string | null;
  is_active: boolean;
  ledger_series?: LedgerSeries | null;
};

export type LedgerStageRate = {
  id?: string;
  client_id: string;
  stage: "S1" | "S2" | "S3" | "S4";
  amount: number;
};

export type LedgerCase = {
  id: string;
  client_id: string;
  tm_no: string | null;
  tm_no_normalized: string | null;
  folder_no: string | null;
  case_ref: string | null;
  application_name: string | null;
  status: string;
  notes: string | null;
  cms_trademark_id: string | null;
  reconciliation_status: string;
  created_at: string;
};

export type LedgerEntry = {
  id: string;
  client_id: string;
  case_id: string | null;
  entry_date: string;
  entry_type: "charge" | "receiving";
  stage: "S1" | "S2" | "S3" | "S4" | null;
  details: string | null;
  amount_due: number | string | null;
  amount_received: number | string | null;
  running_balance: number | string | null;
  payment_method: string | null;
  receipt_no: string | null;
  notes: string | null;
  voided_at: string | null;
  void_reason: string | null;
  linked_entry_id: string | null;
  created_at: string;
  ledger_clients?: {
    client_code: string;
    client_name: string | null;
    city?: string | null;
    phone?: string | null;
    email?: string | null;
  } | null;
  ledger_cases?: {
    id: string;
    tm_no: string | null;
    folder_no: string | null;
    application_name: string | null;
  } | null;
};

const STAGES = [
  { value: "S1", label: "Stage 1", desc: "Stage 1 — Filing and Acknowledgement" },
  { value: "S2", label: "Stage 2", desc: "Stage 2 — Assignment and Outcome" },
  { value: "S3", label: "Stage 3", desc: "Stage 3 — Publication and Demand Note" },
  { value: "S4", label: "Stage 4", desc: "Stage 4 — Certificate (CER) Processing" },
] as const;

const PAYMENT_METHODS = [
  "Cash",
  "UBL - Brandex Pk",
  "Meezan Bank Limited",
  "EasyPaisa",
  "JazzCash / Raast",
  "Cheque",
  "Online",
];

const BRAND_BANKS = [
  {
    name: "United Bank Limited (UBL)",
    title: "Brandex Pk",
    account: "0209301813886",
    iban: "PK85UNIL0109000301813886",
  },
  {
    name: "Meezan Bank Limited",
    title: "Brandex.pk",
    account: "9814-0104862477",
    iban: "PK12MEZN0098140104862477",
  },
];

const BRAND_WALLETS = [
  {
    name: "EasyPaisa",
    title: "EHTASHAM UD DIN SIDDIQUI",
    account: "0336-0015009",
    note: "Merchant Till 214114 · Scan to pay",
  },
  {
    name: "JazzCash / Raast ID",
    title: "EHTASHAM UD DIN SIDDIQUI",
    account: "0336-0015004",
  },
];

const fmt = (n: number | string | null | undefined) => {
  if (n == null || isNaN(Number(n))) return "0";
  return Number(n).toLocaleString("en-PK", { maximumFractionDigits: 0 });
};

const shortDate = (value: string | null | undefined) =>
  value
    ? new Date(value + (value.length === 10 ? "T00:00:00" : "")).toLocaleDateString("en-GB")
    : "—";

export function PaymentsPage() {
  const queryClient = useQueryClient();

  // Navigation: "dashboard" | "clients" | "reports" | "ledger"
  const [currentPage, setCurrentPage] = useState<"dashboard" | "clients" | "reports" | "ledger">("dashboard");
  const [activeClientId, setActiveClientId] = useState<string | null>(null);

  // Clients View State
  const [clientSearch, setClientSearch] = useState("");
  const [selectedSeriesFilter, setSelectedSeriesFilter] = useState("");

  // Ledger View State
  const [currentViewModeLast6, setCurrentViewModeLast6] = useState(false);
  const [ledgerCaseFilter, setLedgerCaseFilter] = useState("");
  const [ledgerDateFrom, setLedgerDateFrom] = useState("");
  const [ledgerDateTo, setLedgerDateTo] = useState("");
  const [selectedEntryIds, setSelectedEntryIds] = useState<string[]>([]);

  // Case Table Filters in Ledger View
  const [caseSearchQuery, setCaseSearchQuery] = useState("");
  const [caseStageFilter, setCaseStageFilter] = useState("");
  const [caseStatusFilter, setCaseStatusFilter] = useState("");

  // Reports View State
  const [reportClientId, setReportClientId] = useState("");
  const [reportDateFrom, setReportDateFrom] = useState("");
  const [reportDateTo, setReportDateTo] = useState("");

  // Modals state
  const [showClientModal, setShowClientModal] = useState(false);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);

  const [showSeriesModal, setShowSeriesModal] = useState(false);
  const [showChargeModal, setShowChargeModal] = useState(false);
  const [showReceivingModal, setShowReceivingModal] = useState(false);
  const [showCaseModal, setShowCaseModal] = useState(false);
  const [editingCaseId, setEditingCaseId] = useState<string | null>(null);

  const [showLinkCmsModal, setShowLinkCmsModal] = useState(false);
  const [linkTargetCaseId, setLinkTargetCaseId] = useState<string | null>(null);
  const [linkAuditReason, setLinkAuditReason] = useState("");
  const [linkCmsId, setLinkCmsId] = useState("");

  const [voidEntryId, setVoidEntryId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState("");

  // Print Mode State
  const [printType, setPrintType] = useState<"ack" | "ledger" | "report" | null>(null);
  const [printAckEntryId, setPrintAckEntryId] = useState<string | null>(null);

  // Form Fields: Client Form
  const [cSeriesId, setCSeriesId] = useState("");
  const [cCode, setCCode] = useState("");
  const [cName, setCName] = useState("");
  const [cCity, setCCity] = useState("");
  const [cEmail, setCEmail] = useState("");
  const [cPhone, setCPhone] = useState("");
  const [cHeader, setCHeader] = useState("0");
  const [cRateS1, setCRateS1] = useState("10000");
  const [cRateS2, setCRateS2] = useState("15000");
  const [cRateS3, setCRateS3] = useState("20000");
  const [cRateS4, setCRateS4] = useState("25000");
  const [clientFormError, setClientFormError] = useState("");

  // Form Fields: Series Form
  const [sCode, setSCode] = useState("");
  const [sName, setSName] = useState("");
  const [sPrefix, setSPrefix] = useState("");
  const [sSort, setSSort] = useState("50");
  const [seriesFormError, setSeriesFormError] = useState("");

  // Form Fields: Charge Form
  const [chClientId, setChClientId] = useState("");
  const [chTM, setChTM] = useState("");
  const [chFolder, setChFolder] = useState("");
  const [chAppName, setChAppName] = useState("");
  const [chStage, setChStage] = useState<"S1" | "S2" | "S3" | "S4">("S1");
  const [chAmount, setChAmount] = useState("10000");
  const [chDetails, setChDetails] = useState("");
  const [chDate, setChDate] = useState(new Date().toISOString().slice(0, 10));
  const [chTmMatchInfo, setChTmMatchInfo] = useState<string | null>(null);
  const [chargeFormError, setChargeFormError] = useState("");

  // Form Fields: Receiving Form
  const [rcClientId, setRcClientId] = useState("");
  const [rcTM, setRcTM] = useState("");
  const [rcStage, setRcStage] = useState<string>("");
  const [rcAmount, setRcAmount] = useState("");
  const [rcMethod, setRcMethod] = useState("Cash");
  const [rcBankDate, setRcBankDate] = useState(new Date().toISOString().slice(0, 10));
  const [rcDate, setRcDate] = useState(new Date().toISOString().slice(0, 10));
  const [rcLinkedChargeId, setRcLinkedChargeId] = useState("");
  const [rcNotes, setRcNotes] = useState("");
  const [rcTmMatchInfo, setRcTmMatchInfo] = useState<string | null>(null);
  const [receivingFormError, setReceivingFormError] = useState("");

  // Form Fields: Case Form
  const [csClientId, setCsClientId] = useState("");
  const [csTM, setCsTM] = useState("");
  const [csFolder, setCsFolder] = useState("");
  const [csAppName, setCsAppName] = useState("");
  const [csCaseRef, setCsCaseRef] = useState("");
  const [csNotes, setCsNotes] = useState("");
  const [caseFormError, setCaseFormError] = useState("");

  // ==========================================
  // QUERIES
  // ==========================================

  // 1. Series
  const seriesQuery = useQuery({
    queryKey: ["ledger_series"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ledger_series").select("*").order("sort_order");
      if (error) throw new Error("Could not load series: " + error.message);
      return (data ?? []) as LedgerSeries[];
    },
  });

  // 2. Clients
  const clientsQuery = useQuery({
    queryKey: ["ledger_clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ledger_clients")
        .select("*, ledger_series(*)")
        .order("client_code");
      if (error) throw new Error("Could not load clients: " + error.message);
      return (data ?? []) as LedgerClient[];
    },
  });

  // 3. Stage Rates for all clients
  const ratesQuery = useQuery({
    queryKey: ["ledger_client_stage_rates"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ledger_client_stage_rates").select("*");
      if (error) return [];
      return (data ?? []) as LedgerStageRate[];
    },
  });

  // 4. All Ledger Entries
  const entriesQuery = useQuery({
    queryKey: ["ledger_entries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ledger_entries")
        .select(
          "*, ledger_clients(client_code, client_name, city, phone, email), ledger_cases(id, tm_no, folder_no, application_name)"
        )
        .order("entry_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw new Error("Could not load ledger entries: " + error.message);
      return (data ?? []) as LedgerEntry[];
    },
  });

  // 5. All Ledger Cases
  const casesQuery = useQuery({
    queryKey: ["ledger_cases"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ledger_cases")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw new Error("Could not load cases: " + error.message);
      return (data ?? []) as LedgerCase[];
    },
  });

  // 6. CMS Trademarks for linking and quick-fill suggestions
  const cmsTrademarksQuery = useQuery({
    queryKey: ["cms_trademarks_summary"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trademarks")
        .select(
          "id, tm_number, tm_cpr_number_norm, trademark_name, client_code, client, city, stage_status, file_number, class_number"
        )
        .limit(1000);
      if (error) return [];
      return data || [];
    },
    staleTime: 60_000,
  });

  // ==========================================
  // COMPUTED DATA & BALANCES
  // ==========================================

  const seriesList = seriesQuery.data || [];
  const clientsList = clientsQuery.data || [];
  const entriesList = entriesQuery.data || [];
  const casesList = casesQuery.data || [];
  const ratesList = ratesQuery.data || [];
  const cmsTrademarks = cmsTrademarksQuery.data || [];

  // Rates lookup: [client_id][stage] => amount
  const clientRatesMap = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    for (const r of ratesList) {
      if (!map[r.client_id]) map[r.client_id] = {};
      map[r.client_id][r.stage] = Number(r.amount);
    }
    return map;
  }, [ratesList]);

  // Overall Financial Totals
  const activeEntries = useMemo(() => entriesList.filter((e) => !e.voided_at), [entriesList]);
  const totalDue = useMemo(
    () =>
      activeEntries
        .filter((e) => e.entry_type === "charge")
        .reduce((sum, e) => sum + Number(e.amount_due || 0), 0),
    [activeEntries]
  );
  const totalReceived = useMemo(
    () =>
      activeEntries
        .filter((e) => e.entry_type === "receiving")
        .reduce((sum, e) => sum + Number(e.amount_received || 0), 0),
    [activeEntries]
  );
  const totalOutstanding = totalDue - totalReceived;

  const todayCount = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    return entriesList.filter((e) => e.entry_date === todayStr).length;
  }, [entriesList]);

  // Client Balance & Case Count Lookup
  const clientStats = useMemo(() => {
    const stats: Record<
      string,
      { due: number; received: number; balance: number; entriesCount: number; casesCount: number }
    > = {};

    for (const c of clientsList) {
      stats[c.id] = {
        due: 0,
        received: 0,
        balance: Number(c.header_balance || 0),
        entriesCount: 0,
        casesCount: 0,
      };
    }

    for (const e of activeEntries) {
      if (!stats[e.client_id]) {
        stats[e.client_id] = { due: 0, received: 0, balance: 0, entriesCount: 0, casesCount: 0 };
      }
      stats[e.client_id].entriesCount++;
      if (e.entry_type === "charge") stats[e.client_id].due += Number(e.amount_due || 0);
      if (e.entry_type === "receiving") stats[e.client_id].received += Number(e.amount_received || 0);
      stats[e.client_id].balance = stats[e.client_id].due - stats[e.client_id].received;
    }

    const casesByClient: Record<string, Set<string>> = {};
    for (const cs of casesList) {
      if (!casesByClient[cs.client_id]) casesByClient[cs.client_id] = new Set();
      casesByClient[cs.client_id].add(cs.id);
    }
    for (const cid of Object.keys(stats)) {
      stats[cid].casesCount = casesByClient[cid]?.size || 0;
    }

    return stats;
  }, [clientsList, activeEntries, casesList]);

  // Last 6 Months Chart Data
  const monthlyChartData = useMemo(() => {
    const months: Array<{ key: string; label: string; charges: number; receivings: number }> = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toISOString().slice(0, 7); // YYYY-MM
      const label = d.toLocaleString("en-US", { month: "short", year: "2-digit" }).toUpperCase();
      months.push({ key, label, charges: 0, receivings: 0 });
    }

    for (const e of activeEntries) {
      const mKey = (e.entry_date || "").slice(0, 7);
      const target = months.find((m) => m.key === mKey);
      if (target) {
        if (e.entry_type === "charge") target.charges += Number(e.amount_due || 0);
        if (e.entry_type === "receiving") target.receivings += Number(e.amount_received || 0);
      }
    }

    const maxVal = Math.max(...months.map((m) => Math.max(m.charges, m.receivings)), 1000);
    return { months, maxVal };
  }, [activeEntries]);

  // Active Client
  const activeClient = useMemo(
    () => clientsList.find((c) => c.id === activeClientId) || null,
    [clientsList, activeClientId]
  );

  // Active Client Cases
  const activeClientCases = useMemo(() => {
    if (!activeClientId) return [];
    return casesList.filter((cs) => cs.client_id === activeClientId);
  }, [casesList, activeClientId]);

  // Case Stage Totals for Active Client
  const caseStageTotals = useMemo(() => {
    const totals: Record<
      string,
      Record<"S1" | "S2" | "S3" | "S4", { due: number; received: number; outstanding: number; paid: boolean }>
    > = {};

    const clientEntries = activeEntries.filter((e) => e.client_id === activeClientId && e.case_id);

    for (const cs of activeClientCases) {
      totals[cs.id] = {
        S1: { due: 0, received: 0, outstanding: 0, paid: false },
        S2: { due: 0, received: 0, outstanding: 0, paid: false },
        S3: { due: 0, received: 0, outstanding: 0, paid: false },
        S4: { due: 0, received: 0, outstanding: 0, paid: false },
      };

      const cEntries = clientEntries.filter((e) => e.case_id === cs.id);
      for (const st of ["S1", "S2", "S3", "S4"] as const) {
        const stageCharges = cEntries
          .filter((e) => e.entry_type === "charge" && e.stage === st)
          .reduce((sum, e) => sum + Number(e.amount_due || 0), 0);
        const stageReceipts = cEntries
          .filter((e) => e.entry_type === "receiving" && e.stage === st)
          .reduce((sum, e) => sum + Number(e.amount_received || 0), 0);

        totals[cs.id][st] = {
          due: stageCharges,
          received: stageReceipts,
          outstanding: Math.max(0, stageCharges - stageReceipts),
          paid: stageCharges > 0 && stageReceipts >= stageCharges,
        };
      }
    }

    return totals;
  }, [activeClientId, activeClientCases, activeEntries]);

  // Active Client 4-Stage Summary
  const stageOutstandingSummary = useMemo(() => {
    const summary = {
      S1: { due: 0, received: 0, outstanding: 0 },
      S2: { due: 0, received: 0, outstanding: 0 },
      S3: { due: 0, received: 0, outstanding: 0 },
      S4: { due: 0, received: 0, outstanding: 0 },
    };
    if (!activeClientId) return summary;

    const filteredCases = ledgerCaseFilter
      ? activeClientCases.filter((c) => c.id === ledgerCaseFilter)
      : activeClientCases;

    for (const cs of filteredCases) {
      const cTotals = caseStageTotals[cs.id];
      if (cTotals) {
        for (const st of ["S1", "S2", "S3", "S4"] as const) {
          summary[st].due += cTotals[st].due;
          summary[st].received += cTotals[st].received;
          summary[st].outstanding += cTotals[st].outstanding;
        }
      }
    }
    return summary;
  }, [activeClientId, activeClientCases, ledgerCaseFilter, caseStageTotals]);

  // Filtered Client Ledger Entries
  const activeClientEntries = useMemo(() => {
    if (!activeClientId) return [];
    let list = entriesList.filter((e) => e.client_id === activeClientId);

    if (ledgerCaseFilter) {
      list = list.filter((e) => e.case_id === ledgerCaseFilter);
    }
    if (ledgerDateFrom) {
      list = list.filter((e) => (e.entry_date || "") >= ledgerDateFrom);
    }
    if (ledgerDateTo) {
      list = list.filter((e) => (e.entry_date || "") <= ledgerDateTo);
    }

    list = [...list].sort(
      (a, b) =>
        (b.entry_date || "").localeCompare(a.entry_date || "") ||
        (b.created_at || "").localeCompare(a.created_at || "")
    );

    if (currentViewModeLast6) {
      list = list.slice(0, 6);
    }

    return list;
  }, [entriesList, activeClientId, ledgerCaseFilter, ledgerDateFrom, ledgerDateTo, currentViewModeLast6]);

  // Filtered Cases in the Case Table
  const filteredActiveCases = useMemo(() => {
    let list = activeClientCases;
    const q = caseSearchQuery.trim().toUpperCase();
    if (q) {
      list = list.filter((c) =>
        [c.tm_no, c.folder_no, c.application_name, c.case_ref].some((v) =>
          String(v || "").toUpperCase().includes(q)
        )
      );
    }
    if (caseStageFilter) {
      list = list.filter((c) => {
        const st = caseStageTotals[c.id]?.[caseStageFilter as "S1" | "S2" | "S3" | "S4"];
        return st && st.due > 0;
      });
    }
    if (caseStatusFilter) {
      list = list.filter((c) => {
        const cTotals = caseStageTotals[c.id];
        if (!cTotals) return false;
        const activeStages = (["S1", "S2", "S3", "S4"] as const).filter((st) => cTotals[st].due > 0);
        if (caseStatusFilter === "PAID") {
          return activeStages.length > 0 && activeStages.every((st) => cTotals[st].paid);
        }
        if (caseStatusFilter === "DUE") {
          return activeStages.some((st) => !cTotals[st].paid);
        }
        return true;
      });
    }
    return list;
  }, [activeClientCases, caseSearchQuery, caseStageFilter, caseStatusFilter, caseStageTotals]);

  // Filtered Client Directory
  const filteredClients = useMemo(() => {
    let list = clientsList;
    if (selectedSeriesFilter) {
      list = list.filter((c) => c.series_id === selectedSeriesFilter);
    }
    const q = clientSearch.trim().toLowerCase();
    if (q) {
      list = list.filter((c) =>
        [c.client_code, c.client_name, c.city, c.phone, c.email].some((v) =>
          String(v || "").toLowerCase().includes(q)
        )
      );
    }
    return list;
  }, [clientsList, selectedSeriesFilter, clientSearch]);

  // Grouped by Series for Client Directory
  const groupedClients = useMemo(() => {
    const groups: Record<
      string,
      { seriesCode: string; seriesName: string; clients: LedgerClient[] }
    > = {};

    for (const c of filteredClients) {
      const s = seriesList.find((item) => item.id === c.series_id) || c.ledger_series;
      const code = s?.code || "UNGROUPED";
      const name = s?.name || "General Accounts";
      if (!groups[code]) groups[code] = { seriesCode: code, seriesName: name, clients: [] };
      groups[code].clients.push(c);
    }

    return Object.keys(groups)
      .sort()
      .map((k) => groups[k]);
  }, [filteredClients, seriesList]);

  // CMS Client Suggestions (Distinct from CMS Trademarks)
  const cmsSuggestions = useMemo(() => {
    const map = new Map<string, { code: string; name: string; city: string }>();
    for (const t of cmsTrademarks) {
      const code = String(t.client_code || "").trim().toUpperCase();
      if (code && !map.has(code)) {
        map.set(code, {
          code,
          name: String(t.client || "").trim(),
          city: String(t.city || "").trim(),
        });
      }
    }
    return Array.from(map.values()).slice(0, 8);
  }, [cmsTrademarks]);

  // Reports Filtered Data
  const reportsData = useMemo(() => {
    let list = activeEntries;
    if (reportClientId) list = list.filter((e) => e.client_id === reportClientId);
    if (reportDateFrom) list = list.filter((e) => (e.entry_date || "") >= reportDateFrom);
    if (reportDateTo) list = list.filter((e) => (e.entry_date || "") <= reportDateTo);

    const charges = list
      .filter((e) => e.entry_type === "charge")
      .reduce((s, e) => s + Number(e.amount_due || 0), 0);
    const receivings = list
      .filter((e) => e.entry_type === "receiving")
      .reduce((s, e) => s + Number(e.amount_received || 0), 0);
    const balance = charges - receivings;

    const stagesBreakdown: Record<string, { charges: number; receivings: number }> = {
      S1: { charges: 0, receivings: 0 },
      S2: { charges: 0, receivings: 0 },
      S3: { charges: 0, receivings: 0 },
      S4: { charges: 0, receivings: 0 },
      General: { charges: 0, receivings: 0 },
    };

    for (const e of list) {
      const st = e.stage || "General";
      if (!stagesBreakdown[st]) stagesBreakdown[st] = { charges: 0, receivings: 0 };
      if (e.entry_type === "charge") stagesBreakdown[st].charges += Number(e.amount_due || 0);
      if (e.entry_type === "receiving") stagesBreakdown[st].receivings += Number(e.amount_received || 0);
    }

    return { entries: list, charges, receivings, balance, stagesBreakdown };
  }, [activeEntries, reportClientId, reportDateFrom, reportDateTo]);

  // ==========================================
  // MUTATIONS & ACTIONS
  // ==========================================

  // Save Client Mutation (New or Edit)
  const saveClientMutation = useMutation({
    mutationFn: async () => {
      const code = cCode.trim().toUpperCase();
      const name = cName.trim();
      if (!code) throw new Error("Client code is required (e.g. A-001).");
      if (!name) throw new Error("Client name is required.");

      const rates = {
        S1: Number(cRateS1 || 0),
        S2: Number(cRateS2 || 0),
        S3: Number(cRateS3 || 0),
        S4: Number(cRateS4 || 0),
      };

      if (editingClientId) {
        await updateLedgerClient({
          id: editingClientId,
          clientCode: code,
          clientName: name,
          seriesId: cSeriesId || null,
          city: cCity.trim() || undefined,
          email: cEmail.trim() || undefined,
          phone: cPhone.trim() || undefined,
          headerBalance: Number(cHeader) || 0,
          rates,
        });
        return editingClientId;
      } else {
        const res = await createLedgerClient({
          clientCode: code,
          clientName: name,
          city: cCity.trim() || undefined,
          email: cEmail.trim() || undefined,
          phone: cPhone.trim() || undefined,
          notes: `Series: ${cSeriesId || "None"}`,
          rates,
        });
        if (cSeriesId && res.id) {
          await supabase.from("ledger_clients").update({ series_id: cSeriesId }).eq("id", res.id);
        }
        return res.id;
      }
    },
    onSuccess: async (clientId) => {
      setClientFormError("");
      setShowClientModal(false);
      setEditingClientId(null);
      await queryClient.invalidateQueries({ queryKey: ["ledger_clients"] });
      await queryClient.invalidateQueries({ queryKey: ["ledger_client_stage_rates"] });
      if (clientId) {
        setActiveClientId(clientId);
        setCurrentPage("ledger");
      }
    },
    onError: (err: Error) => setClientFormError(err.message),
  });

  // Save Series Mutation
  const saveSeriesMutation = useMutation({
    mutationFn: async () => {
      if (!sCode.trim()) throw new Error("Series code is required (e.g. A, X, B).");
      if (!sName.trim()) throw new Error("Series name is required.");
      return await createLedgerSeries({
        code: sCode,
        name: sName,
        prefix: sPrefix || `${sCode.toUpperCase()}-`,
        sortOrder: Number(sSort) || 50,
      });
    },
    onSuccess: async () => {
      setSeriesFormError("");
      setShowSeriesModal(false);
      setSCode("");
      setSName("");
      setSPrefix("");
      await queryClient.invalidateQueries({ queryKey: ["ledger_series"] });
    },
    onError: (err: Error) => setSeriesFormError(err.message),
  });

  // Save Charge Mutation (Add Record)
  const saveChargeMutation = useMutation({
    mutationFn: async () => {
      if (!chClientId) throw new Error("Client is required.");
      const amt = Number(chAmount);
      if (!amt || amt <= 0) throw new Error("Amount must be greater than zero.");

      let targetCaseId: string | null = null;
      const tmTrim = chTM.trim();
      const tmNorm = tmTrim ? tmTrim.replace(/\D/g, "") : null;

      if (tmNorm) {
        // Find or create case
        const existingCase = casesList.find(
          (c) => c.client_id === chClientId && c.tm_no_normalized === tmNorm
        );
        if (existingCase) {
          targetCaseId = existingCase.id;
          if (chAppName && !existingCase.application_name) {
            await updateLedgerCase({ id: existingCase.id, applicationName: chAppName });
          }
        } else {
          // Check if CMS trademark exists for auto-link
          const matchingCms = cmsTrademarks.find((t) => t.tm_cpr_number_norm === tmNorm);
          const newCase = await createLedgerCase({
            clientId: chClientId,
            tmNo: tmTrim,
            folderNo: chFolder.trim() || undefined,
            applicationName: chAppName.trim() || undefined,
            cmsTrademarkId: matchingCms?.id,
            linkReason: matchingCms?.id ? "Auto-linked during charge creation" : undefined,
          });
          targetCaseId = newCase.id;
        }
      }

      return await recordLedgerCharge({
        clientId: chClientId,
        caseId: targetCaseId || undefined,
        stage: chStage,
        amount: amt,
        entryDate: chDate || new Date().toISOString().slice(0, 10),
        details: chDetails.trim() || `${chStage} fee`,
      });
    },
    onSuccess: async () => {
      setChargeFormError("");
      setShowChargeModal(false);
      setChTM("");
      setChFolder("");
      setChAppName("");
      setChDetails("");
      setChTmMatchInfo(null);
      await queryClient.invalidateQueries({ queryKey: ["ledger_entries"] });
      await queryClient.invalidateQueries({ queryKey: ["ledger_cases"] });
    },
    onError: (err: Error) => setChargeFormError(err.message),
  });

  // Save Receiving Mutation (Add Payment)
  const saveReceivingMutation = useMutation({
    mutationFn: async () => {
      if (!rcClientId) throw new Error("Client is required.");
      const amt = Number(rcAmount);
      if (!amt || amt <= 0) throw new Error("Amount must be greater than zero.");

      let targetCaseId: string | null = null;
      const tmTrim = rcTM.trim();
      const tmNorm = tmTrim ? tmTrim.replace(/\D/g, "") : null;

      if (tmNorm) {
        const existingCase = casesList.find(
          (c) => c.client_id === rcClientId && c.tm_no_normalized === tmNorm
        );
        if (existingCase) {
          targetCaseId = existingCase.id;
        } else {
          const matchingCms = cmsTrademarks.find((t) => t.tm_cpr_number_norm === tmNorm);
          const newCase = await createLedgerCase({
            clientId: rcClientId,
            tmNo: tmTrim,
            cmsTrademarkId: matchingCms?.id,
            linkReason: matchingCms?.id ? "Auto-linked during receiving creation" : undefined,
          });
          targetCaseId = newCase.id;
        }
      }

      let details = rcNotes.trim() || "Payment received";
      if (rcBankDate && rcMethod !== "Cash") {
        details += ` · Transfer date: ${rcBankDate}`;
      }

      return await recordLedgerReceiving({
        clientId: rcClientId,
        caseId: targetCaseId || null,
        stage: rcStage || null,
        amount: amt,
        paymentMethod: rcMethod,
        entryDate: rcDate || new Date().toISOString().slice(0, 10),
        details,
        linkedEntryId: rcLinkedChargeId || null,
      });
    },
    onSuccess: async (data) => {
      setReceivingFormError("");
      setShowReceivingModal(false);
      setRcTM("");
      setRcAmount("");
      setRcNotes("");
      setRcLinkedChargeId("");
      setRcTmMatchInfo(null);
      await queryClient.invalidateQueries({ queryKey: ["ledger_entries"] });
      await queryClient.invalidateQueries({ queryKey: ["ledger_cases"] });
      // Trigger Print Ack prompt
      if (data?.id) {
        setPrintAckEntryId(data.id);
        setPrintType("ack");
      }
    },
    onError: (err: Error) => setReceivingFormError(err.message),
  });

  // Save Case Mutation (New or Edit)
  const saveCaseMutation = useMutation({
    mutationFn: async () => {
      const clientId = csClientId || activeClientId;
      if (!clientId) throw new Error("Client is required.");

      if (editingCaseId) {
        await updateLedgerCase({
          id: editingCaseId,
          tmNo: csTM,
          folderNo: csFolder,
          applicationName: csAppName,
          caseRef: csCaseRef,
          notes: csNotes,
        });
      } else {
        await createLedgerCase({
          clientId,
          tmNo: csTM,
          folderNo: csFolder,
          applicationName: csAppName,
          caseRef: csCaseRef,
          notes: csNotes,
        });
      }
    },
    onSuccess: async () => {
      setCaseFormError("");
      setShowCaseModal(false);
      setEditingCaseId(null);
      setCsTM("");
      setCsFolder("");
      setCsAppName("");
      setCsCaseRef("");
      setCsNotes("");
      await queryClient.invalidateQueries({ queryKey: ["ledger_cases"] });
    },
    onError: (err: Error) => setCaseFormError(err.message),
  });

  // Link CMS Trademark Mutation
  const linkCmsMutation = useMutation({
    mutationFn: async () => {
      if (!linkTargetCaseId) throw new Error("No target ledger case selected.");
      if (!linkCmsId) throw new Error("No CMS trademark selected.");
      if (!linkAuditReason.trim() || linkAuditReason.trim().length < 3) {
        throw new Error("Audit reason (min 3 chars) is required to authorize the link.");
      }
      return await linkCaseToCmsTrademark(linkTargetCaseId, linkCmsId, linkAuditReason);
    },
    onSuccess: async () => {
      setShowLinkCmsModal(false);
      setLinkTargetCaseId(null);
      setLinkCmsId("");
      setLinkAuditReason("");
      await queryClient.invalidateQueries({ queryKey: ["ledger_cases"] });
    },
    onError: (err: Error) => alert("Could not link CMS Trademark: " + err.message),
  });

  // Void Mutation
  const voidMutation = useMutation({
    mutationFn: async () => {
      if (!voidEntryId) throw new Error("No entry selected.");
      if (!voidReason.trim() || voidReason.trim().length < 3) {
        throw new Error("Audit void reason (min 3 chars) is required.");
      }
      return await voidClientReceipt(voidEntryId, voidReason.trim().toUpperCase());
    },
    onSuccess: async () => {
      setVoidEntryId(null);
      setVoidReason("");
      await queryClient.invalidateQueries({ queryKey: ["ledger_entries"] });
    },
    onError: (err: Error) => alert("Could not void entry: " + err.message),
  });

  // ==========================================
  // HELPERS FOR TM LOOKUPS & PRINTING
  // ==========================================

  const handleLookupTm = async (prefix: "ch" | "rc", tmValue: string) => {
    const res = await lookupCaseOrTrademarkByTm(tmValue);
    if (!res.normalizedTm) {
      if (prefix === "ch") setChTmMatchInfo(null);
      else setRcTmMatchInfo(null);
      return;
    }

    if (res.ledgerCase) {
      const matchText = `MATCH: Case ${res.ledgerCase.tm_no} · ${res.ledgerCase.application_name || "Application"} (Client: ${res.ledgerCase.client_code || "Linked"})`;
      if (prefix === "ch") {
        setChTmMatchInfo(matchText);
        if (res.ledgerCase.client_id && !chClientId) setChClientId(res.ledgerCase.client_id);
        if (res.ledgerCase.application_name && !chAppName) setChAppName(res.ledgerCase.application_name);
        if (res.ledgerCase.folder_no && !chFolder) setChFolder(res.ledgerCase.folder_no);
      } else {
        setRcTmMatchInfo(matchText);
        if (res.ledgerCase.client_id && !rcClientId) setRcClientId(res.ledgerCase.client_id);
      }
    } else if (res.cmsTrademark) {
      const matchText = `CMS FOUND: TM ${res.cmsTrademark.tm_number} · ${res.cmsTrademark.trademark_name} (${res.cmsTrademark.stage_status || "Active"})`;
      if (prefix === "ch") {
        setChTmMatchInfo(matchText);
        if (res.cmsTrademark.trademark_name && !chAppName) setChAppName(res.cmsTrademark.trademark_name);
        if (res.cmsTrademark.file_number && !chFolder) setChFolder(res.cmsTrademark.file_number);
        // Find client if matching client_code exists
        if (res.cmsTrademark.client_code && !chClientId) {
          const matchClient = clientsList.find(
            (c) => c.client_code.toUpperCase() === res.cmsTrademark!.client_code!.toUpperCase()
          );
          if (matchClient) setChClientId(matchClient.id);
        }
      } else {
        setRcTmMatchInfo(matchText);
        if (res.cmsTrademark.client_code && !rcClientId) {
          const matchClient = clientsList.find(
            (c) => c.client_code.toUpperCase() === res.cmsTrademark!.client_code!.toUpperCase()
          );
          if (matchClient) setRcClientId(matchClient.id);
        }
      }
    } else {
      const info = `No case found for TM ${res.normalizedTm} — will create on save`;
      if (prefix === "ch") setChTmMatchInfo(info);
      else setRcTmMatchInfo(info);
    }
  };

  const handleOpenEditClient = (client: LedgerClient) => {
    setEditingClientId(client.id);
    setCSeriesId(client.series_id || "");
    setCCode(client.client_code);
    setCName(client.client_name || "");
    setCCity(client.city || "");
    setCEmail(client.email || "");
    setCPhone(client.phone || "");
    setCHeader(String(client.header_balance || 0));
    const rates = clientRatesMap[client.id] || {};
    setCRateS1(String(rates.S1 ?? 10000));
    setCRateS2(String(rates.S2 ?? 15000));
    setCRateS3(String(rates.S3 ?? 20000));
    setCRateS4(String(rates.S4 ?? 25000));
    setShowClientModal(true);
  };

  const handleOpenNewClient = () => {
    setEditingClientId(null);
    setCSeriesId(seriesList[0]?.id || "");
    setCCode("");
    setCName("");
    setCCity("");
    setCEmail("");
    setCPhone("");
    setCHeader("0");
    setCRateS1("10000");
    setCRateS2("15000");
    setCRateS3("20000");
    setCRateS4("25000");
    setShowClientModal(true);
  };

  const handleOpenEditCase = (cs: LedgerCase) => {
    setEditingCaseId(cs.id);
    setCsClientId(cs.client_id);
    setCsTM(cs.tm_no || "");
    setCsFolder(cs.folder_no || "");
    setCsAppName(cs.application_name || "");
    setCsCaseRef(cs.case_ref || "");
    setCsNotes(cs.notes || "");
    setShowCaseModal(true);
  };

  const handleOpenNewCase = () => {
    setEditingCaseId(null);
    setCsClientId(activeClientId || "");
    setCsTM("");
    setCsFolder("");
    setCsAppName("");
    setCsCaseRef("");
    setCsNotes("");
    setShowCaseModal(true);
  };

  const handleExportCsv = (entriesToExport: LedgerEntry[], filename: string) => {
    const headers = ["Date", "Client Code", "Type", "Stage", "Case / TM", "Details", "Due", "Received", "Receipt No", "Notes"];
    const rows = entriesToExport.map((e) => [
      e.entry_date || "",
      e.ledger_clients?.client_code || "",
      e.entry_type + (e.voided_at ? " (VOIDED)" : ""),
      e.stage || "General",
      `"${(e.ledger_cases?.tm_no || e.ledger_cases?.application_name || "").replace(/"/g, '""')}"`,
      `"${(e.details || "").replace(/"/g, '""')}"`,
      e.amount_due ? Number(e.amount_due).toFixed(2) : "0.00",
      e.amount_received ? Number(e.amount_received).toFixed(2) : "0.00",
      e.receipt_no || "",
      `"${(e.notes || e.void_reason || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const printAreaContent = useMemo(() => {
    if (!printType) return null;

    if (printType === "ack" && printAckEntryId) {
      const entry = entriesList.find((e) => e.id === printAckEntryId);
      if (!entry) return null;
      const client = entry.ledger_clients || clientsList.find((c) => c.id === entry.client_id);
      const caseItem = entry.ledger_cases || casesList.find((c) => c.id === entry.case_id);

      const renderCopy = (label: string) => (
        <div className="ack-page border-4 border-[#8B3A00] bg-white p-6 text-black mb-8">
          <div className="flex items-center justify-between border-b-2 border-[#8B3A00] pb-4">
            <div className="flex items-center gap-4">
              <img src="/brandex-logo-15.png" alt="Brandex" className="h-12 w-12 object-contain" />
              <div>
                <h1 className="font-serif text-2xl font-bold uppercase tracking-wider text-[#8B3A00]">
                  BRANDEX LAW ASSOCIATES
                </h1>
                <p className="font-mono text-xs font-bold text-[#C94A00]">TRADEMARK REGISTRY ATTORNEYS</p>
                <p className="font-mono text-[11px] text-stone-600">info@brandex.pk · brandex.pk</p>
              </div>
            </div>
            <div className="text-right">
              <span className="inline-block border-2 border-black bg-[#C94A00] px-3 py-1 font-mono text-xs font-bold uppercase text-white shadow-[2px_2px_0_#0C0C0C]">
                {label}
              </span>
              <p className="mt-2 font-mono text-xs font-bold">RECEIPT: {entry.receipt_no || "REC-" + entry.id.slice(0, 8)}</p>
            </div>
          </div>

          <div className="my-4 grid grid-cols-2 gap-4 border-b pb-4 text-xs">
            <div>
              <p className="font-mono font-bold uppercase text-stone-500">Client Information</p>
              <p className="text-base font-bold uppercase">{client?.client_code} · {client?.client_name || "Client"}</p>
              <p className="text-stone-600">{client?.phone || "Phone not provided"} · {client?.email || "Email not provided"}</p>
              <p className="text-stone-600">{client?.city || "Head Office"}</p>
            </div>
            <div>
              <p className="font-mono font-bold uppercase text-stone-500">Matter / Trademark</p>
              <p className="text-base font-bold font-mono">TM: {caseItem?.tm_no || "General / Client Account"}</p>
              <p className="text-stone-600">Application: {caseItem?.application_name || "Matter"}</p>
              <p className="font-bold text-[#C94A00]">{entry.stage ? `STAGE: ${entry.stage}` : "General Client Receiving"}</p>
            </div>
          </div>

          <div className="my-4 space-y-2 border-b pb-4 text-xs font-mono">
            <div className="flex justify-between border-b py-1">
              <span>Entry Date:</span>
              <span className="font-bold">{shortDate(entry.entry_date)}</span>
            </div>
            <div className="flex justify-between border-b py-1">
              <span>Payment Method:</span>
              <span className="font-bold uppercase">{entry.payment_method || "Cash"}</span>
            </div>
            <div className="flex justify-between border-b py-1">
              <span>Transaction Details:</span>
              <span>{entry.details || "Payment received"}</span>
            </div>
            <div className="flex justify-between bg-stone-100 p-2 text-base font-bold">
              <span>AMOUNT RECEIVED:</span>
              <span className="text-[#0A6B52]">PKR {fmt(entry.amount_received)}</span>
            </div>
          </div>

          {/* Bank Accounts Section */}
          <div className="my-4 border border-stone-300 p-3 text-[11px]">
            <p className="font-mono font-bold uppercase text-[#8B3A00] mb-2">Designated Bank Accounts & Digital Wallets</p>
            <div className="grid grid-cols-2 gap-3 font-mono">
              {BRAND_BANKS.map((b) => (
                <div key={b.name} className="border border-stone-200 p-2 bg-stone-50">
                  <p className="font-bold text-stone-800">{b.name}</p>
                  <p>Title: {b.title}</p>
                  <p>A/C: {b.account}</p>
                  <p>IBAN: {b.iban}</p>
                </div>
              ))}
              {BRAND_WALLETS.map((w) => (
                <div key={w.name} className="border border-stone-200 p-2 bg-stone-50">
                  <p className="font-bold text-stone-800">{w.name}</p>
                  <p>Title: {w.title}</p>
                  <p>Number: {w.account}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 flex justify-between pt-6 text-xs font-mono">
            <div className="text-center border-t-2 border-stone-400 pt-1 w-44">Received by (Brandex)</div>
            <div className="text-center border-t-2 border-stone-400 pt-1 w-44">Client / Authorized Bearer</div>
          </div>
          <p className="mt-6 text-center text-[10px] text-stone-500 font-mono">Thank you · Brandex Law Associates · brandex.pk</p>
        </div>
      );

      return (
        <div id="printArea">
          {renderCopy("OFFICE COPY")}
          <div className="page-break" style={{ pageBreakAfter: "always" }} />
          {renderCopy("CLIENT COPY")}
        </div>
      );
    }

    if (printType === "ledger" && activeClient) {
      const rows = selectedEntryIds.length
        ? activeClientEntries.filter((e) => selectedEntryIds.includes(e.id))
        : activeClientEntries;

      return (
        <div id="printArea" className="bg-white p-6 text-black text-xs font-sans">
          <div className="border-b-4 border-[#8B3A00] pb-4 mb-4 flex justify-between items-end">
            <div>
              <h1 className="font-serif text-3xl font-bold uppercase text-[#8B3A00]">BRANDEX LAW ASSOCIATES</h1>
              <p className="font-mono text-xs font-bold text-[#C94A00]">CLIENT STATEMENT OF ACCOUNT</p>
            </div>
            <div className="text-right font-mono">
              <p className="text-lg font-bold uppercase">{activeClient.client_code}</p>
              <p className="font-bold">{activeClient.client_name}</p>
              <p className="text-stone-600">{activeClient.city} · {activeClient.phone}</p>
            </div>
          </div>

          <div className="mb-4 grid grid-cols-3 gap-3 border p-3 font-mono">
            <div>Opening Balance: PKR {fmt(activeClient.header_balance)}</div>
            <div>Total Charges: PKR {fmt(totalDue)}</div>
            <div className="font-bold text-[#0A6B52]">Outstanding: PKR {fmt(totalOutstanding)}</div>
          </div>

          <table className="w-full border-collapse border border-black text-left">
            <thead>
              <tr className="bg-stone-200 font-mono uppercase text-[10px]">
                <th className="border border-black p-2">Date</th>
                <th className="border border-black p-2">Type</th>
                <th className="border border-black p-2">Stage</th>
                <th className="border border-black p-2">Case / Matter</th>
                <th className="border border-black p-2">Details</th>
                <th className="border border-black p-2 text-right">Due (PKR)</th>
                <th className="border border-black p-2 text-right">Received (PKR)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={r.voided_at ? "opacity-50 line-through" : ""}>
                  <td className="border border-black p-2 font-mono">{shortDate(r.entry_date)}</td>
                  <td className="border border-black p-2 font-bold uppercase">{r.entry_type}</td>
                  <td className="border border-black p-2 font-mono">{r.stage || "—"}</td>
                  <td className="border border-black p-2">{r.ledger_cases?.tm_no || r.ledger_cases?.application_name || "—"}</td>
                  <td className="border border-black p-2">{r.details || ""}</td>
                  <td className="border border-black p-2 text-right font-mono">{r.amount_due ? fmt(r.amount_due) : ""}</td>
                  <td className="border border-black p-2 text-right font-mono">{r.amount_received ? fmt(r.amount_received) : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (printType === "report") {
      return (
        <div id="printArea" className="bg-white p-6 text-black text-xs font-sans">
          <div className="border-b-4 border-[#8B3A00] pb-4 mb-4 flex justify-between items-end">
            <div>
              <h1 className="font-serif text-3xl font-bold uppercase text-[#8B3A00]">BRANDEX LAW ASSOCIATES</h1>
              <p className="font-mono text-xs font-bold text-[#C94A00]">PAYMENT RECONCILIATION REPORT</p>
            </div>
            <div className="text-right font-mono">
              <p>Generated: {new Date().toLocaleDateString("en-GB")}</p>
              <p>Account: {reportClientId ? clientsList.find((c) => c.id === reportClientId)?.client_code : "All Clients"}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 border p-3 font-mono mb-4">
            <div>Total Charges: PKR {fmt(reportsData.charges)}</div>
            <div>Total Received: PKR {fmt(reportsData.receivings)}</div>
            <div className="font-bold text-[#0A6B52]">Net Outstanding: PKR {fmt(reportsData.balance)}</div>
          </div>

          <table className="w-full border-collapse border border-black text-left">
            <thead>
              <tr className="bg-stone-200 font-mono uppercase text-[10px]">
                <th className="border border-black p-2">Date</th>
                <th className="border border-black p-2">Client</th>
                <th className="border border-black p-2">Type</th>
                <th className="border border-black p-2">Stage</th>
                <th className="border border-black p-2">Case / TM</th>
                <th className="border border-black p-2 text-right">Due</th>
                <th className="border border-black p-2 text-right">Received</th>
              </tr>
            </thead>
            <tbody>
              {reportsData.entries.slice(0, 100).map((r) => (
                <tr key={r.id}>
                  <td className="border border-black p-2 font-mono">{shortDate(r.entry_date)}</td>
                  <td className="border border-black p-2 font-bold">{r.ledger_clients?.client_code || "—"}</td>
                  <td className="border border-black p-2 uppercase">{r.entry_type}</td>
                  <td className="border border-black p-2">{r.stage || "—"}</td>
                  <td className="border border-black p-2">{r.ledger_cases?.tm_no || r.details || "—"}</td>
                  <td className="border border-black p-2 text-right font-mono">{r.amount_due ? fmt(r.amount_due) : ""}</td>
                  <td className="border border-black p-2 text-right font-mono">{r.amount_received ? fmt(r.amount_received) : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    return null;
  }, [printType, printAckEntryId, entriesList, clientsList, casesList, activeClient, selectedEntryIds, activeClientEntries, totalDue, totalOutstanding, reportClientId, reportsData]);

  // Execute print after printArea mounts
  const triggerPrint = (type: "ack" | "ledger" | "report", ackId?: string) => {
    setPrintType(type);
    if (ackId) setPrintAckEntryId(ackId);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  return (
    <AppShell>
      <div className="min-h-full flex-1 overflow-auto bg-[#F0E8D0] text-[#0C0C0C]">
        {/* Print Styles */}
        <style>{`
          @media print {
            body * { visibility: hidden !important; }
            #printArea, #printArea * { visibility: visible !important; }
            #printArea {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              display: block !important;
              background: white !important;
              color: black !important;
            }
            .no-print { display: none !important; }
          }
          #printArea { display: none; }
        `}</style>

        {/* Hidden Print Container */}
        {printAreaContent}

        <div className="mx-auto max-w-[1600px] space-y-6 p-4 md:p-8">
          {/* Top Navbar Header matching Brandex Client Ledger */}
          <nav className="flex flex-wrap items-center justify-between border-b-[3px] border-[#0C0C0C] bg-[#FAF6EE] p-4 shadow-[4px_4px_0_#0C0C0C]">
            <div className="flex items-center gap-3">
              <img src="/brandex-logo-15.png" alt="Brandex" className="h-10 w-10 object-contain" />
              <div>
                <div className="font-serif text-2xl font-bold uppercase leading-none tracking-wider text-[#0C0C0C]">
                  BRANDEX
                </div>
                <div className="font-mono text-xs uppercase tracking-wider text-[#C94A00]">
                  Law Associates · Client Ledger
                </div>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="my-2 flex flex-wrap items-center gap-2">
              <button
                onClick={() => setCurrentPage("dashboard")}
                className={`border-2 border-black px-4 py-1.5 font-mono text-xs font-bold uppercase shadow-[2px_2px_0_#0C0C0C] transition ${
                  currentPage === "dashboard" ? "bg-[#0C0C0C] text-white" : "bg-white hover:bg-stone-100"
                }`}
              >
                Dashboard
              </button>
              <button
                onClick={() => setCurrentPage("clients")}
                className={`border-2 border-black px-4 py-1.5 font-mono text-xs font-bold uppercase shadow-[2px_2px_0_#0C0C0C] transition ${
                  currentPage === "clients" ? "bg-[#0C0C0C] text-white" : "bg-white hover:bg-stone-100"
                }`}
              >
                Clients
              </button>
              <button
                onClick={() => setCurrentPage("reports")}
                className={`border-2 border-black px-4 py-1.5 font-mono text-xs font-bold uppercase shadow-[2px_2px_0_#0C0C0C] transition ${
                  currentPage === "reports" ? "bg-[#0C0C0C] text-white" : "bg-white hover:bg-stone-100"
                }`}
              >
                Reports
              </button>
              {activeClient && (
                <button
                  onClick={() => setCurrentPage("ledger")}
                  className={`border-2 border-black px-4 py-1.5 font-mono text-xs font-bold uppercase shadow-[2px_2px_0_#0C0C0C] transition ${
                    currentPage === "ledger" ? "bg-[#C94A00] text-white" : "bg-[#FFF4E6] text-[#8B3A00]"
                  }`}
                >
                  {activeClient.client_code} · Ledger
                </button>
              )}
            </div>

            {/* Top Stats Banner */}
            <div className="flex items-center gap-4 font-mono text-xs">
              <div className="border border-stone-400 bg-white px-3 py-1 text-center shadow-[2px_2px_0_#0C0C0C]">
                <strong className="block text-sm font-bold text-[#0C0C0C]">{clientsList.length}</strong>
                <span className="text-[10px] uppercase text-stone-500">Clients</span>
              </div>
              <div className="border border-stone-400 bg-white px-3 py-1 text-center shadow-[2px_2px_0_#0C0C0C]">
                <strong className={`block text-sm font-bold ${totalOutstanding > 0 ? "text-red-700" : "text-[#0A6B52]"}`}>
                  PKR {fmt(totalOutstanding)}
                </strong>
                <span className="text-[10px] uppercase text-stone-500">Outstanding</span>
              </div>
            </div>
          </nav>

          {/* Errors banner */}
          {(clientsQuery.isError || entriesQuery.isError || casesQuery.isError) && (
            <div className="border-2 border-red-700 bg-red-50 p-4 font-mono text-xs font-bold text-red-800">
              <AlertCircle className="mr-2 inline h-4 w-4" />
              {String(clientsQuery.error?.message || entriesQuery.error?.message || "Ledger sync error")}
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 1: DASHBOARD VIEW */}
          {/* ======================================================== */}
          {currentPage === "dashboard" && (
            <div className="space-y-6">
              <header className="border-b-2 border-black pb-3">
                <p className="font-mono text-xs font-bold uppercase tracking-wider text-[#C94A00]">
                  BRANDEX / The daily overview
                </p>
                <h1 className="font-serif text-4xl font-bold uppercase sm:text-5xl">Dashboard</h1>
                <p className="text-sm text-stone-600">A clear view of payments, balances and recent activity.</p>
              </header>

              {/* 5 KPI Stat Cards */}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                <div className="border-2 border-black bg-[#FAF6EE] p-4 shadow-[4px_4px_0_#0C0C0C]">
                  <div className="font-mono text-[11px] font-bold uppercase text-stone-500">Clients</div>
                  <div className="mt-2 text-3xl font-bold text-[#0C0C0C]">{clientsList.length}</div>
                  <div className="mt-1 font-mono text-[10px] text-stone-500">Client accounts</div>
                </div>

                <div className="border-2 border-black bg-[#FAF6EE] p-4 shadow-[4px_4px_0_#0C0C0C]">
                  <div className="font-mono text-[11px] font-bold uppercase text-stone-500">Total Received</div>
                  <div className="mt-2 text-3xl font-bold text-[#0A6B52]">{fmt(totalReceived)}</div>
                  <div className="mt-1 font-mono text-[10px] text-stone-500">PKR</div>
                </div>

                <div className="border-2 border-black bg-[#FAF6EE] p-4 shadow-[4px_4px_0_#0C0C0C]">
                  <div className="font-mono text-[11px] font-bold uppercase text-stone-500">Outstanding</div>
                  <div className="mt-2 text-3xl font-bold text-[#C94A00]">{fmt(totalOutstanding)}</div>
                  <div className="mt-1 font-mono text-[10px] text-stone-500">PKR · Charges − Received</div>
                </div>

                <div className="border-2 border-black bg-[#FAF6EE] p-4 shadow-[4px_4px_0_#0C0C0C]">
                  <div className="font-mono text-[11px] font-bold uppercase text-stone-500">Entries</div>
                  <div className="mt-2 text-3xl font-bold text-stone-800">{entriesList.length}</div>
                  <div className="mt-1 font-mono text-[10px] text-stone-500">All time</div>
                </div>

                <div className="border-2 border-black bg-[#FAF6EE] p-4 shadow-[4px_4px_0_#0C0C0C]">
                  <div className="font-mono text-[11px] font-bold uppercase text-stone-500">Today</div>
                  <div className="mt-2 text-3xl font-bold text-stone-800">{todayCount}</div>
                  <div className="mt-1 font-mono text-[10px] text-stone-500">Entries posted today</div>
                </div>
              </div>

              {/* 6-Month Monthly Charges & Receivings Bar Chart */}
              <section className="border-2 border-black bg-[#FAF6EE] p-5 shadow-[4px_4px_0_#0C0C0C]">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-black pb-3">
                  <h2 className="font-serif text-2xl font-bold uppercase tracking-wide">
                    MONTHLY CHARGES & RECEIVINGS
                  </h2>
                  <div className="flex items-center gap-4 font-mono text-xs font-bold uppercase">
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block h-3 w-3 border border-black bg-[#C94A00]" />
                      CHARGES
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block h-3 w-3 border border-black bg-[#0A6B52]" />
                      RECEIVINGS
                    </span>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-6 gap-2 sm:gap-6 min-h-[160px] items-end border-b-2 border-black pb-2">
                  {monthlyChartData.months.map((m) => {
                    const chargePct = Math.max(4, Math.round((m.charges / monthlyChartData.maxVal) * 100));
                    const recPct = Math.max(4, Math.round((m.receivings / monthlyChartData.maxVal) * 100));
                    return (
                      <div key={m.key} className="flex flex-col items-center justify-end h-full">
                        <div className="flex w-full items-end justify-center gap-1 sm:gap-2 h-32">
                          {/* Charge bar */}
                          <div
                            style={{ height: `${m.charges > 0 ? chargePct : 4}%` }}
                            className="w-1/2 max-w-[24px] border border-black bg-[#C94A00] transition-all"
                            title={`Charges: PKR ${fmt(m.charges)}`}
                          />
                          {/* Receiving bar */}
                          <div
                            style={{ height: `${m.receivings > 0 ? recPct : 4}%` }}
                            className="w-1/2 max-w-[24px] border border-black bg-[#0A6B52] transition-all"
                            title={`Received: PKR ${fmt(m.receivings)}`}
                          />
                        </div>
                        <div className="mt-2 text-center font-mono text-[10px] font-bold text-stone-700">
                          {m.label}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Quick Actions Toolbar */}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => {
                    setChClientId(activeClientId || clientsList[0]?.id || "");
                    setShowChargeModal(true);
                  }}
                  className="inline-flex items-center gap-2 border-2 border-black bg-[#C94A00] px-4 py-2 font-mono text-xs font-bold uppercase text-white shadow-[2px_2px_0_#0C0C0C] hover:bg-[#A83D00]"
                >
                  <FilePlus className="h-4 w-4" /> + Charge
                </button>
                <button
                  onClick={() => {
                    setRcClientId(activeClientId || clientsList[0]?.id || "");
                    setShowReceivingModal(true);
                  }}
                  className="inline-flex items-center gap-2 border-2 border-black bg-[#0A6B52] px-4 py-2 font-mono text-xs font-bold uppercase text-white shadow-[2px_2px_0_#0C0C0C] hover:bg-[#085541]"
                >
                  <ReceiptText className="h-4 w-4" /> + Payment
                </button>
                <button
                  onClick={() => setCurrentPage("clients")}
                  className="inline-flex items-center gap-2 border-2 border-black bg-white px-4 py-2 font-mono text-xs font-bold uppercase shadow-[2px_2px_0_#0C0C0C] hover:bg-stone-50"
                >
                  <Users className="h-4 w-4" /> View Clients
                </button>
                <button
                  onClick={() => {
                    void queryClient.invalidateQueries({ queryKey: ["ledger_clients"] });
                    void queryClient.invalidateQueries({ queryKey: ["ledger_entries"] });
                    void queryClient.invalidateQueries({ queryKey: ["ledger_cases"] });
                  }}
                  className="inline-flex items-center gap-2 border-2 border-black bg-white px-3 py-2 font-mono text-xs font-bold uppercase shadow-[2px_2px_0_#0C0C0C]"
                >
                  <RefreshCw className="h-4 w-4" /> Refresh
                </button>
              </div>

              {/* Recent Activity Table */}
              <section className="border-2 border-black bg-[#FAF6EE] shadow-[4px_4px_0_#0C0C0C]">
                <div className="flex items-center justify-between border-b-2 border-black bg-[#0C0C0C] p-4 text-white">
                  <div>
                    <h2 className="font-serif text-xl font-bold uppercase tracking-wide">Recent Activity</h2>
                    <p className="text-xs text-stone-300">The latest charges and receivings posted to the ledger.</p>
                  </div>
                  <span className="font-mono text-xs font-bold text-stone-300">Amounts in PKR</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-black bg-stone-200 font-mono text-[11px] uppercase">
                        <th className="p-3">Date</th>
                        <th className="p-3">Client</th>
                        <th className="p-3">Type</th>
                        <th className="p-3">Stage</th>
                        <th className="p-3">TM / Details</th>
                        <th className="p-3 text-right">Due</th>
                        <th className="p-3 text-right">Received</th>
                        <th className="p-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-300 font-mono">
                      {entriesList.slice(0, 15).map((e) => {
                        const isVoid = Boolean(e.voided_at);
                        return (
                          <tr
                            key={e.id}
                            className={`hover:bg-[#FFF9EC] ${
                              isVoid ? "opacity-50 line-through bg-stone-100" : ""
                            }`}
                          >
                            <td className="p-3">{shortDate(e.entry_date)}</td>
                            <td className="p-3 font-bold">{e.ledger_clients?.client_code || "—"}</td>
                            <td className="p-3">
                              <span
                                className={`inline-block border px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                                  e.entry_type === "charge"
                                    ? "border-[#C94A00] bg-[#FFF4E6] text-[#C94A00]"
                                    : "border-[#0A6B52] bg-[#E6F7F1] text-[#0A6B52]"
                                }`}
                              >
                                {e.entry_type}
                                {isVoid ? " · VOID" : ""}
                              </span>
                            </td>
                            <td className="p-3">
                              {e.stage ? (
                                <span className="inline-block border border-black bg-white px-1.5 py-0.5 text-[10px] font-bold">
                                  {e.stage}
                                </span>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="p-3 font-sans">
                              <strong>{e.ledger_cases?.tm_no || e.ledger_cases?.application_name || "—"}</strong>
                              {e.details && <span className="ml-1 text-stone-600">· {e.details}</span>}
                            </td>
                            <td className="p-3 text-right font-bold text-[#C94A00]">
                              {e.amount_due ? fmt(e.amount_due) : ""}
                            </td>
                            <td className="p-3 text-right font-bold text-[#0A6B52]">
                              {e.amount_received ? fmt(e.amount_received) : ""}
                            </td>
                            <td className="p-3 text-right">
                              {e.entry_type === "receiving" && !isVoid && (
                                <button
                                  onClick={() => triggerPrint("ack", e.id)}
                                  className="border border-black bg-white px-2 py-0.5 text-[10px] font-bold hover:bg-stone-100"
                                >
                                  Print Ack
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {!entriesList.length && (
                        <tr>
                          <td colSpan={8} className="p-6 text-center text-sm font-sans text-stone-500">
                            No entries yet — add a client account, then post a charge or receiving.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 2: CLIENTS DIRECTORY */}
          {/* ======================================================== */}
          {currentPage === "clients" && (
            <div className="space-y-6">
              <header className="border-b-2 border-black pb-3">
                <p className="font-mono text-xs font-bold uppercase tracking-wider text-[#C94A00]">
                  BRANDEX / The client directory
                </p>
                <h1 className="font-serif text-4xl font-bold uppercase sm:text-5xl">Clients</h1>
                <p className="text-sm text-stone-600">Your accounts, contact details and balances, together.</p>
              </header>

              {/* Filter Panel */}
              <div className="flex flex-wrap items-end gap-3 border-2 border-black bg-[#FAF6EE] p-4 shadow-[4px_4px_0_#0C0C0C]">
                <div className="min-w-[240px] flex-1">
                  <label className="block font-mono text-xs font-bold uppercase text-stone-600">
                    Find a client
                  </label>
                  <div className="mt-1 flex items-center border-2 border-black bg-white px-2">
                    <Search className="h-4 w-4 text-stone-500" />
                    <input
                      value={clientSearch}
                      onChange={(e) => setClientSearch(e.target.value)}
                      placeholder="Search code, name, city, phone…"
                      className="h-9 min-w-0 flex-1 bg-transparent px-2 text-sm outline-none"
                    />
                  </div>
                </div>

                <div className="min-w-[180px]">
                  <label className="block font-mono text-xs font-bold uppercase text-stone-600">Series</label>
                  <select
                    value={selectedSeriesFilter}
                    onChange={(e) => setSelectedSeriesFilter(e.target.value)}
                    className="mt-1 h-9 w-full border-2 border-black bg-white px-2 font-mono text-xs"
                  >
                    <option value="">All Series</option>
                    {seriesList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.code} — {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleOpenNewClient}
                    className="inline-flex h-9 items-center gap-1.5 border-2 border-black bg-[#C94A00] px-4 font-mono text-xs font-bold uppercase text-white shadow-[2px_2px_0_#0C0C0C] hover:bg-[#A83D00]"
                  >
                    <Plus className="h-4 w-4" /> New Client
                  </button>
                  <button
                    onClick={() => setShowSeriesModal(true)}
                    className="inline-flex h-9 items-center gap-1.5 border-2 border-black bg-white px-3 font-mono text-xs font-bold uppercase shadow-[2px_2px_0_#0C0C0C] hover:bg-stone-50"
                  >
                    <Layers className="h-4 w-4" /> New Series
                  </button>
                </div>
              </div>

              {/* Quick CMS Suggestions Pill Strip */}
              {cmsSuggestions.length > 0 && (
                <div className="border border-stone-300 bg-white p-3 text-xs">
                  <span className="font-mono font-bold uppercase text-stone-500 mr-2">
                    CMS Client Suggestions (1-Click Add):
                  </span>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {cmsSuggestions.map((s) => {
                      const alreadyExists = clientsList.some(
                        (c) => c.client_code.toUpperCase() === s.code
                      );
                      if (alreadyExists) return null;
                      return (
                        <button
                          key={s.code}
                          onClick={() => {
                            setCCode(s.code);
                            setCName(s.name);
                            setCCity(s.city);
                            setCHeader("0");
                            setShowClientModal(true);
                          }}
                          className="border border-stone-400 bg-stone-100 px-2.5 py-1 font-mono text-xs font-bold hover:bg-[#FFF4E6] hover:border-[#C94A00]"
                        >
                          + {s.code} ({s.name})
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Grouped Client Cards Grid */}
              <div className="space-y-8">
                {groupedClients.map((group) => (
                  <div key={group.seriesCode} className="space-y-4">
                    {/* Series Banner */}
                    <div className="flex items-baseline gap-3 border-b-2 border-black pb-1">
                      <span className="font-serif text-3xl font-bold uppercase text-[#C94A00]">
                        {group.seriesCode}
                      </span>
                      <span className="font-serif text-lg font-bold uppercase text-stone-800">
                        {group.seriesName}
                      </span>
                      <span className="font-mono text-xs text-stone-500">
                        ({group.clients.length} {group.clients.length === 1 ? "account" : "accounts"})
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {group.clients.map((c) => {
                        const stats = clientStats[c.id] || {
                          balance: 0,
                          entriesCount: 0,
                          casesCount: 0,
                        };
                        const bal = stats.balance;
                        const balClass =
                          bal > 0
                            ? "border-red-700 bg-[#FFF4E6] text-[#8B3A00]"
                            : bal < 0
                            ? "border-emerald-700 bg-[#E6F7F1] text-[#0A6B52]"
                            : "border-stone-400 bg-stone-100 text-stone-700";
                        const balLabel =
                          bal > 0 ? "Outstanding" : bal < 0 ? "Credit balance" : "Settled balance";

                        return (
                          <article
                            key={c.id}
                            onClick={() => {
                              setActiveClientId(c.id);
                              setCurrentPage("ledger");
                            }}
                            className="group relative cursor-pointer border-2 border-black bg-[#FAF6EE] p-4 shadow-[4px_4px_0_#0C0C0C] transition hover:-translate-y-0.5 hover:shadow-[6px_6px_0_#0C0C0C]"
                          >
                            <div className="flex items-center justify-between border-b border-black pb-2">
                              <span className="font-serif text-2xl font-bold uppercase text-[#0C0C0C]">
                                {c.client_code}
                              </span>
                              <span className="border border-black bg-white px-2 py-0.5 font-mono text-[10px] font-bold uppercase">
                                {group.seriesCode}
                              </span>
                            </div>

                            <h3 className="mt-2 text-base font-bold uppercase text-[#0C0C0C] line-clamp-1">
                              {c.client_name || "Unnamed Client"}
                            </h3>

                            <div className="mt-2 flex items-center gap-3 font-mono text-xs text-stone-600">
                              <span>
                                <strong>{stats.casesCount}</strong> {stats.casesCount === 1 ? "case" : "cases"}
                              </span>
                              <span>·</span>
                              <span>
                                <strong>{stats.entriesCount}</strong> {stats.entriesCount === 1 ? "entry" : "entries"}
                              </span>
                            </div>

                            <div className="mt-3 space-y-1 text-xs text-stone-600 font-mono">
                              <div>City: {c.city || "Not provided"}</div>
                              <div>Phone: {c.phone || "Not provided"}</div>
                            </div>

                            {/* Balance Card Block */}
                            <div className={`mt-4 border-2 p-3 font-mono ${balClass}`}>
                              <span className="block text-[10px] font-bold uppercase tracking-wider">
                                {balLabel}
                              </span>
                              <div className="text-xl font-bold">PKR {fmt(bal)}</div>
                            </div>

                            <div className="mt-4 flex items-center justify-between pt-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveClientId(c.id);
                                  setCurrentPage("ledger");
                                }}
                                className="inline-flex items-center gap-1 border-2 border-black bg-[#C94A00] px-3 py-1 font-mono text-xs font-bold uppercase text-white shadow-[2px_2px_0_#0C0C0C]"
                              >
                                Open Ledger ↗
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenEditClient(c);
                                }}
                                className="border border-stone-400 bg-white p-1 text-stone-600 hover:text-black"
                                title="Edit client details"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {!filteredClients.length && (
                  <div className="border-2 border-black bg-[#FAF6EE] p-8 text-center font-mono">
                    <p className="text-sm font-bold">No clients match your filter.</p>
                    <button
                      onClick={handleOpenNewClient}
                      className="mt-3 inline-flex items-center gap-1 border-2 border-black bg-[#C94A00] px-3 py-1 text-xs font-bold uppercase text-white shadow-[2px_2px_0_#0C0C0C]"
                    >
                      + Create New Client
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 3: CLIENT DEDICATED LEDGER & CASES DRILLDOWN */}
          {/* ======================================================== */}
          {currentPage === "ledger" && activeClient && (
            <div className="space-y-6">
              {/* Back navigation & Client Header */}
              <div className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-black pb-4">
                <div>
                  <button
                    onClick={() => setCurrentPage("clients")}
                    className="mb-2 inline-flex items-center gap-1 font-mono text-xs font-bold uppercase text-stone-600 hover:text-black"
                  >
                    <ArrowLeft className="h-4 w-4" /> Back to Clients Directory
                  </button>
                  <h1 className="font-serif text-4xl font-bold uppercase sm:text-5xl">
                    {activeClient.client_code} · LEDGER
                  </h1>
                  <p className="text-base font-bold uppercase text-stone-800">
                    {activeClient.client_name} · {activeClient.city || "Head Office"}
                    {activeClient.phone ? ` · Tel: ${activeClient.phone}` : ""}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="border-2 border-black bg-white p-3 font-mono shadow-[3px_3px_0_#0C0C0C]">
                    <span className="block text-[10px] font-bold uppercase text-stone-500">Net Outstanding</span>
                    <strong
                      className={`text-2xl ${
                        (clientStats[activeClient.id]?.balance || 0) > 0 ? "text-[#C94A00]" : "text-[#0A6B52]"
                      }`}
                    >
                      PKR {fmt(clientStats[activeClient.id]?.balance || 0)}
                    </strong>
                  </div>

                  <button
                    onClick={() => handleOpenEditClient(activeClient)}
                    className="inline-flex h-10 items-center gap-1.5 border-2 border-black bg-white px-3 font-mono text-xs font-bold uppercase shadow-[2px_2px_0_#0C0C0C] hover:bg-stone-50"
                  >
                    <Edit2 className="h-4 w-4" /> Edit Client
                  </button>
                  <button
                    onClick={() => triggerPrint("ledger")}
                    className="inline-flex h-10 items-center gap-1.5 border-2 border-black bg-[#0A6B52] px-3 font-mono text-xs font-bold uppercase text-white shadow-[2px_2px_0_#0C0C0C]"
                  >
                    <Printer className="h-4 w-4" /> Print A4 Ledger
                  </button>
                  <button
                    onClick={() => handleExportCsv(activeClientEntries, `${activeClient.client_code}_ledger`)}
                    className="inline-flex h-10 items-center gap-1.5 border-2 border-black bg-white px-3 font-mono text-xs font-bold uppercase shadow-[2px_2px_0_#0C0C0C]"
                  >
                    <Download className="h-4 w-4" /> Export CSV
                  </button>
                </div>
              </div>

              {/* Stage Outstanding 4-Card Strip (S1, S2, S3, S4) */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {(["S1", "S2", "S3", "S4"] as const).map((st) => {
                  const sData = stageOutstandingSummary[st];
                  const isCleared = sData.due > 0 && sData.outstanding === 0;
                  return (
                    <div
                      key={st}
                      className={`border-2 border-black p-3 font-mono shadow-[3px_3px_0_#0C0C0C] ${
                        isCleared ? "bg-[#E6F7F1]" : sData.outstanding > 0 ? "bg-[#FFF4E6]" : "bg-[#FAF6EE]"
                      }`}
                    >
                      <div className="text-[11px] font-bold uppercase text-stone-600">
                        {st} OUTSTANDING
                      </div>
                      <div className="mt-1 text-2xl font-bold">PKR {fmt(sData.outstanding)}</div>
                      <div className="mt-1 text-[10px] font-bold text-stone-500">
                        {isCleared
                          ? "CLEARED"
                          : sData.due > 0
                          ? `CHARGED PKR ${fmt(sData.due)}`
                          : "NO CHARGES"}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Section 1: Cases Table with CMS Linking */}
              <section className="border-2 border-black bg-[#FAF6EE] shadow-[4px_4px_0_#0C0C0C]">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-black bg-[#E8DFC7] p-4">
                  <div>
                    <h2 className="font-serif text-2xl font-bold uppercase">
                      Client Cases & Trademarks ({activeClientCases.length})
                    </h2>
                    <p className="text-xs text-stone-600">
                      Trademark matters tracked for this client in the ledger.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={handleOpenNewCase}
                      className="inline-flex h-9 items-center gap-1 border-2 border-black bg-white px-3 font-mono text-xs font-bold uppercase shadow-[2px_2px_0_#0C0C0C] hover:bg-stone-50"
                    >
                      <FolderPlus className="h-4 w-4" /> + Add Case
                    </button>
                    <button
                      onClick={() => {
                        setChClientId(activeClient.id);
                        setShowChargeModal(true);
                      }}
                      className="inline-flex h-9 items-center gap-1 border-2 border-black bg-[#C94A00] px-3 font-mono text-xs font-bold uppercase text-white shadow-[2px_2px_0_#0C0C0C]"
                    >
                      <FilePlus className="h-4 w-4" /> + Charge
                    </button>
                    <button
                      onClick={() => {
                        setRcClientId(activeClient.id);
                        setShowReceivingModal(true);
                      }}
                      className="inline-flex h-9 items-center gap-1 border-2 border-black bg-[#0A6B52] px-3 font-mono text-xs font-bold uppercase text-white shadow-[2px_2px_0_#0C0C0C]"
                    >
                      <ReceiptText className="h-4 w-4" /> + Payment
                    </button>
                  </div>
                </div>

                {/* Case Filter Bar */}
                <div className="flex flex-wrap gap-2 border-b border-black p-3 bg-stone-50 font-mono text-xs">
                  <input
                    value={caseSearchQuery}
                    onChange={(e) => setCaseSearchQuery(e.target.value)}
                    placeholder="Search TM, Folder, Application…"
                    className="h-8 border border-black px-2 flex-1 min-w-[180px]"
                  />
                  <select
                    value={caseStageFilter}
                    onChange={(e) => setCaseStageFilter(e.target.value)}
                    className="h-8 border border-black px-2 bg-white"
                  >
                    <option value="">All Stages</option>
                    <option value="S1">Stage 1</option>
                    <option value="S2">Stage 2</option>
                    <option value="S3">Stage 3</option>
                    <option value="S4">Stage 4</option>
                  </select>
                  <select
                    value={caseStatusFilter}
                    onChange={(e) => setCaseStatusFilter(e.target.value)}
                    className="h-8 border border-black px-2 bg-white"
                  >
                    <option value="">All Statuses</option>
                    <option value="PAID">PAID / CLEARED</option>
                    <option value="DUE">DUE / OUTSTANDING</option>
                  </select>
                </div>

                {/* Cases Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-black bg-stone-200 font-mono text-[11px] uppercase">
                        <th className="p-3">Case / TM</th>
                        <th className="p-3">Folder</th>
                        <th className="p-3">Application Name</th>
                        <th className="p-3">Stage Status</th>
                        <th className="p-3">CMS Link</th>
                        <th className="p-3 text-right">Outstanding</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-300 font-mono">
                      {filteredActiveCases.map((cs) => {
                        const cTotals = caseStageTotals[cs.id];
                        const totalCaseDue = cTotals
                          ? Object.values(cTotals).reduce((sum, item) => sum + item.outstanding, 0)
                          : 0;

                        // Check CMS matching
                        const isLinked = cs.reconciliation_status === "approved_link" && cs.cms_trademark_id;
                        const cmsTrademark = isLinked
                          ? cmsTrademarks.find((t) => t.id === cs.cms_trademark_id)
                          : null;

                        return (
                          <tr key={cs.id} className="hover:bg-[#FFF9EC]">
                            <td className="p-3 font-bold">
                              <button
                                onClick={() =>
                                  setLedgerCaseFilter(ledgerCaseFilter === cs.id ? "" : cs.id)
                                }
                                className={`text-left underline ${
                                  ledgerCaseFilter === cs.id ? "text-[#C94A00] font-extrabold" : ""
                                }`}
                                title="Click to filter ledger entries for this case"
                              >
                                {cs.tm_no || "NO TM"}
                              </button>
                            </td>
                            <td className="p-3">{cs.folder_no || "—"}</td>
                            <td className="p-3 font-sans font-bold">{cs.application_name || "—"}</td>
                            <td className="p-3">
                              <div className="flex flex-wrap gap-1">
                                {(["S1", "S2", "S3", "S4"] as const).map((st) => {
                                  const stData = cTotals?.[st];
                                  if (!stData || stData.due === 0) return null;
                                  return (
                                    <span
                                      key={st}
                                      className={`inline-block border px-1.5 py-0.5 text-[9px] font-bold ${
                                        stData.paid
                                          ? "border-emerald-700 bg-emerald-50 text-emerald-800"
                                          : "border-red-700 bg-red-50 text-red-800"
                                      }`}
                                    >
                                      {st} {stData.paid ? "CLEARED" : "DUE"}
                                    </span>
                                  );
                                })}
                              </div>
                            </td>
                            <td className="p-3">
                              {isLinked ? (
                                <span className="inline-flex items-center gap-1 border border-emerald-700 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                                  <Check className="h-3 w-3" /> Linked ({cmsTrademark?.stage_status || "CMS"})
                                </span>
                              ) : (
                                <button
                                  onClick={() => {
                                    setLinkTargetCaseId(cs.id);
                                    // Try auto matching by TM
                                    const match = cmsTrademarks.find(
                                      (t) => t.tm_cpr_number_norm === cs.tm_no_normalized
                                    );
                                    if (match) setLinkCmsId(match.id);
                                    setShowLinkCmsModal(true);
                                  }}
                                  className="inline-flex items-center gap-1 border border-amber-600 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800 hover:bg-amber-100"
                                >
                                  <LinkIcon className="h-3 w-3" /> Link to CMS
                                </button>
                              )}
                            </td>
                            <td className="p-3 text-right font-bold text-[#C94A00]">
                              PKR {fmt(totalCaseDue)}
                            </td>
                            <td className="p-3 text-right">
                              <button
                                onClick={() =>
                                  setLedgerCaseFilter(ledgerCaseFilter === cs.id ? "" : cs.id)
                                }
                                className="mr-2 text-xs font-bold underline"
                              >
                                {ledgerCaseFilter === cs.id ? "Clear Filter" : "Open"}
                              </button>
                              <button
                                onClick={() => handleOpenEditCase(cs)}
                                className="text-xs font-bold text-stone-600 underline"
                              >
                                Edit
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {!filteredActiveCases.length && (
                        <tr>
                          <td colSpan={7} className="p-6 text-center text-sm font-sans text-stone-500">
                            No cases match the filters. Click <b>+ Add Case</b> to register one.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Section 2: Client Ledger Entries Table */}
              <section className="border-2 border-black bg-[#FAF6EE] shadow-[4px_4px_0_#0C0C0C]">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-black bg-[#0C0C0C] p-4 text-white">
                  <div>
                    <h2 className="font-serif text-2xl font-bold uppercase tracking-wide">
                      Client Ledger Entries ({activeClientEntries.length})
                    </h2>
                    <p className="text-xs text-stone-300">
                      Chronological statement of charges and receivings.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => setCurrentViewModeLast6(!currentViewModeLast6)}
                      className="border border-white/40 bg-white/10 px-3 py-1 font-mono text-xs font-bold uppercase hover:bg-white/20"
                    >
                      {currentViewModeLast6 ? "Full Ledger" : "Current View (Last 6)"}
                    </button>
                    {selectedEntryIds.length > 0 && (
                      <button
                        onClick={() => triggerPrint("ledger")}
                        className="border border-white/40 bg-[#0A6B52] px-3 py-1 font-mono text-xs font-bold uppercase hover:bg-[#085541]"
                      >
                        Print Selected ({selectedEntryIds.length})
                      </button>
                    )}
                  </div>
                </div>

                {/* Entries Filter Toolbar */}
                <div className="flex flex-wrap gap-2 border-b border-black p-3 bg-stone-100 font-mono text-xs">
                  <div className="flex items-center gap-1">
                    <span>Case:</span>
                    <select
                      value={ledgerCaseFilter}
                      onChange={(e) => setLedgerCaseFilter(e.target.value)}
                      className="h-8 border border-black px-2 bg-white"
                    >
                      <option value="">All Cases</option>
                      {activeClientCases.map((cs) => (
                        <option key={cs.id} value={cs.id}>
                          {cs.tm_no || cs.application_name || cs.folder_no || cs.id.slice(0, 8)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-1">
                    <span>From:</span>
                    <input
                      type="date"
                      value={ledgerDateFrom}
                      onChange={(e) => setLedgerDateFrom(e.target.value)}
                      className="h-8 border border-black px-1 bg-white text-xs"
                    />
                  </div>

                  <div className="flex items-center gap-1">
                    <span>To:</span>
                    <input
                      type="date"
                      value={ledgerDateTo}
                      onChange={(e) => setLedgerDateTo(e.target.value)}
                      className="h-8 border border-black px-1 bg-white text-xs"
                    />
                  </div>

                  {(ledgerCaseFilter || ledgerDateFrom || ledgerDateTo) && (
                    <button
                      onClick={() => {
                        setLedgerCaseFilter("");
                        setLedgerDateFrom("");
                        setLedgerDateTo("");
                      }}
                      className="border border-stone-400 bg-white px-2 text-stone-600 hover:text-black"
                    >
                      Reset Filters
                    </button>
                  )}
                </div>

                {/* Ledger Entries Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-black bg-stone-200 font-mono text-[11px] uppercase">
                        <th className="p-3 w-8">
                          <input
                            type="checkbox"
                            checked={
                              activeClientEntries.length > 0 &&
                              selectedEntryIds.length === activeClientEntries.length
                            }
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedEntryIds(activeClientEntries.map((item) => item.id));
                              } else {
                                setSelectedEntryIds([]);
                              }
                            }}
                          />
                        </th>
                        <th className="p-3">Date</th>
                        <th className="p-3">Type</th>
                        <th className="p-3">Stage</th>
                        <th className="p-3">Case / Matter</th>
                        <th className="p-3">Details / Reference</th>
                        <th className="p-3 text-right">Due</th>
                        <th className="p-3 text-right">Received</th>
                        <th className="p-3 text-right">Receipt #</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-300 font-mono">
                      {activeClientEntries.map((e) => {
                        const isVoid = Boolean(e.voided_at);
                        const isSelected = selectedEntryIds.includes(e.id);
                        return (
                          <tr
                            key={e.id}
                            className={`hover:bg-[#FFF9EC] ${
                              isVoid ? "opacity-45 line-through bg-stone-100" : ""
                            } ${isSelected ? "bg-[#FFF4E6]" : ""}`}
                          >
                            <td className="p-3">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() =>
                                  setSelectedEntryIds((prev) =>
                                    prev.includes(e.id)
                                      ? prev.filter((id) => id !== e.id)
                                      : [...prev, e.id]
                                  )
                                }
                              />
                            </td>
                            <td className="p-3">{shortDate(e.entry_date)}</td>
                            <td className="p-3">
                              <span
                                className={`inline-block border px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                                  e.entry_type === "charge"
                                    ? "border-[#C94A00] bg-[#FFF4E6] text-[#C94A00]"
                                    : "border-[#0A6B52] bg-[#E6F7F1] text-[#0A6B52]"
                                }`}
                              >
                                {e.entry_type}
                                {isVoid ? " · VOID" : ""}
                              </span>
                            </td>
                            <td className="p-3">
                              {e.stage ? (
                                <span className="inline-block border border-black bg-white px-1.5 py-0.5 text-[10px] font-bold">
                                  {e.stage}
                                </span>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="p-3 font-sans font-bold">
                              {e.ledger_cases?.tm_no || e.ledger_cases?.application_name || "—"}
                            </td>
                            <td className="p-3 font-sans">
                              {e.details}
                              {e.payment_method && (
                                <span className="ml-1 text-stone-500 font-mono">· {e.payment_method}</span>
                              )}
                            </td>
                            <td className="p-3 text-right font-bold text-[#C94A00]">
                              {e.amount_due ? fmt(e.amount_due) : ""}
                            </td>
                            <td className="p-3 text-right font-bold text-[#0A6B52]">
                              {e.amount_received ? fmt(e.amount_received) : ""}
                            </td>
                            <td className="p-3 text-right font-mono text-stone-600">
                              {e.receipt_no || "—"}
                            </td>
                            <td className="p-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                {e.entry_type === "receiving" && !isVoid && (
                                  <button
                                    onClick={() => triggerPrint("ack", e.id)}
                                    className="border border-black bg-white px-2 py-0.5 text-[10px] font-bold hover:bg-stone-100"
                                  >
                                    Print Ack
                                  </button>
                                )}
                                {!isVoid && (
                                  <button
                                    onClick={() => {
                                      setVoidEntryId(e.id);
                                      setVoidReason("");
                                    }}
                                    className="border border-red-700 bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-800 hover:bg-red-100"
                                  >
                                    Void
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {!activeClientEntries.length && (
                        <tr>
                          <td colSpan={10} className="p-6 text-center text-sm font-sans text-stone-500">
                            No ledger entries found. Click <b>+ Charge</b> or <b>+ Payment</b> above.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 4: REPORTS VIEW */}
          {/* ======================================================== */}
          {currentPage === "reports" && (
            <div className="space-y-6">
              <header className="border-b-2 border-black pb-3">
                <p className="font-mono text-xs font-bold uppercase tracking-wider text-[#C94A00]">
                  BRANDEX / Financial Reports
                </p>
                <h1 className="font-serif text-4xl font-bold uppercase sm:text-5xl">Reports</h1>
                <p className="text-sm text-stone-600">
                  Audit, filter and export client charges, stage receipts and balances.
                </p>
              </header>

              {/* Reports Filter Toolbar */}
              <div className="flex flex-wrap items-end gap-3 border-2 border-black bg-[#FAF6EE] p-4 shadow-[4px_4px_0_#0C0C0C]">
                <div className="min-w-[220px] flex-1">
                  <label className="block font-mono text-xs font-bold uppercase text-stone-600">Client</label>
                  <select
                    value={reportClientId}
                    onChange={(e) => setReportClientId(e.target.value)}
                    className="mt-1 h-9 w-full border-2 border-black bg-white px-2 font-mono text-xs"
                  >
                    <option value="">All Clients</option>
                    {clientsList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.client_code} — {c.client_name || "Client"}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="min-w-[150px]">
                  <label className="block font-mono text-xs font-bold uppercase text-stone-600">From Date</label>
                  <input
                    type="date"
                    value={reportDateFrom}
                    onChange={(e) => setReportDateFrom(e.target.value)}
                    className="mt-1 h-9 w-full border-2 border-black bg-white px-2 font-mono text-xs"
                  />
                </div>

                <div className="min-w-[150px]">
                  <label className="block font-mono text-xs font-bold uppercase text-stone-600">To Date</label>
                  <input
                    type="date"
                    value={reportDateTo}
                    onChange={(e) => setReportDateTo(e.target.value)}
                    className="mt-1 h-9 w-full border-2 border-black bg-white px-2 font-mono text-xs"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => triggerPrint("report")}
                    className="inline-flex h-9 items-center gap-1.5 border-2 border-black bg-[#0A6B52] px-4 font-mono text-xs font-bold uppercase text-white shadow-[2px_2px_0_#0C0C0C]"
                  >
                    <Printer className="h-4 w-4" /> Print Report
                  </button>
                  <button
                    onClick={() => handleExportCsv(reportsData.entries, "brandex_financial_report")}
                    className="inline-flex h-9 items-center gap-1.5 border-2 border-black bg-white px-3 font-mono text-xs font-bold uppercase shadow-[2px_2px_0_#0C0C0C]"
                  >
                    <Download className="h-4 w-4" /> Export CSV
                  </button>
                </div>
              </div>

              {/* Reports Summary KPI Cards */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="border-2 border-black bg-[#FAF6EE] p-4 shadow-[4px_4px_0_#0C0C0C]">
                  <div className="font-mono text-xs font-bold uppercase text-stone-500">Total Billed Charges</div>
                  <div className="mt-2 text-3xl font-bold text-[#C94A00]">PKR {fmt(reportsData.charges)}</div>
                </div>
                <div className="border-2 border-black bg-[#FAF6EE] p-4 shadow-[4px_4px_0_#0C0C0C]">
                  <div className="font-mono text-xs font-bold uppercase text-stone-500">Total Receivings</div>
                  <div className="mt-2 text-3xl font-bold text-[#0A6B52]">PKR {fmt(reportsData.receivings)}</div>
                </div>
                <div className="border-2 border-black bg-[#FAF6EE] p-4 shadow-[4px_4px_0_#0C0C0C]">
                  <div className="font-mono text-xs font-bold uppercase text-stone-500">Net Outstanding</div>
                  <div className="mt-2 text-3xl font-bold text-stone-900">PKR {fmt(reportsData.balance)}</div>
                </div>
              </div>

              {/* Stage Breakdown Grid */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 font-mono text-xs">
                {(["S1", "S2", "S3", "S4"] as const).map((st) => (
                  <div key={st} className="border-2 border-black bg-[#FAF6EE] p-3 shadow-[3px_3px_0_#0C0C0C]">
                    <div className="font-bold uppercase text-stone-600">{st} Breakdown</div>
                    <div className="mt-2 text-stone-700">Due: PKR {fmt(reportsData.stagesBreakdown[st]?.charges || 0)}</div>
                    <div className="text-[#0A6B52] font-bold">
                      Rec: PKR {fmt(reportsData.stagesBreakdown[st]?.receivings || 0)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Transactions Table */}
              <section className="border-2 border-black bg-[#FAF6EE] shadow-[4px_4px_0_#0C0C0C]">
                <div className="border-b-2 border-black bg-[#0C0C0C] p-4 text-white">
                  <h2 className="font-serif text-xl font-bold uppercase">Transactions Audit ({reportsData.entries.length})</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-black bg-stone-200 font-mono text-[11px] uppercase">
                        <th className="p-3">Date</th>
                        <th className="p-3">Client</th>
                        <th className="p-3">Type</th>
                        <th className="p-3">Stage</th>
                        <th className="p-3">Case / TM</th>
                        <th className="p-3 text-right">Due (PKR)</th>
                        <th className="p-3 text-right">Received (PKR)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-300 font-mono">
                      {reportsData.entries.map((e) => (
                        <tr key={e.id} className="hover:bg-[#FFF9EC]">
                          <td className="p-3">{shortDate(e.entry_date)}</td>
                          <td className="p-3 font-bold">{e.ledger_clients?.client_code || "—"}</td>
                          <td className="p-3 uppercase">{e.entry_type}</td>
                          <td className="p-3">{e.stage || "General"}</td>
                          <td className="p-3 font-sans">{e.ledger_cases?.tm_no || e.details || "—"}</td>
                          <td className="p-3 text-right text-[#C94A00] font-bold">
                            {e.amount_due ? fmt(e.amount_due) : ""}
                          </td>
                          <td className="p-3 text-right text-[#0A6B52] font-bold">
                            {e.amount_received ? fmt(e.amount_received) : ""}
                          </td>
                        </tr>
                      ))}
                      {!reportsData.entries.length && (
                        <tr>
                          <td colSpan={7} className="p-6 text-center text-sm font-sans text-stone-500">
                            No records found for the selected criteria.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}

          {/* ======================================================== */}
          {/* MODALS */}
          {/* ======================================================== */}

          {/* 1. Client Modal (New / Edit) */}
          {showClientModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
              <div className="w-full max-w-xl border-4 border-black bg-[#FAF6EE] shadow-[8px_8px_0_#0C0C0C]">
                <div className="flex items-center justify-between border-b-2 border-black bg-[#0C0C0C] p-4 text-white">
                  <h3 className="font-serif text-xl font-bold uppercase tracking-wider">
                    {editingClientId ? "EDIT CLIENT ACCOUNT" : "NEW CLIENT ACCOUNT"}
                  </h3>
                  <button
                    onClick={() => setShowClientModal(false)}
                    className="text-white hover:text-[#C94A00]"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    saveClientMutation.mutate();
                  }}
                  className="space-y-4 p-6 text-xs font-mono"
                >
                  {clientFormError && (
                    <div className="border-2 border-red-700 bg-red-50 p-2 font-bold text-red-800">
                      {clientFormError}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block font-bold uppercase">Series</label>
                      <select
                        value={cSeriesId}
                        onChange={(e) => setCSeriesId(e.target.value)}
                        className="mt-1 h-9 w-full border-2 border-black bg-white px-2"
                      >
                        <option value="">No Series</option>
                        {seriesList.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.code} — {s.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold uppercase">Client Code *</label>
                      <input
                        required
                        value={cCode}
                        onChange={(e) => setCCode(e.target.value.toUpperCase())}
                        placeholder="A-001"
                        className="mt-1 h-9 w-full border-2 border-black px-2 uppercase"
                      />
                    </div>

                    <div className="col-span-2">
                      <label className="block font-bold uppercase">Client Name *</label>
                      <input
                        required
                        value={cName}
                        onChange={(e) => setCName(e.target.value)}
                        placeholder="Full client or corporate name"
                        className="mt-1 h-9 w-full border-2 border-black px-2 font-sans"
                      />
                    </div>

                    <div>
                      <label className="block font-bold uppercase">City</label>
                      <input
                        value={cCity}
                        onChange={(e) => setCCity(e.target.value)}
                        placeholder="Karachi, Lahore…"
                        className="mt-1 h-9 w-full border-2 border-black px-2"
                      />
                    </div>

                    <div>
                      <label className="block font-bold uppercase">Phone</label>
                      <input
                        value={cPhone}
                        onChange={(e) => setCPhone(e.target.value)}
                        placeholder="0300-1234567"
                        className="mt-1 h-9 w-full border-2 border-black px-2"
                      />
                    </div>

                    <div className="col-span-2">
                      <label className="block font-bold uppercase">Email</label>
                      <input
                        type="email"
                        value={cEmail}
                        onChange={(e) => setCEmail(e.target.value)}
                        placeholder="client@example.com"
                        className="mt-1 h-9 w-full border-2 border-black px-2"
                      />
                    </div>

                    <div className="col-span-2">
                      <label className="block font-bold uppercase">Opening Balance (PKR)</label>
                      <input
                        type="number"
                        value={cHeader}
                        onChange={(e) => setCHeader(e.target.value)}
                        className="mt-1 h-9 w-full border-2 border-black px-2"
                      />
                      <span className="text-[10px] text-stone-500">Carried forward from legacy sheets</span>
                    </div>
                  </div>

                  {/* Agreed Stage Rates */}
                  <div className="border-t-2 border-black pt-4">
                    <div className="font-bold uppercase text-stone-700 mb-2">
                      Agreed Stage Rates (PKR)
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <div>
                        <label className="block text-[10px] uppercase">Stage 1</label>
                        <input
                          type="number"
                          value={cRateS1}
                          onChange={(e) => setCRateS1(e.target.value)}
                          className="mt-1 h-8 w-full border border-black px-2"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase">Stage 2</label>
                        <input
                          type="number"
                          value={cRateS2}
                          onChange={(e) => setCRateS2(e.target.value)}
                          className="mt-1 h-8 w-full border border-black px-2"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase">Stage 3</label>
                        <input
                          type="number"
                          value={cRateS3}
                          onChange={(e) => setCRateS3(e.target.value)}
                          className="mt-1 h-8 w-full border border-black px-2"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase">Stage 4</label>
                        <input
                          type="number"
                          value={cRateS4}
                          onChange={(e) => setCRateS4(e.target.value)}
                          className="mt-1 h-8 w-full border border-black px-2"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-4 border-t border-stone-300">
                    <button
                      type="button"
                      onClick={() => setShowClientModal(false)}
                      className="border-2 border-black bg-white px-4 py-2 font-bold uppercase shadow-[2px_2px_0_#0C0C0C]"
                    >
                      Cancel
                    </button>
                    <button
                      disabled={saveClientMutation.isPending}
                      className="border-2 border-black bg-[#C94A00] px-5 py-2 font-bold uppercase text-white shadow-[2px_2px_0_#0C0C0C] disabled:opacity-50"
                    >
                      {saveClientMutation.isPending ? "Saving…" : "Save Client"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* 2. Series Modal */}
          {showSeriesModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
              <div className="w-full max-w-md border-4 border-black bg-[#FAF6EE] shadow-[8px_8px_0_#0C0C0C]">
                <div className="flex items-center justify-between border-b-2 border-black bg-[#0C0C0C] p-4 text-white">
                  <h3 className="font-serif text-xl font-bold uppercase tracking-wider">NEW ACCOUNT SERIES</h3>
                  <button onClick={() => setShowSeriesModal(false)} className="text-white hover:text-[#C94A00]">
                    <X className="h-6 w-6" />
                  </button>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    saveSeriesMutation.mutate();
                  }}
                  className="space-y-4 p-6 text-xs font-mono"
                >
                  {seriesFormError && (
                    <div className="border-2 border-red-700 bg-red-50 p-2 font-bold text-red-800">
                      {seriesFormError}
                    </div>
                  )}

                  <div>
                    <label className="block font-bold uppercase">Series Code *</label>
                    <input
                      required
                      value={sCode}
                      onChange={(e) => setSCode(e.target.value.toUpperCase())}
                      placeholder="e.g. B or Z"
                      className="mt-1 h-9 w-full border-2 border-black px-2 uppercase"
                    />
                  </div>

                  <div>
                    <label className="block font-bold uppercase">Series Name *</label>
                    <input
                      required
                      value={sName}
                      onChange={(e) => setSName(e.target.value)}
                      placeholder="e.g. B-Series or Corporate"
                      className="mt-1 h-9 w-full border-2 border-black px-2"
                    />
                  </div>

                  <div>
                    <label className="block font-bold uppercase">Display Prefix</label>
                    <input
                      value={sPrefix}
                      onChange={(e) => setSPrefix(e.target.value)}
                      placeholder="e.g. B-"
                      className="mt-1 h-9 w-full border-2 border-black px-2"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-4 border-t border-stone-300">
                    <button
                      type="button"
                      onClick={() => setShowSeriesModal(false)}
                      className="border-2 border-black bg-white px-4 py-2 font-bold uppercase shadow-[2px_2px_0_#0C0C0C]"
                    >
                      Cancel
                    </button>
                    <button
                      disabled={saveSeriesMutation.isPending}
                      className="border-2 border-black bg-[#C94A00] px-5 py-2 font-bold uppercase text-white shadow-[2px_2px_0_#0C0C0C] disabled:opacity-50"
                    >
                      {saveSeriesMutation.isPending ? "Creating…" : "Save Series"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* 3. Add Record · Charge Modal */}
          {showChargeModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
              <div className="w-full max-w-lg border-4 border-black bg-[#FAF6EE] shadow-[8px_8px_0_#0C0C0C]">
                <div className="flex items-center justify-between border-b-2 border-black bg-[#0C0C0C] p-4 text-white">
                  <h3 className="font-serif text-xl font-bold uppercase tracking-wider">
                    ADD RECORD · CHARGE
                  </h3>
                  <button onClick={() => setShowChargeModal(false)} className="text-white hover:text-[#C94A00]">
                    <X className="h-6 w-6" />
                  </button>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    saveChargeMutation.mutate();
                  }}
                  className="space-y-4 p-6 text-xs font-mono"
                >
                  {chargeFormError && (
                    <div className="border-2 border-red-700 bg-red-50 p-2 font-bold text-red-800">
                      {chargeFormError}
                    </div>
                  )}

                  <div>
                    <label className="block font-bold uppercase">Client *</label>
                    <select
                      required
                      value={chClientId}
                      onChange={(e) => {
                        const cid = e.target.value;
                        setChClientId(cid);
                        const rate = clientRatesMap[cid]?.[chStage];
                        if (rate && rate > 0) setChAmount(String(rate));
                      }}
                      className="mt-1 h-9 w-full border-2 border-black bg-white px-2"
                    >
                      <option value="">Select Client</option>
                      {clientsList.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.client_code} — {c.client_name || "Client"}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold uppercase">TM Number (optional for S1)</label>
                      <input
                        value={chTM}
                        onChange={(e) => setChTM(e.target.value)}
                        onBlur={() => handleLookupTm("ch", chTM)}
                        placeholder="e.g. 123456"
                        className="mt-1 h-9 w-full border-2 border-black px-2 uppercase"
                      />
                    </div>

                    <div>
                      <label className="block font-bold uppercase">Folder No</label>
                      <input
                        value={chFolder}
                        onChange={(e) => setChFolder(e.target.value)}
                        placeholder="e.g. F-102"
                        className="mt-1 h-9 w-full border-2 border-black px-2"
                      />
                    </div>
                  </div>

                  {chTmMatchInfo && (
                    <div className="border border-stone-400 bg-white p-2 text-[11px] text-[#0A6B52] font-bold">
                      {chTmMatchInfo}
                    </div>
                  )}

                  <div>
                    <label className="block font-bold uppercase">Application Name</label>
                    <input
                      value={chAppName}
                      onChange={(e) => setChAppName(e.target.value)}
                      placeholder="Trademark Title or Mark"
                      className="mt-1 h-9 w-full border-2 border-black px-2 font-sans"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold uppercase">Stage *</label>
                      <select
                        value={chStage}
                        onChange={(e) => {
                          const st = e.target.value as "S1" | "S2" | "S3" | "S4";
                          setChStage(st);
                          const rate = clientRatesMap[chClientId]?.[st];
                          if (rate && rate > 0) setChAmount(String(rate));
                        }}
                        className="mt-1 h-9 w-full border-2 border-black bg-white px-2"
                      >
                        {STAGES.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold uppercase">Amount Due (PKR) *</label>
                      <input
                        required
                        type="number"
                        min="1"
                        value={chAmount}
                        onChange={(e) => setChAmount(e.target.value)}
                        className="mt-1 h-9 w-full border-2 border-black px-2 font-bold text-base"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold uppercase">Date</label>
                      <input
                        type="date"
                        value={chDate}
                        onChange={(e) => setChDate(e.target.value)}
                        className="mt-1 h-9 w-full border-2 border-black px-2"
                      />
                    </div>

                    <div>
                      <label className="block font-bold uppercase">Details</label>
                      <input
                        value={chDetails}
                        onChange={(e) => setChDetails(e.target.value)}
                        placeholder="Stage filing charge"
                        className="mt-1 h-9 w-full border-2 border-black px-2 font-sans"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-4 border-t border-stone-300">
                    <button
                      type="button"
                      onClick={() => setShowChargeModal(false)}
                      className="border-2 border-black bg-white px-4 py-2 font-bold uppercase shadow-[2px_2px_0_#0C0C0C]"
                    >
                      Cancel
                    </button>
                    <button
                      disabled={saveChargeMutation.isPending}
                      className="border-2 border-black bg-[#C94A00] px-5 py-2 font-bold uppercase text-white shadow-[2px_2px_0_#0C0C0C] disabled:opacity-50"
                    >
                      {saveChargeMutation.isPending ? "Posting…" : "Post Charge"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* 4. Add Receiving · Payment Modal */}
          {showReceivingModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
              <div className="w-full max-w-lg border-4 border-black bg-[#FAF6EE] shadow-[8px_8px_0_#0C0C0C]">
                <div className="flex items-center justify-between border-b-2 border-black bg-[#0C0C0C] p-4 text-white">
                  <h3 className="font-serif text-xl font-bold uppercase tracking-wider">
                    ADD RECEIVING · PAYMENT
                  </h3>
                  <button onClick={() => setShowReceivingModal(false)} className="text-white hover:text-[#C94A00]">
                    <X className="h-6 w-6" />
                  </button>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    saveReceivingMutation.mutate();
                  }}
                  className="space-y-4 p-6 text-xs font-mono"
                >
                  {receivingFormError && (
                    <div className="border-2 border-red-700 bg-red-50 p-2 font-bold text-red-800">
                      {receivingFormError}
                    </div>
                  )}

                  <div>
                    <label className="block font-bold uppercase">Client *</label>
                    <select
                      required
                      value={rcClientId}
                      onChange={(e) => setRcClientId(e.target.value)}
                      className="mt-1 h-9 w-full border-2 border-black bg-white px-2"
                    >
                      <option value="">Select Client</option>
                      {clientsList.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.client_code} — {c.client_name || "Client"}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold uppercase">TM (lookup)</label>
                      <input
                        value={rcTM}
                        onChange={(e) => setRcTM(e.target.value)}
                        onBlur={() => handleLookupTm("rc", rcTM)}
                        placeholder="e.g. 123456"
                        className="mt-1 h-9 w-full border-2 border-black px-2 uppercase"
                      />
                    </div>

                    <div>
                      <label className="block font-bold uppercase">Stage</label>
                      <select
                        value={rcStage}
                        onChange={(e) => setRcStage(e.target.value)}
                        className="mt-1 h-9 w-full border-2 border-black bg-white px-2"
                      >
                        <option value="">General / Unallocated</option>
                        <option value="S1">Stage 1</option>
                        <option value="S2">Stage 2</option>
                        <option value="S3">Stage 3</option>
                        <option value="S4">Stage 4</option>
                      </select>
                    </div>
                  </div>

                  {rcTmMatchInfo && (
                    <div className="border border-stone-400 bg-white p-2 text-[11px] text-[#0A6B52] font-bold">
                      {rcTmMatchInfo}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold uppercase">Amount Received (PKR) *</label>
                      <input
                        required
                        type="number"
                        min="1"
                        value={rcAmount}
                        onChange={(e) => setRcAmount(e.target.value)}
                        className="mt-1 h-9 w-full border-2 border-black px-2 font-bold text-base"
                      />
                    </div>

                    <div>
                      <label className="block font-bold uppercase">Payment Method *</label>
                      <select
                        value={rcMethod}
                        onChange={(e) => setRcMethod(e.target.value)}
                        className="mt-1 h-9 w-full border-2 border-black bg-white px-2"
                      >
                        {PAYMENT_METHODS.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold uppercase">Entry Date</label>
                      <input
                        type="date"
                        value={rcDate}
                        onChange={(e) => setRcDate(e.target.value)}
                        className="mt-1 h-9 w-full border-2 border-black px-2"
                      />
                    </div>

                    {rcMethod !== "Cash" && (
                      <div>
                        <label className="block font-bold uppercase">Transfer / Bank Date</label>
                        <input
                          type="date"
                          value={rcBankDate}
                          onChange={(e) => setRcBankDate(e.target.value)}
                          className="mt-1 h-9 w-full border-2 border-black px-2"
                        />
                      </div>
                    )}
                  </div>

                  {/* Link to specific unpaid charge */}
                  <div>
                    <label className="block font-bold uppercase">Link to Specific Charge</label>
                    <select
                      value={rcLinkedChargeId}
                      onChange={(e) => {
                        const chId = e.target.value;
                        setRcLinkedChargeId(chId);
                        const chEntry = activeEntries.find((item) => item.id === chId);
                        if (chEntry?.stage) setRcStage(chEntry.stage);
                        if (chEntry?.amount_due) setRcAmount(String(chEntry.amount_due));
                      }}
                      className="mt-1 h-9 w-full border-2 border-black bg-white px-2 text-xs"
                    >
                      <option value="">— None (Standard Payment) —</option>
                      {activeEntries
                        .filter(
                          (e) =>
                            e.client_id === rcClientId &&
                            e.entry_type === "charge" &&
                            !e.voided_at
                        )
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {shortDate(c.entry_date)} · {c.stage || "No Stage"} · Due PKR {fmt(c.amount_due)} (
                            {c.ledger_cases?.tm_no || c.details})
                          </option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold uppercase">Notes / Transaction Reference</label>
                    <input
                      value={rcNotes}
                      onChange={(e) => setRcNotes(e.target.value)}
                      placeholder="Bank reference number, cheque number, or deposit slip info"
                      className="mt-1 h-9 w-full border-2 border-black px-2 font-sans"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-4 border-t border-stone-300">
                    <button
                      type="button"
                      onClick={() => setShowReceivingModal(false)}
                      className="border-2 border-black bg-white px-4 py-2 font-bold uppercase shadow-[2px_2px_0_#0C0C0C]"
                    >
                      Cancel
                    </button>
                    <button
                      disabled={saveReceivingMutation.isPending}
                      className="border-2 border-black bg-[#0A6B52] px-5 py-2 font-bold uppercase text-white shadow-[2px_2px_0_#0C0C0C] disabled:opacity-50"
                    >
                      {saveReceivingMutation.isPending ? "Saving…" : "Save Payment"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* 5. Case Modal (New / Edit) */}
          {showCaseModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
              <div className="w-full max-w-md border-4 border-black bg-[#FAF6EE] shadow-[8px_8px_0_#0C0C0C]">
                <div className="flex items-center justify-between border-b-2 border-black bg-[#0C0C0C] p-4 text-white">
                  <h3 className="font-serif text-xl font-bold uppercase tracking-wider">
                    {editingCaseId ? "EDIT CASE · TM" : "NEW CASE · TM"}
                  </h3>
                  <button onClick={() => setShowCaseModal(false)} className="text-white hover:text-[#C94A00]">
                    <X className="h-6 w-6" />
                  </button>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    saveCaseMutation.mutate();
                  }}
                  className="space-y-4 p-6 text-xs font-mono"
                >
                  {caseFormError && (
                    <div className="border-2 border-red-700 bg-red-50 p-2 font-bold text-red-800">
                      {caseFormError}
                    </div>
                  )}

                  <div>
                    <label className="block font-bold uppercase">TM Number</label>
                    <input
                      value={csTM}
                      onChange={(e) => setCsTM(e.target.value)}
                      placeholder="e.g. 123456"
                      className="mt-1 h-9 w-full border-2 border-black px-2 uppercase"
                    />
                  </div>

                  <div>
                    <label className="block font-bold uppercase">Folder No</label>
                    <input
                      value={csFolder}
                      onChange={(e) => setCsFolder(e.target.value)}
                      placeholder="e.g. F-101"
                      className="mt-1 h-9 w-full border-2 border-black px-2"
                    />
                  </div>

                  <div>
                    <label className="block font-bold uppercase">Application Name</label>
                    <input
                      value={csAppName}
                      onChange={(e) => setCsAppName(e.target.value)}
                      placeholder="Brand or mark title"
                      className="mt-1 h-9 w-full border-2 border-black px-2 font-sans"
                    />
                  </div>

                  <div>
                    <label className="block font-bold uppercase">Case Reference</label>
                    <input
                      value={csCaseRef}
                      onChange={(e) => setCsCaseRef(e.target.value)}
                      placeholder="e.g. BX-REF-2026"
                      className="mt-1 h-9 w-full border-2 border-black px-2"
                    />
                  </div>

                  <div>
                    <label className="block font-bold uppercase">Notes</label>
                    <textarea
                      value={csNotes}
                      onChange={(e) => setCsNotes(e.target.value)}
                      className="mt-1 min-h-16 w-full border-2 border-black p-2 font-sans"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-4 border-t border-stone-300">
                    <button
                      type="button"
                      onClick={() => setShowCaseModal(false)}
                      className="border-2 border-black bg-white px-4 py-2 font-bold uppercase shadow-[2px_2px_0_#0C0C0C]"
                    >
                      Cancel
                    </button>
                    <button
                      disabled={saveCaseMutation.isPending}
                      className="border-2 border-black bg-[#C94A00] px-5 py-2 font-bold uppercase text-white shadow-[2px_2px_0_#0C0C0C] disabled:opacity-50"
                    >
                      {saveCaseMutation.isPending ? "Saving…" : "Save Case"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* 6. Link CMS Trademark Modal */}
          {showLinkCmsModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
              <div className="w-full max-w-lg border-4 border-black bg-[#FAF6EE] shadow-[8px_8px_0_#0C0C0C]">
                <div className="flex items-center justify-between border-b-2 border-black bg-[#0C0C0C] p-4 text-white">
                  <h3 className="font-serif text-xl font-bold uppercase tracking-wider">
                    LINK CASE TO CMS TRADEMARK
                  </h3>
                  <button onClick={() => setShowLinkCmsModal(false)} className="text-white hover:text-[#C94A00]">
                    <X className="h-6 w-6" />
                  </button>
                </div>

                <div className="space-y-4 p-6 text-xs font-mono">
                  <p className="text-stone-700 font-sans">
                    Authorizing a verified link binds this ledger case to the CMS Trademark workflow,
                    enforcing stage-payment clearance rules.
                  </p>

                  <div>
                    <label className="block font-bold uppercase">Select CMS Trademark *</label>
                    <select
                      value={linkCmsId}
                      onChange={(e) => setLinkCmsId(e.target.value)}
                      className="mt-1 h-10 w-full border-2 border-black bg-white px-2"
                    >
                      <option value="">— Select CMS Trademark —</option>
                      {cmsTrademarks.map((t) => (
                        <option key={t.id} value={t.id}>
                          TM {t.tm_number || "—"} · {t.trademark_name || "Matter"} ({t.client_code || "No Client"}) [
                          {t.stage_status || "Active"}]
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold uppercase">Audit Reason * (min 3 chars)</label>
                    <input
                      required
                      value={linkAuditReason}
                      onChange={(e) => setLinkAuditReason(e.target.value)}
                      placeholder="e.g. Verified by Admin against physical file"
                      className="mt-1 h-9 w-full border-2 border-black px-2 font-sans"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-4 border-t border-stone-300">
                    <button
                      type="button"
                      onClick={() => setShowLinkCmsModal(false)}
                      className="border-2 border-black bg-white px-4 py-2 font-bold uppercase shadow-[2px_2px_0_#0C0C0C]"
                    >
                      Cancel
                    </button>
                    <button
                      disabled={linkCmsMutation.isPending}
                      onClick={() => linkCmsMutation.mutate()}
                      className="border-2 border-black bg-[#0A6B52] px-5 py-2 font-bold uppercase text-white shadow-[2px_2px_0_#0C0C0C] disabled:opacity-50"
                    >
                      {linkCmsMutation.isPending ? "Linking…" : "Authorize Link"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 7. Void Entry Modal */}
          {voidEntryId && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
              <div className="w-full max-w-md border-4 border-black bg-[#FAF6EE] shadow-[8px_8px_0_#0C0C0C]">
                <div className="flex items-center justify-between border-b-2 border-black bg-red-950 p-4 text-white">
                  <h3 className="font-serif text-xl font-bold uppercase tracking-wider">
                    CONFIRM VOID ENTRY
                  </h3>
                  <button onClick={() => setVoidEntryId(null)} className="text-white hover:text-[#C94A00]">
                    <X className="h-6 w-6" />
                  </button>
                </div>

                <div className="space-y-4 p-6 text-xs font-mono">
                  <p className="text-stone-700 font-sans">
                    Voiding this entry retains its history for auditing, but deducts the amounts from the client
                    balance and reopens any cleared stage gates.
                  </p>

                  <div>
                    <label className="block font-bold uppercase">Audit Void Reason * (min 3 chars)</label>
                    <input
                      required
                      value={voidReason}
                      onChange={(e) => setVoidReason(e.target.value)}
                      placeholder="e.g. INCORRECT CHEQUE NUMBER or DUPLICATE RECORDING"
                      className="mt-1 h-9 w-full border-2 border-black px-2 uppercase font-mono"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-4 border-t border-stone-300">
                    <button
                      type="button"
                      onClick={() => setVoidEntryId(null)}
                      className="border-2 border-black bg-white px-4 py-2 font-bold uppercase shadow-[2px_2px_0_#0C0C0C]"
                    >
                      Cancel
                    </button>
                    <button
                      disabled={voidMutation.isPending}
                      onClick={() => voidMutation.mutate()}
                      className="border-2 border-black bg-red-700 px-5 py-2 font-bold uppercase text-white shadow-[2px_2px_0_#0C0C0C] disabled:opacity-50"
                    >
                      {voidMutation.isPending ? "Voiding…" : "Confirm Void"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
