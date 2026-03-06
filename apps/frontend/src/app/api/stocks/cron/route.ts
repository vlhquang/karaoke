import { NextResponse } from "next/server";
import { scrapeStockPrice } from "@/lib/stock-scraper";

const SCRIPT_URL = process.env.STOCK_APPS_SCRIPT_URL ?? "";
const ACCESS_CODE = process.env.STOCK_ACCESS_CODE ?? "";
const CRON_SECRET = process.env.CRON_SECRET ?? "";

export async function GET(request: Request) {
    // 1. Basic security check
    const authHeader = request.headers.get("Authorization");
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
        return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
    }

    // 2. Check time and day (Vietnam time +07:00)
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Ho_Chi_Minh',
        weekday: 'long',
        hour: 'numeric',
        hour12: false
    });

    const parts = formatter.formatToParts(now);
    const dayName = parts.find(p => p.type === 'weekday')?.value || "";
    const hour = parseInt(parts.find(p => p.type === 'hour')?.value || "0");

    // Market hours: Mon-Fri, 09:00 to 15:00
    const isMarketDay = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].includes(dayName);
    const isMarketHour = hour >= 9 && hour <= 15;

    if (!isMarketDay || !isMarketHour) {
        return NextResponse.json({
            ok: true,
            status: "skipped",
            reason: "Outside market hours (Mon-Fri 09:00-15:00)",
            time: { dayName, hour }
        });
    }

    if (!SCRIPT_URL || !ACCESS_CODE) {
        return NextResponse.json({ ok: false, message: "Missing server configuration" }, { status: 500 });
    }

    try {
        // 3. Fetch list of transactions to get unique symbols
        const listRes = await fetch(SCRIPT_URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "list", accessCode: ACCESS_CODE }),
        });
        const listData = await listRes.json();

        if (!listData.ok) {
            return NextResponse.json({ ok: false, message: "Failed to fetch stock list", details: listData.message });
        }

        const transactions = listData.data || [];
        const uniqueSymbols = Array.from(new Set(transactions.filter((t: any) => t.status === "HOLD").map((t: any) => t.symbol))) as string[];

        if (uniqueSymbols.length === 0) {
            return NextResponse.json({ ok: true, message: "No active stocks to update" });
        }

        // 4. Scrape prices concurrently
        const priceResults: Record<string, any> = {};
        await Promise.allSettled(
            uniqueSymbols.map(async (symbol) => {
                const result = await scrapeStockPrice(symbol, true);
                if (result) {
                    priceResults[symbol] = result;
                }
            })
        );

        // 5. Update Apps Script with new prices
        const updateRes = await fetch(SCRIPT_URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({
                action: "update_prices",
                accessCode: ACCESS_CODE,
                prices: priceResults
            }),
        });
        const updateData = await updateRes.json();

        return NextResponse.json({
            ok: updateData.ok,
            updatedCount: Object.keys(priceResults).length,
            symbols: Object.keys(priceResults),
            details: updateData.message
        });

    } catch (error: any) {
        return NextResponse.json({
            ok: false,
            message: "Cron job failed",
            details: error.message
        }, { status: 500 });
    }
}
