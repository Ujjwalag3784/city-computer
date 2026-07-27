import { describe, expect, it } from "vitest";
import {
  endOfKathmanduDay,
  formatKathmanduDate,
  formatRelativeTime,
  isSameKathmanduDay,
  isTodayInKathmandu,
  startOfKathmanduDay,
  startOfKathmanduMonth,
  startOfKathmanduWeek,
} from "./date";

describe("startOfKathmanduDay", () => {
  it("returns 00:00 Kathmandu time as a UTC instant", () => {
    // 27 Jul 2026, 10:00 UTC == 15:45 Kathmandu (same day)
    const input = new Date("2026-07-27T10:00:00.000Z");
    const start = startOfKathmanduDay(input);
    // 00:00 Kathmandu on 27 Jul == 18:15 UTC on 26 Jul
    expect(start.toISOString()).toBe("2026-07-26T18:15:00.000Z");
  });

  it("crosses midnight correctly just before the Kathmandu day boundary", () => {
    // 18:14 UTC on 26 Jul == 23:59 Kathmandu on 26 Jul — still the 26th
    const justBefore = new Date("2026-07-26T18:14:00.000Z");
    expect(startOfKathmanduDay(justBefore).toISOString()).toBe("2026-07-25T18:15:00.000Z");
  });
});

describe("endOfKathmanduDay", () => {
  it("is one millisecond before the next day's start", () => {
    const input = new Date("2026-07-27T10:00:00.000Z");
    const end = endOfKathmanduDay(input);
    expect(end.toISOString()).toBe("2026-07-27T18:14:59.999Z");
  });
});

describe("isSameKathmanduDay", () => {
  it("treats two instants on the same Kathmandu calendar day as equal", () => {
    const morning = new Date("2026-07-27T01:00:00.000Z"); // 06:45 Kathmandu
    const evening = new Date("2026-07-27T17:00:00.000Z"); // 22:45 Kathmandu
    expect(isSameKathmanduDay(morning, evening)).toBe(true);
  });

  it("treats instants across the Kathmandu boundary as different days", () => {
    const lateNight = new Date("2026-07-27T19:00:00.000Z"); // 00:45 Kathmandu next day
    const morning = new Date("2026-07-27T01:00:00.000Z");
    expect(isSameKathmanduDay(lateNight, morning)).toBe(false);
  });
});

describe("isTodayInKathmandu", () => {
  it("is true when compared against itself as now", () => {
    const now = new Date("2026-07-27T10:00:00.000Z");
    expect(isTodayInKathmandu(now, now)).toBe(true);
  });

  it("is false for yesterday", () => {
    const now = new Date("2026-07-27T10:00:00.000Z");
    const yesterday = new Date("2026-07-26T10:00:00.000Z");
    expect(isTodayInKathmandu(yesterday, now)).toBe(false);
  });
});

describe("formatKathmanduDate", () => {
  it("formats as DD Mon YYYY", () => {
    const date = new Date("2026-07-27T10:00:00.000Z");
    expect(formatKathmanduDate(date)).toBe("27 Jul 2026");
  });
});

describe("formatRelativeTime", () => {
  const now = new Date("2026-07-27T12:00:00.000Z");

  it("returns 'just now' for sub-minute differences", () => {
    expect(formatRelativeTime(new Date("2026-07-27T11:59:30.000Z"), now)).toBe("just now");
  });

  it("returns minutes for sub-hour differences", () => {
    expect(formatRelativeTime(new Date("2026-07-27T11:58:00.000Z"), now)).toBe("2 minutes ago");
  });

  it("uses singular for exactly 1 minute/hour/day", () => {
    expect(formatRelativeTime(new Date("2026-07-27T11:59:00.000Z"), now)).toBe("1 minute ago");
  });

  it("returns hours for sub-day differences", () => {
    expect(formatRelativeTime(new Date("2026-07-27T09:00:00.000Z"), now)).toBe("3 hours ago");
  });

  it("returns days for older differences", () => {
    expect(formatRelativeTime(new Date("2026-07-24T12:00:00.000Z"), now)).toBe("3 days ago");
  });
});

describe("startOfKathmanduWeek", () => {
  it("returns the preceding Monday 00:00 Kathmandu", () => {
    // 27 Jul 2026 is a Monday
    const monday = new Date("2026-07-27T10:00:00.000Z");
    const weekStart = startOfKathmanduWeek(monday);
    expect(weekStart.toISOString()).toBe("2026-07-26T18:15:00.000Z");
  });

  it("handles a mid-week date the same as the week's Monday", () => {
    const wednesday = new Date("2026-07-29T10:00:00.000Z");
    const monday = new Date("2026-07-27T10:00:00.000Z");
    expect(startOfKathmanduWeek(wednesday).getTime()).toBe(startOfKathmanduWeek(monday).getTime());
  });
});

describe("startOfKathmanduMonth", () => {
  it("returns the 1st of the month at 00:00 Kathmandu", () => {
    const midMonth = new Date("2026-07-27T10:00:00.000Z");
    const monthStart = startOfKathmanduMonth(midMonth);
    expect(monthStart.toISOString()).toBe("2026-06-30T18:15:00.000Z");
  });
});
