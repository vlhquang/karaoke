# BTC Monitor worker on the existing Render service

The existing `@karaoke/frontend` custom Express server registers `/api/btc-bot` before the Next.js catch-all. Existing karaoke routes and sockets are unchanged. The feature is off unless `BTC_BOT_ENABLED=true`; missing/invalid credentials disable only the BTC feature.

## Enable

1. Deploy the modified karaoke repository to the existing `https://vlhquang.onrender.com` service.
2. In Firebase project `btc-monitor-ee8e5`, open Project settings > Service accounts > Generate new private key. Store its full JSON in Render's secret environment variable `BTC_FIREBASE_SERVICE_ACCOUNT`. Never commit the JSON or put it in the GitHub Pages app.
3. Set `BTC_FIREBASE_PROJECT_ID=btc-monitor-ee8e5`, `BTC_BOT_ENABLED=true`, `BTC_ALLOWED_ORIGIN=https://vlhquang.github.io`.
4. Optionally set `BTC_ALLOWED_UIDS` to your Firebase Authentication UID (comma-separated for multiple approved accounts). Empty means any Google-authenticated account can run its own isolated bot.
5. Publish the updated `coin/firestore.rules`. Clients can read only their own portfolio and cannot overwrite a portfolio managed by the server. The internal `btcBotJobs` collection is inaccessible to client SDKs.
6. Publish the coin frontend changes (`firebase-config.js`, `auth.js`, `app.js`). `BTC_SERVER_URL` points to `https://vlhquang.onrender.com`.
7. Sign in, select a strategy, apply and run. Close the page, wait and reopen. Check server heartbeat, runtime and trade history. Stopping is explicit; logging out does not stop the bot.

The repo declares Render's Free plan. Free services can sleep after 15 minutes without inbound traffic; an internal timer or outbound Binance request does not provide a 24/7 availability guarantee. Use a paid always-on instance for continuous execution. This change does not alter the Render plan or charges.

## Behavior

- Google Firebase ID tokens are verified by the Admin SDK against the configured project on every API request; UID determines storage paths. No UID from the request body is trusted.
- Market prices are fetched every 5 seconds only when a bot is enabled, and closed 15-minute candles every 30 seconds. All accounts share market requests.
- Firestore transactions serialize worker ticks, commands and concurrent instances; a recent tick blocks duplicate evaluation. Stop commands are rechecked in every transaction.
- `btcBotJobs/{uid}` indexes enabled accounts; `users/{uid}/private/portfolio` stores the authoritative state and feeds the existing dashboard listener. The worker and commands transact on the same portfolio document, so a concurrent stop or tick causes a retry against fresh state. State survives deploys/restarts; enabled jobs resume on startup.
- Browser execution and browser writes are disabled in server mode. A browser-only running session is displayed as stopped until the user explicitly starts the server bot.
- Runtime accrues between worker heartbeats, excluding gaps >= 30 seconds. No orders are reconstructed during downtime.
- This is paper trading with a 0.1% fee. No exchange account or real-money trading is connected.

## API

All endpoints require `Authorization: Bearer <Firebase ID token>`:

- `GET /api/btc-bot/state`: private portfolio and worker heartbeat.
- `POST /api/btc-bot/start`: `{ "rule": { "mode": "trend", "amount": 100, "takeProfit": 2, "stopLoss": 1, "buy": 0, "sell": 0 } }`.
- `POST /api/btc-bot/stop`: stop all automated entries/exits, keeping the position.
- `POST /api/btc-bot/resume`: resume the previously applied strategy.
- `POST /api/btc-bot/reset`: stop and reset the paper wallet, preserving total runtime.

Changing a strategy is rejected while the automatic position is open. Rate limits apply only to the BTC route. Firestore transaction errors and market outages are retried without stopping the karaoke server.

## Limits

Portfolio history is still stored in a document. Ticks fail before state exceeds 800 KB; archive/split trade records before long-term heavy use. Each enabled account writes one document every 5 seconds (about 17,280 writes/day/account), plus reads and frontend listeners. Multiple accounts or other Firebase use may exceed free quotas; monitor usage. Admin credentials and actual deployment are required to verify authentication, persistence and production execution end to end.
