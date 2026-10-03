import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const { fixture } = vi.hoisted(() => ({
  fixture: {
    tmResult: {
      records: [{
        id: "case-1",
        appName: "Test mark",
        appClass: "25",
        tmCprNo: "123123",
        type: "TM",
        clientCode: "ABC",
        caseNumber: "CN-1",
        stage: "STAGE 2",
        subStage: "Assigned",
        city: "Karachi",
        agent: "Ahsan",
        image: "https://example.com/image.png",
        date: "2026-08-01",
        tm5: "YES",
        tm6: "NO",
        tm11: "YES",
        tm16: "NO",
        tm56: "YES",
      }],
      tmMatches: { TM5: "2026-07-01", TM11: "2026-07-15", TM56: "2026-08-10" },
      journal: { "Journal No": "J-22", "Journal Date": "2026-08-20" },
    },
  },
}));

vi.mock("@/lib/api", () => ({
  formatWorkflowLabel: (value: string) => value,
}));

import { GeneralSearchError, TmCard } from "./SearchPage";

beforeEach(() => {
  fixture.tmResult.records[0].agent = "Ahsan";
  fixture.tmResult.records[0].city = "Karachi";
});

describe("Search page card layout", () => {
  it("uses the general-search card layout for TM results", () => {
    const html = renderToStaticMarkup(<TmCard result={fixture.tmResult as any} onViewRecord={() => undefined} />);
    expect(html).toContain("CITY:");
    expect(html).toContain("AGENT:");
    expect(html).toContain("FILED:");
    expect(html).toContain("TM FORM IPO (REGISTRY MATCHES)");
    expect(html).toContain("VIEW RECORD");
  });
});

describe("General search error state", () => {
  it("shows the error and a retry action instead of an empty-results message", () => {
    const html = renderToStaticMarkup(
      <GeneralSearchError error={new Error("Database unavailable")} onRetry={() => undefined} />,
    );

    expect(html).toContain("Search failed");
    expect(html).toContain("Database unavailable");
    expect(html).toContain("Retry");
    expect(html).not.toContain("No results found");
  });
});
