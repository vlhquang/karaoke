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

        // Target specific IDs for better accuracy
        // Current Price: inside <h2 id="stockprice">...<span class="price">VALUE</span></h2>
        const priceMatch = html.match(/id="stockprice"[^>]*>.*?class="[^"]*price[^"]*"[^>]*>\s*([\d,.]+)\s*<\/span>/is);

        // Opening Price: <b id="openprice">VALUE</b>
        const openMatch = html.match(/id="openprice"[^>]*>\s*([\d,.]+)\s*<\/b>/i);

        // Price Change: <div id="stockchange">VALUE (...)</div>
        const changeMatch = html.match(/id="stockchange"[^>]*>\s*([+-]?[\d,.]+)\s*\(/i);

        // Trade Date: <div id="tradedate">VALUE</div>
        const dateMatch = html.match(/id="tradedate"[^>]*>\s*([^<]+)\s*<\/div>/i);

        if (!priceMatch || !priceMatch[1]) {
            return NextResponse.json(
                { ok: false, message: "Could not find stock price in HTML" },
                { status: 502 }
            );
        }

        const price = parseFloat(priceMatch[1].replace(/,/g, ""));
        const openingPrice = openMatch ? parseFloat(openMatch[1].replace(/,/g, "")) : null;
        const changeAmount = changeMatch ? parseFloat(changeMatch[1].replace(/,/g, "")) : 0;

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
            timestamp: dateMatch ? dateMatch[1].trim() : new Date().toLocaleString("vi-VN")
        });
    } catch (error) {
        return NextResponse.json(
            { ok: false, message: "Proxy error", details: error instanceof Error ? error.message : "Unknown" },
            { status: 500 }
        );
    }
}
