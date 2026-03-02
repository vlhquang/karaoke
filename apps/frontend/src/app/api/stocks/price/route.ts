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

        // Better regex to extract price
        const priceMatch = html.match(/class="[^"]*price[^"]*"[^>]*>\s*([\d,.]+)\s*<\/span>/i);
        // Better regex to extract reference price (openprice)
        const refMatch = html.match(/id="openprice"[^>]*>\s*([\d,.]+)\s*<\/b>/i);
        // Better regex to extract trade date
        const dateMatch = html.match(/id="tradedate"[^>]*>\s*([^<]+)\s*<\/div>/i);

        if (!priceMatch || !priceMatch[1]) {
            return NextResponse.json(
                { ok: false, message: "Could not find price in HTML" },
                { status: 502 }
            );
        }

        const price = parseFloat(priceMatch[1].replace(/,/g, ""));
        const referencePrice = refMatch ? parseFloat(refMatch[1].replace(/,/g, "")) : null;

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
