import { NextResponse } from "next/server";
import { toPublicRanking } from "@/lib/public-response";
import { createRanking } from "@/lib/ranking";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(toPublicRanking(await createRanking()), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { message: "Current sunsets are temporarily unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
