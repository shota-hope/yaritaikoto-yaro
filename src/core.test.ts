import { describe, expect, it } from "vitest";
import { addCalendarYears, classifyDueDate, dueDateFor, parseAge, remainingHealthyDays, remainingHealthyTime, tokyoDate } from "./core";

describe("parseAge", () => {
  it.each([["0", 0], ["120", 120], [" 42 ", 42]])("accepts %s", (value, expected) => expect(parseAge(value as string)).toBe(expected));
  it.each(["", " ", "1.5", "-1", "121", "年齢"])("rejects %s", (value) => expect(parseAge(value)).toBeNull());
});

describe("dueDateFor", () => {
  it("handles a leap-year February in Tokyo", () => expect(dueDateFor("month", new Date("2024-02-15T03:00:00Z"))).toBe("2024-02-29"));
  it("stores the final day of the year", () => expect(dueDateFor("year", new Date("2026-09-20T03:00:00Z"))).toBe("2026-12-31"));
});

describe("classifyDueDate", () => {
  const now = new Date("2026-09-20T03:00:00Z");
  it("does not call today overdue", () => expect(classifyDueDate("2026-09-20", now)).toBe("今月"));
  it("groups a past date gently", () => expect(classifyDueDate("2026-09-19", now)).toBe("予定を見直す"));
  it("prefers this month over this year", () => expect(classifyDueDate("2026-09-30", now)).toBe("今月"));
});

describe("remainingHealthyDays", () => {
  it("never returns a negative number", () => expect(remainingHealthyDays({ age: 100, savedAt: "2026-09-20T00:00:00Z" }, new Date("2026-09-20T00:00:00Z"))).toBe(0));
  it("uses Tokyo calendar days across the date boundary", () => {
    const profile = { age: 73, savedAt: "2026-09-20T14:59:00Z" };
    expect(remainingHealthyDays(profile, new Date("2026-09-20T15:01:00Z")))
      .toBe(remainingHealthyDays(profile, new Date("2026-09-20T14:59:00Z")) - 1);
  });
  it("shows one day and then zero days without going negative", () => {
    const profile = { age: 73, savedAt: "2026-09-20T00:00:00Z" };
    const total = remainingHealthyDays(profile, new Date("2026-09-20T00:00:00Z"));
    const target = new Date(Date.UTC(2026, 8, 20 + total));
    const previous = new Date(target.getTime() - 86_400_000);
    expect(remainingHealthyTime(profile, previous)).toEqual({ totalDays: 1, years: 0, days: 1 });
    expect(remainingHealthyTime(profile, target)).toEqual({ totalDays: 0, years: 0, days: 0 });
  });
});

describe("calendar helpers", () => {
  it("uses the final day of February when adding a year to February 29", () => expect(addCalendarYears("2024-02-29", 1)).toBe("2025-02-28"));
  it("reads the Tokyo year at New Year", () => expect(tokyoDate(new Date("2026-12-31T15:00:00Z"))).toBe("2027-01-01"));
});
