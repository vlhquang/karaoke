import { NextResponse } from "next/server";
import { getStockAutoRefreshStatus } from "../../../../lib/stock-auto-refresh";

export async function GET(request: Request) {
  return NextResponse.json({
    ok: true,
    data: getStockAutoRefreshStatus()
  });
}
