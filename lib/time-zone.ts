import tzlookup from "tz-lookup";

export function getCameraTimeZone(latitude: number, longitude: number): string | undefined {
  try { return tzlookup(latitude, longitude); } catch { return undefined; }
}

export function formatTimeInZone(date: Date, timeZone: string, locale = "en-US"): string {
  return new Intl.DateTimeFormat(locale, { timeZone, hour: "2-digit", minute: "2-digit", hour12: false, timeZoneName: "short" }).format(date);
}
