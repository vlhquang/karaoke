const DEFAULT_FEED_URLS = [
  "https://news.google.com/rss/search?q=c%C3%B4ng+ngh%E1%BB%87+OR+tr%C3%AD+tu%E1%BB%87+nh%C3%A2n+t%E1%BA%A1o+OR+an+ninh+m%E1%BA%A1ng+OR+b%E1%BA%A3o+m%E1%BA%ADt&hl=vi&gl=VN&ceid=VN:vi",
  "https://news.google.com/rss/search?q=ng%C3%A2n+h%C3%A0ng+s%E1%BB%91+OR+fintech+OR+Java+OR+Spring+Boot&hl=vi&gl=VN&ceid=VN:vi",
  "https://news.google.com/rss/search?q=cybersecurity+OR+AI+security+OR+banking+technology+OR+Java+Spring&hl=en&gl=US&ceid=US:en"
];
const DEFAULT_INTERVAL_MINUTES = 5;
const MAX_ITEMS_PER_FEED = 10;

type NewsItem = {
  id: string;
  title: string;
  link: string;
  publishedAt?: string;
  source?: string;
};

const decodeXml = (value: string): string => value
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  .replace(/&amp;/g, "&")
  .replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">")
  .replace(/&quot;/g, '"')
  .replace(/&#39;|&apos;/g, "'")
  .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)))
  .replace(/&#x([\da-f]+);/gi, (_match, code: string) => String.fromCodePoint(parseInt(code, 16)))
  .trim();

const tagValue = (xml: string, name: string): string => {
  const match = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  return match ? decodeXml(match[1].replace(/<[^>]+>/g, " ")) : "";
};

const parseFeed = (xml: string): NewsItem[] => {
  const records = [...xml.matchAll(/<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi)];
  return records.map(([, type, body]) => {
    const title = tagValue(body, "title");
    const linkTag = body.match(/<link\b([^>]*)>([\s\S]*?)<\/link>|<link\b([^>]*)\/>/i);
    const link = linkTag
      ? decodeXml((linkTag[1] ?? linkTag[3] ?? "").match(/href=["']([^"']+)["']/i)?.[1] ?? linkTag[2] ?? "")
      : "";
    const id = tagValue(body, type.toLowerCase() === "entry" ? "id" : "guid") || link;
    const publishedAt = tagValue(body, "pubDate") || tagValue(body, "published") || tagValue(body, "updated");
    const source = tagValue(body, "source");
    return { id, title, link, publishedAt, source };
  }).filter((item) => item.id && item.title && /^https?:\/\//i.test(item.link))
    .slice(0, MAX_ITEMS_PER_FEED);
};

const asAdaptiveCard = (item: NewsItem) => ({
  type: "message",
  attachments: [{
    contentType: "application/vnd.microsoft.card.adaptive",
    content: {
      $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
      type: "AdaptiveCard",
      version: "1.2",
      body: [
        { type: "TextBlock", text: item.title, weight: "Bolder", size: "Medium", wrap: true },
        ...(item.source ? [{ type: "TextBlock", text: item.source, isSubtle: true, spacing: "Small", wrap: true }] : []),
        ...(item.publishedAt ? [{ type: "TextBlock", text: item.publishedAt, isSubtle: true, spacing: "Small", wrap: true }] : [])
      ],
      actions: [{ type: "Action.OpenUrl", title: "Đọc bài viết", url: item.link }]
    }
  }]
});

export const startNewsTeamsWorker = (): void => {
  const webhookUrl = process.env.NEWS_TEAMS_WEBHOOK_URL?.trim();
  if (!webhookUrl) {
    console.info("[News] Worker is disabled: NEWS_TEAMS_WEBHOOK_URL is not configured.");
    return;
  }

  const configuredFeeds = process.env.NEWS_RSS_URLS?.trim();
  const feedUrls = (configuredFeeds ? configuredFeeds.split(",") : DEFAULT_FEED_URLS)
    .map((url) => url.trim())
    .filter(Boolean);
  const configuredMinutes = Number(process.env.NEWS_POLL_INTERVAL_MINUTES);
  const legacyIntervalMs = Number(process.env.NEWS_POLL_INTERVAL_MS);
  const intervalMinutes = Number.isFinite(configuredMinutes) && configuredMinutes > 0
    ? configuredMinutes
    : Number.isFinite(legacyIntervalMs) && legacyIntervalMs >= 60_000
      ? legacyIntervalMs / 60_000
      : DEFAULT_INTERVAL_MINUTES;
  const intervalMs = intervalMinutes * 60_000;
  const sentIds = new Set<string>();
  let running = false;
  let lastSuccessfulScanAt: number | null = null;

  const scan = async (): Promise<void> => {
    if (running) {
      console.warn("[News] Scan skipped because the previous cycle is still running.");
      return;
    }
    running = true;
    const scanStartedAt = Date.now();
    let allFeedsScanned = true;
    console.info(`[News] Scan cycle started at ${new Date(scanStartedAt).toISOString()}.`);
    try {
      for (const feedUrl of feedUrls) {
        try {
          const response = await fetch(feedUrl, { signal: AbortSignal.timeout(15_000) });
          if (!response.ok) throw new Error(`RSS returned HTTP ${response.status}`);
          const items = parseFeed(await response.text()).reverse();
          let sentCount = 0;
          let ignoredCount = 0;
          for (const item of items) {
            const publishedAt = item.publishedAt ? Date.parse(item.publishedAt) : Number.NaN;
            if (lastSuccessfulScanAt === null || !Number.isFinite(publishedAt) || publishedAt <= lastSuccessfulScanAt) {
              sentIds.add(item.id);
              ignoredCount += 1;
              continue;
            }
            if (sentIds.has(item.id)) {
              ignoredCount += 1;
              continue;
            }
            const notify = await fetch(webhookUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(asAdaptiveCard(item)),
              signal: AbortSignal.timeout(15_000)
            });
            if (!notify.ok) throw new Error(`Teams webhook returned HTTP ${notify.status}`);
            sentIds.add(item.id);
            sentCount += 1;
            if (sentIds.size > 500) sentIds.delete(sentIds.values().next().value!);
          }
          console.info(`[News] Scanned ${items.length} items from ${feedUrl} (${sentCount} sent, ${ignoredCount} ignored)`);
        } catch (error) {
          allFeedsScanned = false;
          console.error(`[News] Failed to scan ${feedUrl}:`, error);
        }
      }
      if (allFeedsScanned) lastSuccessfulScanAt = scanStartedAt;
    } finally {
      running = false;
    }
  };

  console.info(`[News] Starting RSS scan every ${intervalMinutes} minute(s).`);
  const runScheduledScan = async (): Promise<void> => {
    const cycleStartedAt = Date.now();
    try {
      await scan();
    } catch (error) {
      console.error("[News] Scan cycle failed unexpectedly:", error);
    }
    const nextDelayMs = Math.max(0, intervalMs - (Date.now() - cycleStartedAt));
    const nextRunAt = new Date(Date.now() + nextDelayMs).toISOString();
    console.info(`[News] Next scan scheduled at ${nextRunAt}.`);
    setTimeout(() => void runScheduledScan(), nextDelayMs);
  };
  void runScheduledScan();
};
