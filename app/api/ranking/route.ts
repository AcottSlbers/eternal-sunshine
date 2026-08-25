import { NextResponse } from "next/server";
import { createRanking } from "@/lib/ranking";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await createRanking(), { headers: { "Cache-Control": "no-store" } });
}
