import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";

const { fixture } = vi.hoisted(() => ({ fixture: { record: {} as Record<string, unknown> } }));
vi.mock("@/lib/api", () => ({
  getRecord: vi.fn(), getWorkflowHistory: vi.fn(), getStaffRole: vi.fn(),
  formatWorkflowLabel: (value: string) => value,
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey }: { queryKey: string[] }) => ({
    data: queryKey[0] === "trademark" ? fixture.record : queryKey[0] === "staff-role" ? "admin" : [],
  }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock("wouter", () => ({ useParams: () => ({ id: "case-1" }), useLocation: () => ["/record/case-1", vi.fn()] }));
vi.mock("@/hooks/useBranding", () => ({ useBranding: () => ({ branding: {} }) }));
vi.mock("@/components/layout/AppShell", () => ({ AppShell: ({ children }: { children: ReactNode }) => children }));
vi.mock("@/components/CaseEventsSection", () => ({ CaseEventsSection: () => null }));
vi.mock("@/components/RecordModal", () => ({ RecordModal: () => null }));
vi.mock("@/components/StageDocumentsSection", () => ({ StageDocumentsSection: () => null }));
vi.mock("@/components/CaseWorkflowSection", () => ({
  CaseWorkflowSection: () => null, StagePaymentsSection: () => null, WorkflowHistorySection: () => null,
}));

import { RecordView } from "./RecordView";

beforeEach(() => {
  fixture.record = {
    id: "case-1", appName: "Test mark", stage: "STAGE 1", subStage: "Filing",
    date: "2026-08-01", createdAt: "2026-09-02T12:00:00Z", updatedAt: "2026-09-03T12:00:00Z",
    journal: { found: true, "Journal No": "J-1" },
  };
});

describe("Record View date and registry labels", () => {
  it("renders the creation timestamp independently from filing and modification", () => {
    const html = renderToStaticMarkup(<RecordView />);
    expect(html).toMatch(/Date Created:.*?02-Sep-26/);
    expect(html).toMatch(/Last Modified:.*?03-Sep-26/);
    expect(html).toMatch(/Filing Date.*?01-Aug-26/);
    expect(html).toContain("TM FORM IPO (REGISTRY MATCHES)");
    expect(html).not.toContain("Document Status (TM Forms)");
  });

  it("shows unavailable creation date without substituting the filing date", () => {
    delete fixture.record.createdAt;
    const html = renderToStaticMarkup(<RecordView />);
    expect(html).toMatch(/Date Created:.*?>—<\/span>/);
    expect(html).not.toMatch(/Date Created:.*?01-Aug-26/);
  });
  it("shows creation and modification timestamps even without a journal match", () => {
    fixture.record.journal = null;
    const html = renderToStaticMarkup(<RecordView />);
    expect(html).toMatch(/Date Created:.*?02-Sep-26/);
    expect(html).toMatch(/Last Modified:.*?03-Sep-26/);
  });

});
