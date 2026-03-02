const symbol = "VNM";
const url = `https://finance.vietstock.vn/${symbol}-.htm`;

async function testScraping() {
    console.log(`Fetching ${url}...`);
    try {
        const response = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            }
        });
        const html = await response.text();

        // New Method: Extract from _stockTrade JSON object in script tag
        const tradeMatch = html.match(/const\s+_stockTrade\s*=\s*({.*?});/s);
        if (tradeMatch) {
            console.log("Found _stockTrade object!");
            const tradeJson = tradeMatch[1];

            // Current Price
            const priceMatch = tradeJson.match(/"LastPrice":"(?:[^"]*?>)?\s*([\d,.]+)\s*(?:<\/span>)?/);
            console.log("Price Value:", priceMatch ? priceMatch[1] : "N/A");

            // Opening Price
            const openMatch = tradeJson.match(/"OpenPrice":"([\d,.]+)"/);
            console.log("Open Value:", openMatch ? openMatch[1] : "N/A");

            // Change
            const changeMatch = tradeJson.match(/"Change":"(?:[^"]*?>)?\s*([+-]?[\d,.]+)\s*(?:<\/span>)?/);
            console.log("Change Value:", changeMatch ? changeMatch[1] : "N/A");

            // Trade Date
            const dateMatch = tradeJson.match(/"TradingDate":"([^"]+)"/);
            console.log("Date Value:", dateMatch ? dateMatch[1] : "N/A");
        } else {
            console.log("_stockTrade object not found!");

            // Fallback for debugging
            console.log("HTML Start:", html.substring(0, 500));
        }

    } catch (e) {
        console.error("Error:", e);
    }
}

testScraping();
