import { X, Printer, CheckCircle } from "lucide-react";

interface ReceiptPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  receipt: {
    receipt_no?: string;
    receiptNo?: string;
    caseTitle?: string;
    appName?: string;
    tmNumber?: string | null;
    clientCode?: string | null;
    amount?: number | string;
    stage?: string;
    entry_date?: string;
    entryDate?: string;
    payment_method?: string;
    paymentMethod?: string;
    bank_name?: string;
    bankName?: string;
    cheque_no?: string;
    chequeNo?: string;
    notes?: string;
  } | null;
}

export function ReceiptPrintModal({ isOpen, onClose, receipt }: ReceiptPrintModalProps) {
  if (!isOpen || !receipt) return null;

  const receiptNumber = receipt.receipt_no || receipt.receiptNo || "BX-REC-ORIGINAL";
  const caseName = receipt.caseTitle || receipt.appName || "TRADEMARK CASE";
  const amount = Number(receipt.amount || 0);
  const date = receipt.entry_date || receipt.entryDate || new Date().toISOString().slice(0, 10);
  const stage = receipt.stage || "S1";
  const method = receipt.payment_method || receipt.paymentMethod || "Bank Transfer";
  const bank = receipt.bank_name || receipt.bankName || "Brandex Bank Account";
  const ref = receipt.cheque_no || receipt.chequeNo || "";

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-2xl bg-[#FAF6EE] border-[3px] border-[#0C0C0C] shadow-[8px_8px_0_#0C0C0C] flex flex-col max-h-[92vh] overflow-hidden">
        {/* Modal Controls (Hidden in Print) */}
        <div className="bg-[#0C0C0C] text-[#FAF6EE] px-5 py-3 flex items-center justify-between border-b-2 border-[#0C0C0C] print:hidden">
          <div className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wider text-[#D4A800]">
            <CheckCircle className="w-4 h-4 text-[#0D9970]" />
            <span>OFFICIAL RECEIPT VOUCHER &middot; {receiptNumber}</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="bg-[#0A6B52] text-white border-2 border-white px-3 py-1 font-mono text-xs font-bold uppercase flex items-center gap-1.5 shadow-[2px_2px_0_#0C0C0C] hover:brightness-110"
            >
              <Printer className="w-3.5 h-3.5" />
              PRINT RECEIPT
            </button>
            <button onClick={onClose} className="text-stone-400 hover:text-white p-1">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Receipt Paper */}
        <div className="p-6 sm:p-8 overflow-y-auto bg-white font-sans text-[#0C0C0C] space-y-6 print:p-0 print:m-0">
          {/* Header */}
          <div className="border-b-[3px] border-[#0C0C0C] pb-4 flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-[#C94A00] border-2 border-[#0C0C0C] rounded-[4px] flex items-center justify-center font-serif text-3xl text-white">
                B
              </div>
              <div>
                <h1 className="font-serif text-2xl sm:text-3xl tracking-wide leading-none text-[#0C0C0C]">
                  BRANDEX LAW ASSOCIATES
                </h1>
                <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-[#C94A00] mt-0.5">
                  Advocates &bull; Trademark Attorneys &bull; IP Consultants
                </p>
                <p className="font-mono text-[10px] text-stone-600 mt-0.5">
                  info@brandex.pk &bull; brandex.pk &bull; +92 336 0015009
                </p>
              </div>
            </div>

            <div className="text-right font-mono">
              <div className="text-[10px] font-bold uppercase text-stone-500">RECEIPT NO.</div>
              <div className="text-base font-bold text-[#0C0C0C]">{receiptNumber}</div>
              <div className="text-[11px] text-stone-600 mt-1">DATE: {date}</div>
            </div>
          </div>

          {/* Acknowledgement Statement */}
          <div className="bg-[#FAF6EE] border-2 border-[#0C0C0C] p-4 font-mono text-xs space-y-2">
            <div className="flex items-center justify-between border-b border-stone-300 pb-2">
              <span className="text-stone-600 uppercase">Received With Thanks From:</span>
              <span className="font-bold text-[#0C0C0C] text-sm uppercase">
                {receipt.clientCode || "CLIENT ACCOUNT"}
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-stone-300 pb-2">
              <span className="text-stone-600 uppercase">Trademark Application / Case:</span>
              <span className="font-bold text-[#0C0C0C] text-sm uppercase">
                {caseName}
              </span>
            </div>
            {receipt.tmNumber && (
              <div className="flex items-center justify-between border-b border-stone-300 pb-2">
                <span className="text-stone-600 uppercase">IPO TM CPR Number:</span>
                <span className="font-bold text-[#0C0C0C]">{receipt.tmNumber}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-stone-600 uppercase">Stage Allocation:</span>
              <span className="font-bold text-[#0A6B52] uppercase bg-[#0D9970]/10 border border-[#0A6B52] px-2 py-0.5">
                {stage === "S1"
                  ? "Stage 1 (Filing & Examination)"
                  : stage === "S2"
                  ? "Stage 2 (Assignment & Hearing)"
                  : stage === "S3"
                  ? "Stage 3 (Publication & Opposition)"
                  : "Stage 4 (Certificate Dispatch)"}
              </span>
            </div>
          </div>

          {/* Payment Amount Card */}
          <div className="border-[3px] border-[#0C0C0C] bg-[#FAF6EE] p-5 flex items-center justify-between shadow-[4px_4px_0_#0C0C0C]">
            <div>
              <div className="font-mono text-xs uppercase font-bold text-stone-600">
                Amount Received (Net Cleared)
              </div>
              <div className="font-mono text-xs text-stone-600 mt-1">
                Via: <span className="font-bold uppercase text-[#0C0C0C]">{method}</span> &bull; {bank}
                {ref ? ` (Ref: ${ref})` : ""}
              </div>
            </div>
            <div className="text-right">
              <div className="font-serif text-3xl sm:text-4xl text-[#0A6B52] leading-none">
                PKR {amount.toLocaleString()}
              </div>
              <div className="font-mono text-[10px] font-bold uppercase text-[#0A6B52] mt-1">
                STATUS: FULLY CLEARED / VERIFIED
              </div>
            </div>
          </div>

          {receipt.notes && (
            <div className="border border-stone-300 p-3 font-mono text-xs text-stone-700 bg-stone-50">
              <span className="font-bold text-stone-900">Notes: </span>
              {receipt.notes}
            </div>
          )}

          {/* Bank Accounts Footer for Client Verification */}
          <div className="pt-4 border-t-2 border-[#0C0C0C] text-[10px] font-mono text-stone-600 space-y-1">
            <div className="font-bold uppercase text-[#0C0C0C]">Brandex Official Accounts:</div>
            <div>&bull; United Bank Limited (UBL) - Title: Brandex Pk - A/C: 0209301813886 (IBAN: PK85UNIL0109000301813886)</div>
            <div>&bull; Meezan Bank Limited - Title: Brandex.pk - A/C: 9814-0104862477 (IBAN: PK12MEZN0098140104862477)</div>
            <div>&bull; EasyPaisa (Till 214114) / JazzCash (Raast): 0336-0015009</div>
          </div>

          {/* Signatures */}
          <div className="pt-8 flex justify-between items-end font-mono text-xs border-t border-dashed border-stone-300">
            <div>
              <div className="w-36 border-b border-[#0C0C0C] mb-1" />
              <div className="text-[10px] uppercase text-stone-500">Prepared By (Staff)</div>
            </div>
            <div className="text-right">
              <div className="w-48 border-b border-[#0C0C0C] mb-1 ml-auto" />
              <div className="text-[10px] uppercase text-stone-500">Authorized Signatory / Seal</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
