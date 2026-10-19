import { NextRequest, NextResponse } from "next/server";
import { getStreamChunk, parseSubs } from "@/lib/free";

export const dynamic = "force-dynamic";

/**
 * More of a /watch row's full ranked list. The page ships the first chunk of
 * every category; as the viewer scrolls a row, the client asks here for the
 * next slice (ids + the card records for just those films).
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const row = sp.get("row") ?? "";
  const serviceParam = sp.get("service");
  const serviceId = serviceParam ? Number(serviceParam) : null;
  const subs = parseSubs(sp.get("subs") || undefined);
  const offset = Math.max(0, Number(sp.get("offset") ?? 0) | 0);
  const limit = Math.min(120, Math.max(1, Number(sp.get("limit") ?? 60) | 0));
  const chunk = getStreamChunk(serviceId, subs, row, offset, limit);
  if (!chunk) return NextResponse.json({ error: "unknown row" }, { status: 404 });
  return NextResponse.json(chunk);
}
