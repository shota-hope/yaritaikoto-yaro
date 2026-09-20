export type Timeframe = "month" | "year" | "undecided";
export type WishStatus = "active" | "done";

export type Wish = {
  id: string;
  title: string;
  nextStep: string;
  actionDueOn: string | null;
  status: WishStatus;
  doneOn: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Profile = { age: number; savedAt: string };
export type AppData = { version: 1; profile: Profile; wishes: Wish[] };

export type RemainingHealthyTime = {
  totalDays: number;
  years: number;
  days: number;
};

const dateParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export const parseAge = (value: string) => {
  if (!/^\d+$/.test(value.trim())) return null;
  const age = Number(value);
  return Number.isInteger(age) && age >= 0 && age <= 120 ? age : null;
};

export const tokyoDate = (date = new Date()) => {
  const parts = Object.fromEntries(dateParts.formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
};

export const dueDateFor = (timeframe: Timeframe, date = new Date()): string | null => {
  if (timeframe === "undecided") return null;
  const [year, month] = tokyoDate(date).split("-").map(Number);
  if (timeframe === "year") return `${year}-12-31`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
};

export const classifyDueDate = (dueOn: string | null, date = new Date()) => {
  if (!dueOn) return "未定";
  const today = tokyoDate(date);
  if (dueOn < today) return "予定を見直す";
  if (dueOn.slice(0, 7) === today.slice(0, 7)) return "今月";
  if (dueOn.slice(0, 4) === today.slice(0, 4)) return "今年";
  return "未定";
};

export const timeframeFromDueDate = (dueOn: string | null, date = new Date()): Timeframe => {
  const label = classifyDueDate(dueOn, date);
  if (label === "今月") return "month";
  if (label === "今年") return "year";
  return "undecided";
};

const dateToDayNumber = (date: string) => {
  const [year, month, day] = date.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
};

const dayNumberToDate = (dayNumber: number) => new Date(dayNumber * 86_400_000).toISOString().slice(0, 10);

export const addCalendarYears = (date: string, years: number) => {
  const [year, month, day] = date.split("-").map(Number);
  const targetYear = year + years;
  const lastDay = new Date(Date.UTC(targetYear, month, 0)).getUTCDate();
  return `${targetYear}-${String(month).padStart(2, "0")}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
};

export const remainingHealthyTime = (profile: Profile, now = new Date()): RemainingHealthyTime => {
  const savedOn = tokyoDate(new Date(profile.savedAt));
  const today = tokyoDate(now);
  const estimatedDays = Math.round((74.01 - profile.age - 0.5) * 365.2425);
  const targetDay = dateToDayNumber(savedOn) + estimatedDays;
  const totalDays = Math.max(0, targetDay - dateToDayNumber(today));
  if (totalDays === 0) return { totalDays: 0, years: 0, days: 0 };

  let years = Math.max(0, Number(dayNumberToDate(targetDay).slice(0, 4)) - Number(today.slice(0, 4)));
  while (years > 0 && dateToDayNumber(addCalendarYears(today, years)) > targetDay) years -= 1;
  while (dateToDayNumber(addCalendarYears(today, years + 1)) <= targetDay) years += 1;
  const days = targetDay - dateToDayNumber(addCalendarYears(today, years));
  return { totalDays, years, days };
};

export const remainingHealthyDays = (profile: Profile, now = new Date()) => remainingHealthyTime(profile, now).totalDays;
