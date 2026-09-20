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

const dateParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

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

export const remainingHealthyDays = (profile: Profile, now = new Date()) => {
  const elapsed = (now.getTime() - new Date(profile.savedAt).getTime()) / 86_400_000;
  return Math.max(0, Math.round((74.01 - profile.age - 0.5) * 365.2425 - elapsed));
};
