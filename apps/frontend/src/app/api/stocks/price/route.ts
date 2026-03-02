import { NextResponse } from "next/server";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get("symbol")?.toUpperCase();

    if (!symbol) {
        return NextResponse.json({ ok: false, message: "Missing symbol" }, { status: 400 });
    }

    const headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
    };

    // Try multiple URL formats for robustness
    const urls = [
        `https://finance.vietstock.vn/${symbol}-.htm`,
        `https://finance.vietstock.vn/${symbol}-demo.htm`
    ];

    let lastError = null;

    for (const url of urls) {
        try {
            const response = await fetch(url, {
                headers,
                next: { revalidate: 60 }, // Cache for 60 seconds
            });

            if (!response.ok) {
                lastError = `Vietstock returned ${response.status} for ${url}`;
                continue;
            }

            const html = await response.text();

            // Extraction strategy 1: _stockTrade JSON object (Most Robust)
            const tradeMatch = html.match(/const\s+_stockTrade\s*=\s*({.*?});/s);

            let priceValue: string | null = null;
            let openValue: string | null = null;
            let changeValue: string | null = null;
            let dateValue: string | null = null;

            if (tradeMatch) {
                const tradeJson = tradeMatch[1];
                const p = tradeJson.match(/"LastPrice":"[^"]*?([\d,.]+)\s*(?:\\u003c|<)\//);
                const o = tradeJson.match(/"OpenPrice":"([\d,.]+)"/);
                const c = tradeJson.match(/"Change":"[^"]*?([+-]?[\d,.]+)\s*(?:\\u003c|<)\//);
                const d = tradeJson.match(/"TradingDate":"([^"]+)"/);

                if (p) priceValue = p[1];
                if (o) openValue = o[1];
                if (c) changeValue = c[1];
                if (d) dateValue = d[1];
            }

            // Extraction strategy 2: ID-based patterns (Original Fallback)
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

            // Extraction strategy 3: CSS-like patterns suggested by User (Additional Fallback)
            // Price: div.stock-price-info -> div.stock-info -> span.price
            if (!priceValue) {
                const m = html.match(/class="[^"]*stock-info[^"]*"[^>]*>\s*<span[^>]*class="[^"]*price[^"]*"[^>]*>\s*([\d,.]+)\s*<\/span>/is);
                if (m) priceValue = m[1];
            }
            // Open: div.stock-price-info -> b#openprice (Already covered by id="openprice")

            // Extraction strategy 4: Meta Description (Last Resort)
            if (!priceValue) {
                const m = html.match(/<meta\s+name=["']description["']\s+content=["'][^"']*?-\s*([\d,.]+)\s*đồng/i);
                if (m) priceValue = m[1];
            }

            if (priceValue) {
                const price = parseFloat(priceValue.replace(/,/g, ""));
                const openingPrice = openValue ? parseFloat(openValue.replace(/,/g, "")) : null;
                const changeAmount = changeValue ? parseFloat(changeValue.replace(/,/g, "")) : 0;
                const referencePrice = price - changeAmount;

                if (!isNaN(price)) {
                    return NextResponse.json({
                        ok: true,
                        symbol,
                        price,
                        openingPrice,
                        referencePrice,
                        timestamp: dateValue || new Date().toLocaleString("vi-VN")
                    });
                }
            }

            lastError = `Could not extract price from ${url}`;
        } catch (error) {
            lastError = error instanceof Error ? error.message : "Unknown error";
        }
    }

    // If all URLs failed
    return NextResponse.json(
        { ok: false, message: lastError || "Failed to scrape stock data from multiple sources" },
        { status: 502 }
    );
}
