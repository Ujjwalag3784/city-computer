/**
 * Date helpers for Asia/Kathmandu (UTC+05:45).
 * Store UTC timestamptz everywhere; convert only for display and for
 * "day boundary" business logic like "today's revenue" (docs/00 §5).
 */

export const KATHMANDU_OFFSET_MINUTES = 5 * 60 + 45; // UTC+05:45
export const KATHMANDU_TIME_ZONE = "Asia/Kathmandu";

/** Converts a UTC Date to the equivalent wall-clock Date in Kathmandu (for local field extraction). */
export function toKathmanduWallClock(date: Date): Date {
  return new Date(date.getTime() + KATHMANDU_OFFSET_MINUTES * 60 * 1000);
}

/** Returns the UTC instant corresponding to 00:00:00 in Kathmandu on the given UTC date. */
export function startOfKathmanduDay(date: Date): Date {
  const wall = toKathmanduWallClock(date);
  const y = wall.getUTCFullYear();
  const m = wall.getUTCMonth();
  const d = wall.getUTCDate();
  const startOfDayWall = Date.UTC(y, m, d, 0, 0, 0, 0);
  return new Date(startOfDayWall - KATHMANDU_OFFSET_MINUTES * 60 * 1000);
}

/** Returns the UTC instant corresponding to the last millisecond of the Kathmandu day. */
export function endOfKathmanduDay(date: Date): Date {
  const start = startOfKathmanduDay(date);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
}

/** True if two UTC instants fall on the same Kathmandu calendar day. */
export function isSameKathmanduDay(a: Date, b: Date): boolean {
  return startOfKathmanduDay(a).getTime() === startOfKathmanduDay(b).getTime();
}

/** True if `date` falls on today's Kathmandu calendar day, relative to `now` (defaults to the current time). */
export function isTodayInKathmandu(date: Date, now: Date = new Date()): boolean {
  return isSameKathmanduDay(date, now);
}

/** Formats a UTC instant as a Kathmandu-local `DD Mon YYYY` string, e.g. "27 Jul 2026". */
export function formatKathmanduDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: KATHMANDU_TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

/** Formats a UTC instant as a Kathmandu-local `DD Mon, HH:mm` string, e.g. "27 Jul, 10:14" — docs/09-ADMIN-DAD-MODE.md §6/§13's timeline examples ("27 Jul, 10:14 — Ramesh added 5..."), which need the time of day `formatKathmanduDate` deliberately omits. */
export function formatKathmanduDateTime(date: Date): string {
  const datePart = new Intl.DateTimeFormat("en-GB", {
    timeZone: KATHMANDU_TIME_ZONE,
    day: "2-digit",
    month: "short",
  }).format(date);
  const timePart = new Intl.DateTimeFormat("en-GB", {
    timeZone: KATHMANDU_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
  return `${datePart}, ${timePart}`;
}

/** Formats a UTC instant as a relative "N minutes/hours/days ago" string, Kathmandu-aware only via wall time. */
export function formatRelativeTime(date: Date, now: Date = new Date()): string {
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.round(diffMs / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? "" : "s"} ago`;
  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return `${diffHour} hour${diffHour === 1 ? "" : "s"} ago`;
  const diffDay = Math.round(diffHour / 24);
  return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;
}

/** Returns the ISO week's Monday 00:00 Kathmandu, for "this week" business rollups. */
export function startOfKathmanduWeek(date: Date): Date {
  const wall = toKathmanduWallClock(date);
  const dayOfWeek = wall.getUTCDay(); // 0 = Sunday
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  const mondayWall = new Date(wall.getTime() - daysSinceMonday * 24 * 60 * 60 * 1000);
  return startOfKathmanduDay(new Date(mondayWall.getTime() - KATHMANDU_OFFSET_MINUTES * 60 * 1000));
}

/** Returns the first day of the Kathmandu calendar month at 00:00. */
export function startOfKathmanduMonth(date: Date): Date {
  const wall = toKathmanduWallClock(date);
  const y = wall.getUTCFullYear();
  const m = wall.getUTCMonth();
  const firstOfMonthWall = Date.UTC(y, m, 1, 0, 0, 0, 0);
  return new Date(firstOfMonthWall - KATHMANDU_OFFSET_MINUTES * 60 * 1000);
}
