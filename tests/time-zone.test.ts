import { describe, expect, it } from "vitest";
import { getSolarElevation } from "../lib/solar";
import { formatTimeInZone, getCameraTimeZone } from "../lib/time-zone";

describe("local-time display", () => {
  it("derives an IANA zone from camera coordinates", () => {
    expect(getCameraTimeZone(52.52, 13.405)).toBe("Europe/Berlin");
  });

  it("lets Intl apply daylight-saving time", () => {
    const winter = formatTimeInZone(new Date("2026-01-15T12:00:00Z"), "Europe/Berlin");
    const summer = formatTimeInZone(new Date("2026-07-15T12:00:00Z"), "Europe/Berlin");
    expect(winter).not.toBe(summer);
    expect(winter).toContain("13:00");
    expect(summer).toContain("14:00");
  });

  it("does not mix display zones into astronomy", () => {
    const instant = new Date("2026-03-20T17:00:00Z");
    const beforeFormatting = getSolarElevation(instant, 52.52, 13.405);
    formatTimeInZone(instant, "America/New_York");
    expect(getSolarElevation(instant, 52.52, 13.405)).toBe(beforeFormatting);
  });
});
