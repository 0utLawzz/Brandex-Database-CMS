import { listAgentProfiles, createAgentProfile, updateAgentProfile, listFeesForAgent, deleteAgentFee, getAgentCaseCounts, type AgentWithStats, type AgentFee, type AgentInput, type AgentCaseCounts } from "@/lib/api";
import { AppShell } from "@/components/layout/AppShell";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, Plus, Edit, Trash2, ChevronLeft, ChevronRight, X, AlertCircle, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const PAGE_SIZE = 20;

interface Filters {
  showInactive: boolean;
}

const EMPTY: Filters = { showInactive: false };

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function AgentsPage() {
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [page, setPage] = useState(1);
  const [selectedAgent, setSelectedAgent] = useState<AgentWithStats | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<AgentInput>({ name: "" });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: agents = [], isLoading } = useQuery({
    queryKey: ["agent-profiles", filters],
    queryFn: listAgentProfiles,
    staleTime: 60_000,
  });

  const { data: agentFees = [], isLoading: feesLoading } = useQuery({
    queryKey: ["agent-fees", selectedAgent?.id],
    queryFn: () => selectedAgent ? listFeesForAgent(selectedAgent.id) : [],
    enabled: !!selectedAgent,
    staleTime: 30_000,
  });

  const { data: caseCounts, isLoading: caseCountsLoading } = useQuery<AgentCaseCounts>({
    queryKey: ["agent-case-counts", selectedAgent?.name],
    queryFn: () => getAgentCaseCounts(selectedAgent!.name),
    enabled: !!selectedAgent && !isEditing,
    staleTime: 60_000,
  });

  const createMutation = useMutation({
    mutationFn: createAgentProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-profiles"] });
      toast({ title: "Agent created successfully" });
      setIsEditing(false);
      setEditForm({ name: "" });
    },
    onError: (error) => {
      toast({ title: "Failed to create agent", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<AgentInput> }) => updateAgentProfile(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-profiles"] });
      toast({ title: "Agent updated successfully" });
      setIsEditing(false);
      setSelectedAgent(null);
    },
    onError: (error) => {
      toast({ title: "Failed to update agent", description: error.message, variant: "destructive" });
    },
  });

  const deleteFeeMutation = useMutation({
    mutationFn: deleteAgentFee,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-fees", selectedAgent?.id] });
      queryClient.invalidateQueries({ queryKey: ["agent-profiles"] });
      toast({ title: "Fee entry deleted" });
    },
    onError: (error) => {
      toast({ title: "Failed to delete fee", description: error.message, variant: "destructive" });
    },
  });

  const filteredAgents = agents.filter((agent) => filters.showInactive || agent.isActive);
  const totalPages = Math.max(1, Math.ceil(filteredAgents.length / PAGE_SIZE));
  const pagedAgents = filteredAgents.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleCreateAgent = () => {
    if (!editForm.name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    createMutation.mutate(editForm);
  };

  const handleUpdateAgent = () => {
    if (!selectedAgent || !editForm.name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    updateMutation.mutate({ id: selectedAgent.id, input: editForm });
  };

  const openEditModal = (agent?: AgentWithStats) => {
    if (agent) {
      setSelectedAgent(agent);
      setEditForm({
        name: agent.name,
        city: agent.city || undefined,
        phone: agent.phone || undefined,
        email: agent.email || undefined,
        notes: agent.notes || undefined,
        isActive: agent.isActive,
      });
    } else {
      setSelectedAgent(null);
      setEditForm({ name: "" });
    }
    setIsEditing(true);
  };

  return (
    <AppShell>
      <div className="flex flex-col h-full bg-white">
        <div className="shrink-0 px-6 py-4 bg-[#E8DFC7] border-b-2 border-[#0C0C0C]">
          <div className="flex items-center gap-3 mb-4">
            <Users className="w-5 h-5 text-[#0A6B52]" />
            <h1 className="font-serif text-2xl uppercase tracking-widest text-[#0C0C0C] leading-none">AGENTS</h1>
            <span className="ml-auto font-mono text-[10px] text-[#6d6658] font-bold uppercase tracking-widest">
              {isLoading ? "LOADING…" : `${filteredAgents.length} AGENTS`}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => openEditModal()}
              className="inline-flex items-center gap-2 border-2 border-[#0A6B52] bg-[#D8F2E8] px-4 py-2 font-mono text-xs font-bold uppercase text-[#0A6B52] hover:bg-[#0A6B52] hover:text-white transition-colors"
            >
              <Plus className="h-4 w-4" /> NEW AGENT
            </button>

            <label className="flex items-center gap-2 font-mono text-xs text-[#6d6658]">
              <input
                type="checkbox"
                checked={filters.showInactive}
                onChange={(e) => setFilters({ showInactive: e.target.checked })}
                className="w-4 h-4 border-2 border-[#0C0C0C]"
              />
              SHOW INACTIVE
            </label>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-white">
          <table className="w-full text-left font-mono text-xs whitespace-nowrap border-collapse">
            <thead className="bg-[#0C0C0C] text-[#F0E8D0] sticky top-0 z-10">
              <tr>
                {["NAME", "CITY", "PHONE", "EMAIL", "CASES WITH FEES", "TOTAL BILLED", "TOTAL PAID", "BALANCE DUE", "UNPAID", "STATUS", "ACTIONS"].map((h) => (
                  <th key={h} className="px-3 py-3 border-r border-[#1A1A1A] font-bold tracking-wider uppercase text-[10px] last:border-r-0">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={11} className="px-6 py-12 text-center font-bold text-[#6d6658] animate-pulse">
                    LOADING AGENTS…
                  </td>
                </tr>
              ) : pagedAgents.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-6 py-16 text-center">
                    <div className="font-mono font-bold text-[#6d6658] uppercase tracking-widest mb-1">
                      No agents found.
                    </div>
                    <div className="font-mono text-xs text-[#9d9488]">
                      Create your first agent to get started.
                    </div>
                  </td>
                </tr>
              ) : (
                pagedAgents.map((agent, i) => (
                  <tr
                    key={agent.id}
                    className={`cursor-pointer border-b border-[#0C0C0C]/10 transition-colors ${
                      i % 2 === 0 ? "bg-[#F0E8D0]" : "bg-white"
                    } hover:bg-[#D9D0B7]`}
                    onClick={() => setSelectedAgent(agent)}
                  >
                    <td className="px-3 py-2 border-r border-[#0C0C0C]/10 font-bold">
                      {agent.name}
                    </td>
                    <td className="px-3 py-2 border-r border-[#0C0C0C]/10">
                      {agent.city || "—"}
                    </td>
                    <td className="px-3 py-2 border-r border-[#0C0C0C]/10">
                      {agent.phone || "—"}
                    </td>
                    <td className="px-3 py-2 border-r border-[#0C0C0C]/10">
                      {agent.email || "—"}
                    </td>
                    <td className="px-3 py-2 border-r border-[#0C0C0C]/10 font-bold">
                      {agent.casesWithFees}
                    </td>
                    <td className="px-3 py-2 border-r border-[#0C0C0C]/10">
                      {formatCurrency(agent.totalBilled)}
                    </td>
                    <td className="px-3 py-2 border-r border-[#0C0C0C]/10 text-[#0A6B52]">
                      {formatCurrency(agent.totalPaid)}
                    </td>
                    <td className="px-3 py-2 border-r border-[#0C0C0C]/10 font-bold">
                      {formatCurrency(agent.balanceDue)}
                    </td>
                    <td className="px-3 py-2 border-r border-[#0C0C0C]/10">
                      {agent.unpaidEntries > 0 ? (
                        <span className="inline-flex items-center gap-1 text-[#CC0000] font-bold">
                          <AlertCircle className="h-3 w-3" /> {agent.unpaidEntries}
                        </span>
                      ) : (
                        <span className="text-[#0A6B52]">0</span>
                      )}
                    </td>
                    <td className="px-3 py-2 border-r border-[#0C0C0C]/10">
                      {agent.isActive ? (
                        <span className="inline-block px-1.5 py-0.5 text-[9px] font-bold uppercase border border-[#0C0C0C]/20 bg-[#D8F2E8] text-[#0A6B52]">
                          ACTIVE
                        </span>
                      ) : (
                        <span className="inline-block px-1.5 py-0.5 text-[9px] font-bold uppercase border border-[#0C0C0C]/20 bg-[#F0E8D0] text-[#6d6658]">
                          INACTIVE
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditModal(agent);
                        }}
                        className="inline-flex items-center gap-1 border-2 border-[#0C0C0C] bg-white px-2 py-1 font-mono text-[9px] font-bold uppercase hover:bg-[#0C0C0C] hover:text-white"
                      >
                        <Edit className="h-3 w-3" /> EDIT
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="shrink-0 flex items-center justify-between px-6 py-3 bg-[#E8DFC7] border-t-2 border-[#0C0C0C]">
            <span className="font-mono text-[10px] text-[#6d6658] font-bold uppercase tracking-widest">
              PAGE {page} OF {totalPages} · {filteredAgents.length} AGENTS
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex items-center gap-1 px-3 py-1.5 border-2 border-[#0C0C0C] bg-white font-mono text-[10px] font-bold uppercase tracking-wider disabled:opacity-40 hover:bg-[#0C0C0C] hover:text-[#F0E8D0] transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> PREV
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="flex items-center gap-1 px-3 py-1.5 border-2 border-[#0C0C0C] bg-white font-mono text-[10px] font-bold uppercase tracking-wider disabled:opacity-40 hover:bg-[#0C0C0C] hover:text-[#F0E8D0] transition-colors"
              >
                NEXT <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Agent Detail Modal */}
      {selectedAgent && !isEditing && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#0C0C0C]/55 p-4" onClick={() => setSelectedAgent(null)}>
          <section className="w-full max-w-4xl border-3 border-[#0C0C0C] bg-[#F0E8D0] p-5 shadow-[8px_8px_0_#0C0C0C] max-h-[90vh] overflow-auto" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start gap-3 border-b-2 border-[#0C0C0C] pb-3">
              <div className="min-w-0 flex-1">
                <div className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#6C1C1F]">AGENT DETAIL</div>
                <h2 className="mt-1 font-serif text-3xl uppercase leading-none text-[#0C0C0C]">{selectedAgent.name}</h2>
                <div className="mt-2 font-mono text-xs font-bold uppercase">
                  {selectedAgent.city || "NO CITY"} · {selectedAgent.phone || "NO PHONE"} · {selectedAgent.email || "NO EMAIL"}
                </div>
              </div>
              <button type="button" onClick={() => setSelectedAgent(null)} className="border-2 border-[#0C0C0C] bg-white p-1 hover:bg-[#0C0C0C] hover:text-white" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Case assignment stats — sourced from trademarks.agent text field */}
            <div className="mt-4">
              <div className="font-mono text-[9px] font-bold uppercase tracking-widest text-[#6C1C1F] mb-2">CASE ASSIGNMENT (from trademark records)</div>
              <div className="grid grid-cols-3 gap-2">
                <div className="border-2 border-[#0C0C0C] bg-white p-3 shadow-[2px_2px_0_#0C0C0C]">
                  <span className="block text-[9px] font-bold text-[#6d6658] uppercase">ASSIGNED (STAGE 2)</span>
                  <strong className="font-serif text-2xl text-[#D4A800]">
                    {caseCountsLoading ? "…" : (caseCounts?.assignedCases ?? "—")}
                  </strong>
                </div>
                <div className="border-2 border-[#0C0C0C] bg-white p-3 shadow-[2px_2px_0_#0C0C0C]">
                  <span className="block text-[9px] font-bold text-[#6d6658] uppercase">ACCEPTED (STAGE 2)</span>
                  <strong className="font-serif text-2xl text-[#0A6B52]">
                    {caseCountsLoading ? "…" : (caseCounts?.acceptedCases ?? "—")}
                  </strong>
                </div>
                <div className="border-2 border-[#0C0C0C] bg-white p-3 shadow-[2px_2px_0_#0C0C0C]">
                  <span className="block text-[9px] font-bold text-[#6d6658] uppercase">TOTAL CASES</span>
                  <strong className="font-serif text-2xl">
                    {caseCountsLoading ? "…" : (caseCounts?.totalAssignedCases ?? "—")}
                  </strong>
                </div>
              </div>
              <p className="mt-1 font-mono text-[9px] text-[#9d9488] uppercase tracking-wider">
                Matched by exact agent name — trademarks.agent text field
              </p>
            </div>

            {/* Fee financial stats — from agent_fees via agent_summary view */}
            <div className="mt-3">
              <div className="font-mono text-[9px] font-bold uppercase tracking-widest text-[#6C1C1F] mb-2">FEE FINANCIAL SUMMARY (from agent_fees)</div>
              <div className="grid grid-cols-2 gap-3 border-2 border-[#0C0C0C] bg-white p-3 font-mono text-xs uppercase sm:grid-cols-4">
                <div><span className="block text-[9px] font-bold text-[#6d6658]">CASES W/ FEES</span><strong>{selectedAgent.casesWithFees}</strong></div>
                <div><span className="block text-[9px] font-bold text-[#6d6658]">TOTAL BILLED</span><strong>{formatCurrency(selectedAgent.totalBilled)}</strong></div>
                <div><span className="block text-[9px] font-bold text-[#6d6658]">TOTAL RECEIVED</span><strong className="text-[#0A6B52]">{formatCurrency(selectedAgent.totalPaid)}</strong></div>
                <div><span className="block text-[9px] font-bold text-[#6d6658]">BALANCE</span><strong className={selectedAgent.balanceDue > 0 ? "text-[#CC0000]" : "text-[#0A6B52]"}>{formatCurrency(selectedAgent.balanceDue)}</strong></div>
              </div>
            </div>

            <div className="mt-4">
              <h3 className="font-mono text-sm font-bold uppercase text-[#0C0C0C]">Fee Entries</h3>
              <p className="font-mono text-[10px] text-[#6d6658] mt-1">
                Fees are managed per-case. Open a specific trademark record to add or edit fees.
              </p>
            </div>

            <div className="mt-3 border-2 border-[#0C0C0C] bg-white overflow-auto max-h-60">
              <table className="w-full text-left font-mono text-xs whitespace-nowrap">
                <thead className="bg-[#0C0C0C] text-[#F0E8D0]">
                  <tr>
                    {["CASE", "APP NAME", "DESCRIPTION", "BILLED", "PAID", "BALANCE", "DATE", "PAID", "ACTIONS"].map((h) => (
                      <th key={h} className="px-2 py-2 border-r border-[#1A1A1A] font-bold tracking-wider uppercase text-[9px] last:border-r-0">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {feesLoading ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center font-bold text-[#6d6658] animate-pulse">
                        LOADING FEES…
                      </td>
                    </tr>
                  ) : agentFees.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center font-mono text-xs text-[#9d9488]">
                        No fee entries yet.
                      </td>
                    </tr>
                  ) : (
                    agentFees.map((fee) => (
                      <tr key={fee.id} className="border-b border-[#0C0C0C]/10">
                        <td className="px-2 py-1.5 border-r border-[#0C0C0C]/10 font-bold">{fee.caseNumber || "—"}</td>
                        <td className="px-2 py-1.5 border-r border-[#0C0C0C]/10 max-w-[150px] truncate">{fee.appName || "—"}</td>
                        <td className="px-2 py-1.5 border-r border-[#0C0C0C]/10">{fee.description}</td>
                        <td className="px-2 py-1.5 border-r border-[#0C0C0C]/10">{formatCurrency(fee.amountBilled)}</td>
                        <td className="px-2 py-1.5 border-r border-[#0C0C0C]/10 text-[#0A6B52]">{formatCurrency(fee.amountPaid)}</td>
                        <td className="px-2 py-1.5 border-r border-[#0C0C0C]/10 font-bold">{formatCurrency(fee.balanceDue)}</td>
                        <td className="px-2 py-1.5 border-r border-[#0C0C0C]/10">{fee.feeDate}</td>
                        <td className="px-2 py-1.5 border-r border-[#0C0C0C]/10">
                          {fee.paid ? (
                            <CheckCircle className="h-4 w-4 text-[#0A6B52]" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-[#CC0000]" />
                          )}
                        </td>
                        <td className="px-2 py-1.5">
                          <button
                            onClick={() => deleteFeeMutation.mutate(fee.id)}
                            className="border-2 border-[#CC0000] bg-white px-2 py-1 font-mono text-[9px] font-bold uppercase text-[#CC0000] hover:bg-[#CC0000] hover:text-white transition-colors"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* Edit/Create Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0C0C0C]/55 p-4" onClick={() => setIsEditing(false)}>
          <section className="w-full max-w-md border-3 border-[#0C0C0C] bg-[#F0E8D0] p-5 shadow-[8px_8px_0_#0C0C0C]" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start gap-3 border-b-2 border-[#0C0C0C] pb-3">
              <div className="min-w-0 flex-1">
                <div className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#6C1C1F]">
                  {selectedAgent ? "EDIT AGENT" : "NEW AGENT"}
                </div>
                <h2 className="mt-1 font-serif text-2xl uppercase leading-none text-[#0C0C0C]">
                  {selectedAgent ? selectedAgent.name : "CREATE AGENT"}
                </h2>
              </div>
              <button type="button" onClick={() => setIsEditing(false)} className="border-2 border-[#0C0C0C] bg-white p-1 hover:bg-[#0C0C0C] hover:text-white" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 flex flex-col gap-3">
              <div>
                <label className="font-mono text-[9px] font-bold uppercase text-[#6d6658]">NAME *</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="mt-1 h-10 w-full px-3 border-2 border-[#0C0C0C] font-mono text-sm focus:outline-2 focus:outline-[#C94A00]"
                  placeholder="Agent name"
                />
              </div>
              <div>
                <label className="font-mono text-[9px] font-bold uppercase text-[#6d6658]">CITY</label>
                <input
                  type="text"
                  value={editForm.city || ""}
                  onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                  className="mt-1 h-10 w-full px-3 border-2 border-[#0C0C0C] font-mono text-sm focus:outline-2 focus:outline-[#C94A00]"
                  placeholder="City"
                />
              </div>
              <div>
                <label className="font-mono text-[9px] font-bold uppercase text-[#6d6658]">PHONE</label>
                <input
                  type="text"
                  value={editForm.phone || ""}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="mt-1 h-10 w-full px-3 border-2 border-[#0C0C0C] font-mono text-sm focus:outline-2 focus:outline-[#C94A00]"
                  placeholder="Phone number"
                />
              </div>
              <div>
                <label className="font-mono text-[9px] font-bold uppercase text-[#6d6658]">EMAIL</label>
                <input
                  type="email"
                  value={editForm.email || ""}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="mt-1 h-10 w-full px-3 border-2 border-[#0C0C0C] font-mono text-sm focus:outline-2 focus:outline-[#C94A00]"
                  placeholder="Email address"
                />
              </div>
              {selectedAgent && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={editForm.isActive ?? true}
                    onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                    className="w-4 h-4 border-2 border-[#0C0C0C]"
                  />
                  <label htmlFor="isActive" className="font-mono text-xs text-[#6d6658]">ACTIVE</label>
                </div>
              )}
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={selectedAgent ? handleUpdateAgent : handleCreateAgent}
                disabled={createMutation.isPending || updateMutation.isPending}
                className="flex-1 border-2 border-[#0A6B52] bg-[#D8F2E8] px-3 py-2 font-mono text-xs font-bold uppercase text-[#0A6B52] hover:bg-[#0A6B52] hover:text-white transition-colors disabled:opacity-50"
              >
                {createMutation.isPending || updateMutation.isPending ? "SAVING…" : selectedAgent ? "UPDATE" : "CREATE"}
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="flex-1 border-2 border-[#CC0000] bg-white px-3 py-2 font-mono text-xs font-bold uppercase text-[#CC0000] hover:bg-[#CC0000] hover:text-white transition-colors"
              >
                CANCEL
              </button>
            </div>
          </section>
        </div>
      )}
    </AppShell>
  );
}