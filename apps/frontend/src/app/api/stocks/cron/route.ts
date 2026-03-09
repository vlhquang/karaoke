import { NextResponse } from "next/server";
import { runStockAutoRefreshOnce } from "../../../../lib/stock-auto-refresh";

const CRON_SECRET = process.env.CRON_SECRET ?? "";

export async function GET(request: Request) {
    const authHeader = request.headers.get("Authorization");
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
        return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
    }

    try {
        const result = await runStockAutoRefreshOnce();
        return NextResponse.json(result);
    } catch (error: any) {
        return NextResponse.json({
            ok: false,
            message: "Cron job failed",
            details: error.message
        }, { status: 500 });
    }
}
