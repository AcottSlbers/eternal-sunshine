"use client";

import { useEffect, useState } from "react";

function format(date: Date, timeZone?: string, includeZone = false, locale?: string): string {
  return new Intl.DateTimeFormat(locale, {
    ...(timeZone ? { timeZone } : {}), hour: "2-digit", minute: "2-digit",
    ...(includeZone ? { timeZoneName: "short" } : {}),
  }).format(date);
}

export function UserLocalTime() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  return <span className="flex flex-col text-right normal-case tracking-normal"><span suppressHydrationWarning className="text-base text-stone-200">{format(now)} · Your local time</span><span suppressHydrationWarning className="text-xs text-stone-500">{format(now, "UTC")} UTC</span></span>;
}

export function ZonedTime({ dateTime, timeZone }: { dateTime: string; timeZone?: string }) {
  return <time dateTime={dateTime}>{timeZone ? format(new Date(dateTime), timeZone, true, "en-US") : "Unknown"}</time>;
}
