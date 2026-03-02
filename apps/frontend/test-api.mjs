import fetch from "node-fetch";

async function test() {
    console.log("Testing VNM...");
    const res = await fetch("http://localhost:3000/api/stocks/price?symbol=VNM");
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
}

test();
