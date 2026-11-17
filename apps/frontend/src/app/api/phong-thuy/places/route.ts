import { NextResponse } from "next/server";
import { lookupPlaces, parsePlaceRequest, PlaceLookupError } from "../../../../phong-thuy/place-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const places = await lookupPlaces(parsePlaceRequest(new URL(request.url).searchParams));
    return NextResponse.json({ places }, { headers: { "Cache-Control": "private, max-age=300" } });
  } catch (error) {
    const status = error instanceof PlaceLookupError ? error.status : 500;
    return NextResponse.json({ message: error instanceof PlaceLookupError ? error.message : "Không đọc được thông tin địa điểm." }, { status });
  }
}
