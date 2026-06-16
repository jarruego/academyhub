import { describe, it, expect } from "vitest";
import { isGroupActive, ACTIVE_GROUP_GRACE_DAYS } from "./group-active.util";

const NOW = new Date("2026-06-16T12:00:00Z");
const day = (s: string) => new Date(s);

describe("isGroupActive", () => {
  it("manual override 'active' is always active, ignoring dates", () => {
    expect(isGroupActive({ active_mode: "active", start_date: null, end_date: null }, NOW)).toBe(true);
    expect(isGroupActive({ active_mode: "active", start_date: day("2000-01-01"), end_date: day("2000-01-02") }, NOW)).toBe(true);
  });

  it("manual override 'inactive' is always inactive, ignoring dates", () => {
    expect(isGroupActive({ active_mode: "inactive", start_date: day("2026-06-01"), end_date: day("2026-12-31") }, NOW)).toBe(false);
  });

  it("auto: inactive when dates are missing", () => {
    expect(isGroupActive({ active_mode: "auto", start_date: null, end_date: null }, NOW)).toBe(false);
    expect(isGroupActive({ active_mode: "auto", start_date: day("2026-06-01"), end_date: null }, NOW)).toBe(false);
    expect(isGroupActive({ active_mode: "auto", start_date: null, end_date: day("2026-12-31") }, NOW)).toBe(false);
  });

  it("auto (default mode): active within the window", () => {
    expect(isGroupActive({ start_date: day("2026-06-01"), end_date: day("2026-06-30") }, NOW)).toBe(true);
  });

  it("auto: inactive before start_date", () => {
    expect(isGroupActive({ start_date: day("2026-07-01"), end_date: day("2026-07-31") }, NOW)).toBe(false);
  });

  it("auto: active during the grace period after end_date", () => {
    const end = new Date(NOW.getTime() - 1 * 24 * 60 * 60 * 1000); // ended 1 day ago
    expect(ACTIVE_GROUP_GRACE_DAYS).toBeGreaterThanOrEqual(1);
    expect(isGroupActive({ start_date: day("2026-06-01"), end_date: end }, NOW)).toBe(true);
  });

  it("auto: inactive after the grace period", () => {
    const end = new Date(NOW.getTime() - (ACTIVE_GROUP_GRACE_DAYS + 1) * 24 * 60 * 60 * 1000);
    expect(isGroupActive({ start_date: day("2026-06-01"), end_date: end }, NOW)).toBe(false);
  });
});
