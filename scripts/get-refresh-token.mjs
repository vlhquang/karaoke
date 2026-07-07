import http from "http";
import { google } from "googleapis";

const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
const REDIRECT_URI = "http://localhost:4321/callback";

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("Thiếu GOOGLE_OAUTH_CLIENT_ID hoặc GOOGLE_OAUTH_CLIENT_SECRET trong env");
  process.exit(1);
}

const oauth2 = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = oauth2.generateAuthUrl({
  access_type: "offline",
  scope: ["https://www.googleapis.com/auth/drive"],
  prompt: "consent",
});

console.log("\n=== Mở URL sau trong trình duyệt ===\n");
console.log(authUrl);
console.log("\n=====================================\n");
console.log("Đang chờ callback trên http://localhost:4321 ...\n");

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost:4321");
  const code = url.searchParams.get("code");

  if (!code) {
    res.end("Không tìm thấy code.");
    return;
  }

  try {
    const { tokens } = await oauth2.getToken(code);
    res.end("<h2>Thành công! Đóng tab này và xem terminal.</h2>");

    console.log("=== COPY CÁC DÒNG NÀY VÀO FILE .env ===\n");
    console.log(`GOOGLE_OAUTH_CLIENT_ID="${CLIENT_ID}"`);
    console.log(`GOOGLE_OAUTH_CLIENT_SECRET="${CLIENT_SECRET}"`);
    console.log(`GOOGLE_REFRESH_TOKEN="${tokens.refresh_token}"`);
    console.log("\n=========================================\n");
  } catch (err) {
    res.end("Lỗi: " + err.message);
    console.error("Lỗi khi đổi token:", err.message);
  } finally {
    server.close();
  }
});

server.listen(4321);
