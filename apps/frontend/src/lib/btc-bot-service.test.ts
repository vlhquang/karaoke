import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import type { Auth } from "firebase-admin/auth";
import type { Firestore } from "firebase-admin/firestore";
import { createBtcBotRouter } from "./btc-bot-service";
import { decodeState, encodeState, tick, ruleSchema } from "./btc-bot-engine";

test("API authenticates Google, isolates UID, persists commands, and preserves open positions", async () => {
  const documents = new Map<string, any>();
  const snapshot = (path: string) => ({ exists: documents.has(path), data: () => structuredClone(documents.get(path)) });
  const db = {
    collection: (name: string) => ({ doc: (id: string) => ({ path: `${name}/${id}` }) }),
    doc: (path: string) => ({ path, get: async () => snapshot(path) }),
    runTransaction: async (callback: any) => {
      const writes: [string, any][] = [];
      const result = await callback({ get: async (ref: any) => snapshot(ref.path), set: (ref: any, value: any) => writes.push([ref.path, value]) });
      for (const [path, value] of writes) documents.set(path, value);
      return result;
    }
  } as unknown as Firestore;
  const auth = { verifyIdToken: async (token: string) => {
    if (!['alice', 'bob', 'password'].includes(token)) throw new Error('invalid token');
    return { uid: token, firebase: { sign_in_provider: token === 'password' ? 'password' : 'google.com' } };
  } } as unknown as Auth;
  const app = express(); app.use('/api/btc-bot', createBtcBotRouter(db, auth));
  const server = createServer(app); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as { port: number };
  async function request(path: string, token?: string, body?: object) {
    return fetch(`http://127.0.0.1:${address.port}/api/btc-bot/${path}`, {
      method: body ? 'POST' : 'GET', headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {})
    });
  }
  try {
    assert.equal((await request('state')).status, 401);
    assert.equal((await request('state', 'invalid')).status, 401);
    assert.equal((await request('state', 'password')).status, 401);
    const rule = { mode: 'threshold', amount: 100, buy: 100, sell: 110, takeProfit: 2, stopLoss: 1 };
    assert.equal((await request('start', 'alice', { rule: { ...rule, amount: -1 } })).status, 400);
    const start = await request('start', 'alice', { rule, uid: 'bob' }); assert.equal(start.status, 200);
    assert.equal(documents.has('btcBotJobs/bob'), false);
    const state = await (await request('state', 'bob')).json(); assert.equal(decodeState(state.state).wallet.trades.length, 0);
    const job = documents.get('users/alice/private/portfolio'); const value = decodeState(job.state);
    tick(value, 100, [], Date.now()); value.session.totalRuntimeMs = 10000;
    documents.set('users/alice/private/portfolio', { ...job, state: encodeState(value) });
    assert.equal((await request('start', 'alice', { rule: { ...rule, mode: 'trend' } })).status, 409);
    const stop = await (await request('stop', 'alice', {})).json();
    assert.equal(decodeState(stop.state).session.enabled, false); assert.equal(decodeState(stop.state).wallet.btc, 1);
    const resume = await (await request('resume', 'alice', {})).json(); assert.equal(decodeState(resume.state).session.enabled, true);
    const reset = await (await request('reset', 'alice', {})).json();
    assert.equal(decodeState(reset.state).wallet.cash, 10000); assert.equal(decodeState(reset.state).session.enabled, false);
    assert.ok(decodeState(reset.state).session.totalRuntimeMs >= 10000);
    const old = decodeState(); old.rule = ruleSchema.parse(rule); old.session.enabled = true;
    documents.set('users/bob/private/portfolio', { state: encodeState(old) });
    assert.equal(decodeState((await (await request('state', 'bob')).json()).state).session.enabled, false);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
