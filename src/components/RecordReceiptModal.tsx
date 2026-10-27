import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Check, CreditCard, DollarSign, Building, FileText, Calendar } from "lucide-react";
import { recordClientReceipt, type RecordReceiptParams } from "@/lib/ledgerPayments";

const STAGE_NAMES = {
  S1: "Stage 1 — Filing and Acknowledgement",
  S2: "Stage 2 — Assignment and Outcome",
  S3: "Stage 3 — Publication and Demand Note",
  S4: "Stage 4 — Certificate (CER) Processing",
};

const BANK_CHOICES = [
  { name: "United Bank Limited (UBL)", account: "0209301813886" },
  { name: "Meezan Bank Limited", account: "9814-0104862477" },
  { name: "EasyPaisa / Till 214114", account: "0336-0015009" },
  { name: "JazzCash / Raast", account: "0336-0015004" },
  { name: "Cash in Hand", account: "Office Cash Box" },
];

interface RecordReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  trademarkId: string;
  caseTitle: string;
  tmNumber?: string | null;
  clientCode?: string | null;
  initialStage?: "S1" | "S2" | "S3" | "S4";
  onReceiptRecorded?: (receipt: any) => void;
}

export function RecordReceiptModal({
  isOpen,
  onClose,
  trademarkId,
  caseTitle,
  tmNumber,
  clientCode,
  initialStage = "S1",
  onReceiptRecorded,
}: RecordReceiptModalProps) {
  const queryClient = useQueryClient();
  const [stage, setStage] = useState<"S1" | "S2" | "S3" | "S4">(initialStage);
  const [amount, setAmount] = useState<number | "">("");
  const [entryDate, setEntryDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "bank_transfer" | "cheque" | "online" | "other">("bank_transfer");
  const [bankName, setBankName] = useState<string>(BANK_CHOICES[0].name);
  const [chequeNo, setChequeNo] = useState<string>("");
  const [receiptNo, setReceiptNo] = useState<string>("");
  const [details, setDetails] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setStage(initialStage);
      setAmount("");
      setEntryDate(new Date().toISOString().slice(0, 10));
      setChequeNo("");
      setNotes("");
      setErrorMsg(null);
      setReceiptNo("");
      setDetails(`${STAGE_NAMES[initialStage]} receipt for ${caseTitle}`);
    }
  }, [isOpen, initialStage, caseTitle]);

  const mutation = useMutation({
    mutationFn: (params: RecordReceiptParams) => recordClientReceipt(params),
    onSuccess: (receiptData) => {
      queryClient.invalidateQueries({ queryKey: ["payments-case-page"] });
      queryClient.invalidateQueries({ queryKey: ["payments-ledger-status"] });
      queryClient.invalidateQueries({ queryKey: ["trademark", trademarkId] });
      queryClient.invalidateQueries({ queryKey: ["client-ledger-entries", trademarkId] });
      queryClient.invalidateQueries({ queryKey: ["ledger-payment-status"] });
      if (onReceiptRecorded) {
        onReceiptRecorded({
          ...receiptData,
          caseTitle,
          tmNumber,
          clientCode,
          amount,
          stage,
          paymentMethod,
          bankName,
          chequeNo,
          entryDate,
          receiptNo,
          notes,
        });
      }
      onClose();
    },
    onError: (err: Error) => {
      setErrorMsg(err.message || "Failed to record client receipt.");
    },
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      setErrorMsg("Please enter a valid receipt amount in PKR (greater than zero).");
      return;
    }

    mutation.mutate({
      trademarkId,
      stage,
      amount: numAmount,
      entryDate,
      paymentMethod,
      bankName: paymentMethod === "cash" ? "Cash" : bankName,
      chequeNo: chequeNo || undefined,
      receiptNo: undefined,
      details,
      notes,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-xl bg-[#FAF6EE] border-[3px] border-[#0C0C0C] shadow-[8px_8px_0_#0C0C0C] overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-[#0C0C0C] text-[#FAF6EE] px-5 py-3.5 flex items-center justify-between border-b-2 border-[#0C0C0C]">
          <div className="flex items-center gap-2 font-mono text-sm font-bold uppercase tracking-wider text-[#D4A800]">
            <CreditCard className="w-4 h-4 text-[#0D9970]" />
            <span>RECORD CLIENT RECEIPT (LEDGER)</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-stone-400 hover:text-white p-1 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4">
          {/* Case Context Card */}
          <div className="border-2 border-[#0C0C0C] bg-[#E8DFC7] p-3 font-mono text-xs space-y-1">
            <div className="text-[10px] uppercase font-bold text-stone-600">Case Account</div>
            <div className="font-sans font-bold text-base text-[#0C0C0C] truncate uppercase">
              {caseTitle}
            </div>
            <div className="text-stone-700">
              {clientCode ? `CLIENT: ${clientCode}` : "NO CLIENT CODE"} &middot; {tmNumber ? `TM NO: ${tmNumber}` : "PENDING TM NUMBER"}
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 border-2 border-[#CC0000] bg-[#FFF0F0] text-[#CC0000] font-mono text-xs font-bold">
              {errorMsg}
            </div>
          )}

          {/* Stage & Amount */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-xs font-bold uppercase text-[#0C0C0C] mb-1">
                Target Stage
              </label>
              <select
                value={stage}
                onChange={(e) => {
                  const s = e.target.value as "S1" | "S2" | "S3" | "S4";
                  setStage(s);
                  setDetails(`${STAGE_NAMES[s]} receipt for ${caseTitle}`);
                }}
                className="w-full h-10 px-3 bg-white border-2 border-[#0C0C0C] font-mono text-xs font-bold uppercase shadow-[2px_2px_0_#0C0C0C] focus:outline-none"
              >
                <option value="S1">STAGE 1: FILING & EXAM</option>
                <option value="S2">STAGE 2: ASSIGN & HEARING</option>
                <option value="S3">STAGE 3: PUBLICATION & OPPO</option>
                <option value="S4">STAGE 4 — CERTIFICATE (CER) PROCESSING</option>
              </select>
            </div>

            <div>
              <label className="block font-mono text-xs font-bold uppercase text-[#0C0C0C] mb-1">
                Amount Received (PKR) *
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="1"
                  min="1"
                  required
                  placeholder="e.g. 15000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value ? Number(e.target.value) : "")}
                  className="w-full h-10 px-3 pr-12 bg-white border-2 border-[#0C0C0C] font-mono text-sm font-bold shadow-[2px_2px_0_#0C0C0C] focus:outline-none"
                />
                <span className="absolute right-3 top-2.5 font-mono text-xs font-bold text-stone-500">
                  PKR
                </span>
              </div>
            </div>
          </div>

          {/* Receipt serial is generated centrally by the database. */}
          <div>
            <label className="block font-mono text-xs font-bold uppercase text-[#0C0C0C] mb-1">Receipt Date</label>
            <input type="date" required value={entryDate} onChange={(e) => setEntryDate(e.target.value)} className="w-full h-10 px-3 bg-white border-2 border-[#0C0C0C] font-mono text-xs font-bold shadow-[2px_2px_0_#0C0C0C] focus:outline-none" />
            <p className="mt-1 font-mono text-[10px] text-stone-600">Official receipt number will be generated by the ledger.</p>
          </div>

          {/* Payment Method & Bank */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-xs font-bold uppercase text-[#0C0C0C] mb-1">
                Payment Channel
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as any)}
                className="w-full h-10 px-3 bg-white border-2 border-[#0C0C0C] font-mono text-xs font-bold uppercase shadow-[2px_2px_0_#0C0C0C] focus:outline-none"
              >
                <option value="bank_transfer">BANK TRANSFER / WIRE</option>
                <option value="cash">CASH AT COUNTER</option>
                <option value="cheque">CHEQUE / PAY ORDER</option>
                <option value="online">ONLINE (RAAST / JAZZCASH / EASYPAISA)</option>
                <option value="other">OTHER</option>
              </select>
            </div>

            <div>
              <label className="block font-mono text-xs font-bold uppercase text-[#0C0C0C] mb-1">
                Account / Bank Deposited
              </label>
              <select
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                disabled={paymentMethod === "cash"}
                className="w-full h-10 px-3 bg-white border-2 border-[#0C0C0C] font-mono text-xs font-bold uppercase shadow-[2px_2px_0_#0C0C0C] focus:outline-none disabled:opacity-50"
              >
                {BANK_CHOICES.map((b) => (
                  <option key={b.name} value={b.name}>
                    {b.name} ({b.account})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Cheque or Transaction Reference */}
          <div>
            <label className="block font-mono text-xs font-bold uppercase text-[#0C0C0C] mb-1">
              Bank Ref / Cheque No. / Transaction ID (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. UBL-TRX-839210 or Cheque # 449201"
              value={chequeNo}
              onChange={(e) => setChequeNo(e.target.value)}
              className="w-full h-10 px-3 bg-white border-2 border-[#0C0C0C] font-mono text-xs font-bold shadow-[2px_2px_0_#0C0C0C] focus:outline-none uppercase"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block font-mono text-xs font-bold uppercase text-[#0C0C0C] mb-1">
              Accounting Notes (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Received via client representative, includes IPO official fee."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-2.5 bg-white border-2 border-[#0C0C0C] font-mono text-xs shadow-[2px_2px_0_#0C0C0C] focus:outline-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t-2 border-[#0C0C0C] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={mutation.isPending}
              className="px-4 py-2 bg-white border-2 border-[#0C0C0C] font-mono text-xs font-bold uppercase shadow-[2px_2px_0_#0C0C0C] hover:bg-stone-100"
            >
              CANCEL
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-5 py-2 bg-[#0A6B52] text-white border-2 border-[#0C0C0C] font-mono text-xs font-bold uppercase shadow-[3px_3px_0_#0C0C0C] hover:brightness-110 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              {mutation.isPending ? "POSTING RECEIPT…" : "POST RECEIPT & UNLOCK STAGE"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
