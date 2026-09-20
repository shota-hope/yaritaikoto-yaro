import { describe, expect, it } from "vitest";
import { classifyDueDate, dueDateFor, remainingHealthyDays } from "./core";

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
});
