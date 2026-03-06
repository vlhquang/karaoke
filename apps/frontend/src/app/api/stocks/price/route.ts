import { NextResponse } from "next/server";
import { scrapeStockPrice } from "@/lib/stock-scraper";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const isRefresh = searchParams.get("refresh") === "true";
    const symbol = searchParams.get("symbol")?.toUpperCase();

    if (!symbol) {
        return NextResponse.json({ ok: false, message: "Missing symbol" }, { status: 400 });
    }

    try {
        const result = await scrapeStockPrice(symbol, isRefresh);
        if (result) {
            return NextResponse.json({
                ok: true,
                ...result
            }, {
                headers: {
                    "Cache-Control": "no-store, max-age=0"
                }
            });
        }
        return NextResponse.json({ ok: false, message: "Failed to scrape stock data" }, { status: 502 });
    } catch (error) {
        return NextResponse.json(
            { ok: false, message: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
