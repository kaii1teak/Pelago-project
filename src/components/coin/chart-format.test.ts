import { describe, expect, it } from "vitest";
import { formatChartTime } from "./chart-format";

// 2026-10-10 21:45:00 UTC
const SECONDS = Date.UTC(2026, 9, 10, 21, 45) / 1000;

describe("formatChartTime", () => {
  it("writes the time of day for the short ranges, in the zone it is given", () => {
    const utc = { locale: "en-US", timeZone: "UTC" };
    expect(formatChartTime("24h", SECONDS, utc)).toBe("Oct 10, 21:45");
    expect(formatChartTime("7d", SECONDS, utc)).toBe("Oct 10, 21:45");
    // Two hours ahead in October: the same instant reads differently, as it must.
    expect(
      formatChartTime("24h", SECONDS, { locale: "en-US", timeZone: "Europe/Warsaw" }),
    ).toBe("Oct 10, 23:45");
  });

  it("writes only the day for a year of daily data", () => {
    expect(formatChartTime("1y", SECONDS, { locale: "en-US", timeZone: "UTC" })).toBe(
      "Oct 10, 2026",
    );
  });

  it("is the viewer's own when it is given nobody (the chart only ever draws in the browser)", () => {
    const own = new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(SECONDS * 1000));
    expect(formatChartTime("24h", SECONDS)).toBe(own);
  });
});
