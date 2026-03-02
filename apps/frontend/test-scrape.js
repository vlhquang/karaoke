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

        // 1. Current Price: inside <h2 id="stockprice">...<span class="price">VALUE</span></h2>
        const priceMatch = html.match(/id="stockprice"[^>]*>.*?class="[^"]*price[^"]*"[^>]*>\s*([\d,.]+)\s*<\/span>/is);
        console.log("Price Match Raw:", priceMatch ? priceMatch[0] : "Not found");
        console.log("Price Value:", priceMatch ? priceMatch[1] : "N/A");

        // 2. Opening Price: <b id="openprice">VALUE</b>
        const openMatch = html.match(/id="openprice"[^>]*>\s*([\d,.]+)\s*<\/b>/i);
        console.log("Open Match Raw:", openMatch ? openMatch[0] : "Not found");
        console.log("Open Value:", openMatch ? openMatch[1] : "N/A");

        // 3. Price Change: <div id="stockchange">VALUE (...)</div>
        const changeMatch = html.match(/id="stockchange"[^>]*>\s*([+-]?[\d,.]+)\s*\(/i);
        console.log("Change Match Raw:", changeMatch ? changeMatch[0] : "Not found");
        console.log("Change Value:", changeMatch ? changeMatch[1] : "N/A");

        // 4. Trade Date: <div id="tradedate">VALUE</div>
        const dateMatch = html.match(/id="tradedate"[^>]*>\s*([^<]+)\s*<\/div>/i);
        console.log("Date Match Raw:", dateMatch ? dateMatch[0] : "Not found");
        console.log("Date Value:", dateMatch ? dateMatch[1] : "N/A");

    } catch (e) {
        console.error("Error:", e);
    }
}

testScraping();
