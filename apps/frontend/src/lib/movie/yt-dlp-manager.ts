import YTDlpWrap from "yt-dlp-wrap";
import path from "path";
import fs from "fs";

const BIN_DIR = path.join(process.cwd(), "bin");
const BIN_PATH = path.join(BIN_DIR, process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp");

declare global {
  // eslint-disable-next-line no-var
  var __ytDlpInstance: YTDlpWrap | undefined;
}

export async function getYtDlp(): Promise<YTDlpWrap> {
  if (globalThis.__ytDlpInstance) return globalThis.__ytDlpInstance;

  if (!fs.existsSync(BIN_PATH)) {
    fs.mkdirSync(BIN_DIR, { recursive: true });
    console.log("[yt-dlp] Downloading binary from GitHub...");
    await YTDlpWrap.downloadFromGithub(BIN_PATH);
    console.log("[yt-dlp] Binary downloaded to", BIN_PATH);
  }

  globalThis.__ytDlpInstance = new YTDlpWrap(BIN_PATH);
  return globalThis.__ytDlpInstance;
}
