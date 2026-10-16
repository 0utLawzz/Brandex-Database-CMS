import { useQuery } from "@tanstack/react-query";
import { AssociateSettlementSection } from "@/components/AssociateSettlementSection";
import { AppShell } from "@/components/layout/AppShell";
import { getStaffRole } from "@/lib/api";
export function AssociatePaymentsPage() {
  const role = useQuery({ queryKey: ["staff-role"], queryFn: getStaffRole });
  return (
    <AppShell>
      <div className="overflow-auto">
        <AssociateSettlementSection canWrite={role.data === "admin"} />
      </div>
    </AppShell>
  );
}
