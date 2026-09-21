import { describe, expect, it } from "vitest";
import { addCalendarYears, advanceWishStep, normalizeAppData, parseAge, remainingHealthyDays, remainingHealthyTime, setWishCompletion, tokyoDate, Wish } from "./core";

describe("parseAge", () => {
  it.each([["0", 0], ["120", 120], [" 42 ", 42]])("accepts %s", (value, expected) => expect(parseAge(value as string)).toBe(expected));
  it.each(["", " ", "1.5", "-1", "121", "年齢"])("rejects %s", (value) => expect(parseAge(value)).toBeNull());
});

describe("normalizeAppData", () => {
  it("keeps existing wishes while removing the retired action timing field", () => {
    const normalized = normalizeAppData({
      version: 1,
      profile: { age: 34, savedAt: "2026-09-20T00:00:00.000Z" },
      wishes: [{
        id: "wish-1",
        title: "北海道で流氷を見る",
        nextStep: "ツアーを調べる",
        actionDueOn: "2026-12-31",
        status: "active",
        doneOn: null,
        createdAt: "2026-09-20T00:00:00.000Z",
        updatedAt: "2026-09-20T00:00:00.000Z",
      }],
    });

    expect(normalized?.wishes[0]).toEqual({
      id: "wish-1",
      title: "北海道で流氷を見る",
      nextStep: "ツアーを調べる",
      status: "active",
      doneOn: null,
      createdAt: "2026-09-20T00:00:00.000Z",
      updatedAt: "2026-09-20T00:00:00.000Z",
    });
  });
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

describe("setWishCompletion", () => {
  const wish: Wish = {
    id: "wish-1",
    title: "北海道で流氷を見る",
    nextStep: "ツアーを調べる",
    status: "active",
    doneOn: null,
    createdAt: "2026-09-20T00:00:00.000Z",
    updatedAt: "2026-09-20T00:00:00.000Z",
  };

  it("marks a wish done on the Tokyo date", () => {
    expect(setWishCompletion(wish, true, new Date("2026-09-21T15:30:00Z"))).toMatchObject({
      status: "done",
      doneOn: "2026-09-22",
    });
  });

  it("restores a wish without changing its identity", () => {
    const completed = setWishCompletion(wish, true, new Date("2026-09-21T03:00:00Z"));
    expect(setWishCompletion(completed, false)).toMatchObject({ id: "wish-1", status: "active", doneOn: null });
  });
});

describe("advanceWishStep", () => {
  const wish: Wish = {
    id: "wish-1",
    title: "北海道で流氷を見る",
    nextStep: "ツアーを調べる",
    status: "active",
    doneOn: null,
    createdAt: "2026-09-20T00:00:00.000Z",
    updatedAt: "2026-09-20T00:00:00.000Z",
  };

  it("replaces the completed step", () => {
    expect(advanceWishStep(wish, "  候補日を決める  ")).toMatchObject({
      id: "wish-1",
      title: "北海道で流氷を見る",
      nextStep: "候補日を決める",
      status: "active",
      doneOn: null,
    });
  });

  it("does not mutate the current step", () => {
    advanceWishStep(wish, "候補日を決める");
    expect(wish).toMatchObject({ nextStep: "ツアーを調べる" });
  });
});
