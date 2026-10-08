import express, { type Express, type Request } from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, FieldValue, type Firestore } from "firebase-admin/firestore";
import { decodeState, encodeState, ruleSchema, tick, type Candle } from "./btc-bot-engine";

const API = "https://data-api.binance.vision/api/v3";
export function registerBtcBotService(app: Express): void {
  if (process.env.BTC_BOT_ENABLED !== "true") return;
  const projectId = process.env.BTC_FIREBASE_PROJECT_ID;
  const credentials = process.env.BTC_FIREBASE_SERVICE_ACCOUNT;
  if (!projectId || !credentials) { console.error("[btc-bot] Missing Firebase configuration; worker disabled"); return; }
  let firebaseApp;
  try {
    const serviceAccount = JSON.parse(credentials);
    if (serviceAccount.project_id !== projectId) throw new Error("Firebase project mismatch");
    firebaseApp = getApps().find(a => a.name === "btc-bot") || initializeApp({ credential: cert(serviceAccount), projectId }, "btc-bot");
  } catch { console.error("[btc-bot] Invalid service account; worker disabled"); return; }
  const db = getFirestore(firebaseApp), auth = getAuth(firebaseApp);
  app.use("/api/btc-bot", createBtcBotRouter(db, auth));
  startBtcBotWorker(db);
}

export function createBtcBotRouter(db: Firestore, auth: Auth) {
  const router = express.Router();
  router.use(cors({ origin: process.env.BTC_ALLOWED_ORIGIN || "https://vlhquang.github.io", methods: ["GET", "POST"], allowedHeaders: ["Authorization", "Content-Type"] }));
  router.use(express.json({ limit: "32kb" }));
  router.use(rateLimit({ windowMs: 60000, limit: 60, standardHeaders: "draft-7", legacyHeaders: false }));
  async function userId(req: Request): Promise<string> {
    const match = /^Bearer (.+)$/.exec(req.headers.authorization || "");
    if (!match) throw new Error("UNAUTHORIZED");
    try {
      const token = await auth.verifyIdToken(match[1], true);
      if (token.firebase.sign_in_provider !== "google.com") throw new Error("UNAUTHORIZED");
      const allowed = (process.env.BTC_ALLOWED_UIDS || "").split(",").map(s => s.trim()).filter(Boolean);
      if (allowed.length && !allowed.includes(token.uid)) throw new Error("UNAUTHORIZED");
      return token.uid;
    } catch { throw new Error("UNAUTHORIZED"); }
  }
  const jobs = db.collection("btcBotJobs");
  const portfolio = (uid: string) => db.doc(`users/${uid}/private/portfolio`);
  router.get("/state", async (req, res) => {
    try {
      const uid = await userId(req), snapshot = await portfolio(uid).get();
      let state = snapshot.exists ? snapshot.data()?.state || {} : {};
      if (snapshot.data()?.serverManaged !== true) {
        const bot = decodeState(state); bot.session.enabled = false; state = encodeState(bot);
      }
      res.setHeader("Cache-Control", "no-store");
      res.json({ state, serverManaged: snapshot.data()?.serverManaged === true, worker: snapshot.data()?.worker || null });
    } catch (error) { res.status(error instanceof Error && error.message === "UNAUTHORIZED" ? 401 : 503).json({ error: "Cannot load bot state" }); }
  });
  router.post("/:command", async (req, res) => {
    try {
      const uid = await userId(req), command = req.params.command;
      if (!["start", "stop", "resume", "reset"].includes(command)) { res.status(404).json({ error: "Unknown command" }); return; }
      const config = command === "start" ? ruleSchema.parse(req.body?.rule) : null;
      const result = await db.runTransaction(async transaction => {
        const ref = jobs.doc(uid), view = portfolio(uid);
        const savedSnapshot = await transaction.get(view);
        const existing = savedSnapshot.data();
        const bot = decodeState(existing?.state || {});
        const now = Date.now();
        const lastTickAt = existing?.worker?.lastTickAt || now;
        if (bot.session.enabled && existing?.serverManaged && now - lastTickAt >= 0 && now - lastTickAt < 30000) bot.session.totalRuntimeMs += now - lastTickAt;
        if (command === "start") { if (bot.session.quantity > 0) throw new Error("POSITION_OPEN"); bot.rule = config; bot.session.enabled = true; bot.session.lastDecision = 0; }
        if (command === "resume") { if (!bot.rule) throw new Error("NO_RULE"); bot.session.enabled = true; }
        if (command === "stop") bot.session.enabled = false;
        if (command === "reset") { bot.wallet = { cash: 10000, btc: 0, trades: [] }; bot.session.quantity = 0; bot.session.entryPrice = 0; bot.session.enabled = false; }
        const state = encodeState(bot);
        const worker = { status: bot.session.enabled ? "waiting-market" : "stopped", lastTickAt: now, price: existing?.worker?.price || null };
        transaction.set(ref, { enabled: bot.session.enabled });
        transaction.set(view, { state, serverManaged: true, worker, updatedAt: FieldValue.serverTimestamp() });
        return { state, serverManaged: true, worker };
      });
      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Command failed";
      res.status(message === "UNAUTHORIZED" ? 401 : message === "POSITION_OPEN" || message === "NO_RULE" ? 409 : 400).json({ error: message === "POSITION_OPEN" ? "Đang giữ BTC; chạy lại chiến lược cũ hoặc đặt lại ví mô phỏng trước khi đổi." : message === "NO_RULE" ? "Chưa áp dụng chiến lược." : "Không thực hiện được lệnh bot." });
    }
  });
  return router;
}

export function startBtcBotWorker(db: Firestore): () => void {
  const jobs = db.collection("btcBotJobs");
  const portfolio = (uid: string) => db.doc(`users/${uid}/private/portfolio`);
  let busy = false, candles: Candle[] = [], candlesAt = 0;
  async function json(path: string) {
    const response = await fetch(API + path, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error("Market unavailable");
    return response.json();
  }
  async function work() {
    if (busy) return;
    busy = true;
    try {
      const active = await jobs.where("enabled", "==", true).get();
      if (active.empty) return;
      const quote = await json("/ticker/price?symbol=BTCUSDT");
      const price = Number(quote.price);
      const quoteAt = Date.now();
      if (quote.symbol !== "BTCUSDT" || !Number.isFinite(price) || price <= 0) throw new Error("Invalid quote");
      if (Date.now() - candlesAt > 30000) {
        try {
          const rows = await json("/klines?symbol=BTCUSDT&interval=15m&limit=100");
          if (!Array.isArray(rows)) throw new Error("Invalid candles");
          candles = rows.map((r: unknown[]) => ({ time: Number(r[0]), open: Number(r[1]), high: Number(r[2]), low: Number(r[3]), close: Number(r[4]), closeTime: Number(r[6]) }));
          if (candles.some(c => !Object.values(c).every(Number.isFinite) || c.low <= 0 || c.high < c.low || c.close < c.low || c.close > c.high)) throw new Error("Invalid candle values");
          candlesAt = Date.now();
        } catch { candlesAt = 0; }
      }
      for (const account of active.docs) {
        if (Date.now() - quoteAt > 15000) break;
        try {
          await db.runTransaction(async transaction => {
            const view = portfolio(account.id);
            const snapshot = await transaction.get(view), data = snapshot.data();
            const now = Date.now();
            if (now - quoteAt > 15000) return;
            if (data?.serverManaged !== true || now - (data.worker?.lastTickAt || 0) < 4500) return;
            const bot = decodeState(data.state);
            if (!bot.session.enabled) return;
            const lastTickAt = data.worker?.lastTickAt || now;
            if (now - lastTickAt < 30000) bot.session.totalRuntimeMs += Math.max(0, now - lastTickAt);
            const status = tick(bot, price, Date.now() - candlesAt < 90000 ? candles : [], now);
            const state = encodeState(bot);
            if (Buffer.byteLength(JSON.stringify(state)) > 800000) throw new Error("History storage limit reached");
            if (!bot.session.enabled) transaction.set(account.ref, { enabled: false });
            transaction.set(view, { state, serverManaged: true, worker: { status, lastTickAt: now, price }, updatedAt: FieldValue.serverTimestamp() });
          });
        } catch { console.error("[btc-bot] Account tick failed; will retry"); }
      }
    } catch { console.error("[btc-bot] Worker tick failed; will retry"); }
    finally { busy = false; }
  }
  const timer = setInterval(() => { void work(); }, 5000);
  timer.unref();
  void work();
  console.info("[btc-bot] Paper trading worker registered");
  return () => clearInterval(timer);
}
