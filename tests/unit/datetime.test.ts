import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime, formatTime } from "@/lib/datetime";

describe("datetime formatting", () => {
  const iso = "2026-10-09T12:32:39.186Z";

  it("renders in India Standard Time regardless of the host time zone", () => {
    expect(formatTime(iso)).toMatch(/^06:02\s?pm$/i);
    expect(formatDate(iso)).toBe("9 Oct 2026");
    expect(formatDateTime(iso)).toMatch(/^9 Oct 2026, 6:02\s?pm$/i);
  });

  it("rolls the date over at IST midnight, not UTC midnight", () => {
    expect(formatDate("2026-10-09T19:00:00Z")).toBe("10 Oct 2026");
  });
});
