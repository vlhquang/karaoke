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

        // Regex to extract price from <span class="price ...">...</span>
        // Examples: <span class="price txt-red">28,000</span> or <span class="txt-green price">120,500</span>
        // Matches the number inside the span, removing commas
        const priceMatch = html.match(/<span[^>]*class="[^"]*price[^"]*"[^>]*>([\d,.]+)<\/span>/i);

        if (!priceMatch || !priceMatch[1]) {
            return NextResponse.json(
                { ok: false, message: "Could not find price in HTML" },
                { status: 502 }
            );
        }

        const priceStr = priceMatch[1].replace(/,/g, "");
        const price = parseFloat(priceStr);

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
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        return NextResponse.json(
            { ok: false, message: "Proxy error", details: error instanceof Error ? error.message : "Unknown" },
            { status: 500 }
        );
    }
}
