import { NextResponse } from "next/server";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get("symbol")?.toUpperCase();

    if (!symbol) {
        return NextResponse.json({ ok: false, message: "Missing symbol" }, { status: 400 });
    }

    // Vietstock URL format: https://finance.vietstock.vn/[symbol]-.htm
    const url = `https://finance.vietstock.vn/${symbol}-.htm`;

    try {
        const response = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
                "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
            },
            next: { revalidate: 60 }, // Cache for 60 seconds
        });

        if (!response.ok) {
            return NextResponse.json(
                { ok: false, message: `Vietstock returned ${response.status}` },
                { status: 502 }
            );
        }

        const html = await response.text();

        // New Robust Method: Extract from _stockTrade JSON object found in raw HTML
        const tradeMatch = html.match(/const\s+_stockTrade\s*=\s*({.*?});/s);

        let priceValue: string | null = null;
        let openValue: string | null = null;
        let changeValue: string | null = null;
        let dateValue: string | null = null;

        if (tradeMatch) {
            const tradeJson = tradeMatch[1];
            // Extract values from JSON structure (handles both literal and escaped HTML/quotes)
            const p = tradeJson.match(/"LastPrice":"[^"]*?([\d,.]+)\s*(?:\\u003c|<)\//);
            const o = tradeJson.match(/"OpenPrice":"([\d,.]+)"/);
            const c = tradeJson.match(/"Change":"[^"]*?([+-]?[\d,.]+)\s*(?:\\u003c|<)\//);
            const d = tradeJson.match(/"TradingDate":"([^"]+)"/);

            if (p) priceValue = p[1];
            if (o) openValue = o[1];
            if (c) changeValue = c[1];
            if (d) dateValue = d[1];
        }

        // Fallback to original ID-based matching if JSON extraction failed
        if (!priceValue) {
            const m = html.match(/id="stockprice"[^>]*>.*?class="[^"]*price[^"]*"[^>]*>\s*([\d,.]+)\s*<\/span>/is);
            if (m) priceValue = m[1];
        }
        if (!openValue) {
            const m = html.match(/id="openprice"[^>]*>\s*([\d,.]+)\s*<\/b>/i);
            if (m) openValue = m[1];
        }
        if (!changeValue) {
            const m = html.match(/id="stockchange"[^>]*>\s*([+-]?[\d,.]+)\s*\(/i);
            if (m) changeValue = m[1];
        }
        if (!dateValue) {
            const m = html.match(/id="tradedate"[^>]*>\s*([^<]+)\s*<\/div>/i);
            if (m) dateValue = m[1];
        }

        if (!priceValue) {
            return NextResponse.json(
                { ok: false, message: "Could not find stock price in HTML (ID and JSON methods failed)" },
                { status: 502 }
            );
        }

        const price = parseFloat(priceValue.replace(/,/g, ""));
        const openingPrice = openValue ? parseFloat(openValue.replace(/,/g, "")) : null;
        const changeAmount = changeValue ? parseFloat(changeValue.replace(/,/g, "")) : 0;

        // Calculate Reference Price (Previous Close)
        // Reference = Current - Change
        const referencePrice = price - changeAmount;

        if (isNaN(price)) {
            return NextResponse.json(
                { ok: false, message: "Invalid price value" },
                { status: 502 }
            );
        }

        return NextResponse.json({
            ok: true,
            symbol,
            price,
            openingPrice,
            referencePrice,
            timestamp: dateValue || new Date().toLocaleString("vi-VN")
        });
    } catch (error) {
        return NextResponse.json(
            { ok: false, message: "Proxy error", details: error instanceof Error ? error.message : "Unknown" },
            { status: 500 }
        );
    }
}
