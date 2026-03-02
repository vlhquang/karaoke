const symbols = ["HDB", "VNM", "MBB", "DGC"];

async function testScraping() {
    const headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    };

    for (const symbol of symbols) {
        console.log(`\n--- Testing ${symbol} ---`);
        const urls = [
            `https://finance.vietstock.vn/${symbol}-.htm`,
            `https://finance.vietstock.vn/${symbol}-demo.htm`
        ];

        let found = false;
        for (const url of urls) {
            console.log(`Fetching ${url}...`);
            try {
                const response = await fetch(url, { headers });
                const html = await response.text();

                // 1. JSON Method (Refined for escaped quotes)
                const tradeMatch = html.match(/const\s+_stockTrade\s*=\s*({.*?});/s);
                if (tradeMatch) {
                    const tradeJson = tradeMatch[1];
                    const p = tradeJson.match(/"LastPrice":"(?:\\"|[^"])*?([\d,.]+)\s*(?:\\u003c|<)/);
                    const o = tradeJson.match(/"OpenPrice":"([\d,.]+)"/);
                    if (p) {
                        console.log(`[JSON Success] Price: ${p[1]}, Open: ${o ? o[1] : 'N/A'}`);
                        found = true;
                        break;
                    }
                }

                // 2. ID/CSS Fallback
                const priceMatch = html.match(/id="stockprice"[^>]*>.*?class="[^"]*price[^"]*"[^>]*>\s*([\d,.]+)\s*<\/span>/is) ||
                    html.match(/class="[^"]*stock-info[^"]*"[^>]*>\s*<span[^>]*class="[^"]*price[^"]*"[^>]*>\s*([\d,.]+)\s*<\/span>/is);

                const openMatch = html.match(/id="openprice"[^>]*>\s*([\d,.]+)\s*<\/b>/i);

                if (priceMatch) {
                    console.log(`[DOM Success] Price: ${priceMatch[1]}, Open: ${openMatch ? openMatch[1] : 'N/A'}`);
                    found = true;
                    break;
                }

                // 3. Meta Fallback (Refined for unquoted name)
                const metaMatch = html.match(/<meta\s+name=["']?description["']?\s+content=["'][^"']*?-\s*([\d,.]+)\s*đồng/i);
                if (metaMatch) {
                    console.log(`[Meta Success] Price: ${metaMatch[1]}`);
                    found = true;
                    break;
                }

                console.log(`[Failed] No data found in ${url}`);
            } catch (e) {
                console.error(`[Error] Fetching ${url}:`, e.message);
            }
        }
        if (!found) console.log(`!!! COMPLETELY FAILED for ${symbol} !!!`);
    }
}

testScraping();
