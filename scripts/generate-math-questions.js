/**
 * Generator: Grade-1 math questions for Vua Toán Học game.
 *
 * Produces a JSON file with a comprehensive, non-repeating question bank
 * covering all grade-1 math rules:
 *  1. Tens + tens                     (10+20=30, ...)
 *  2. Tens + units                    (30+7=37, ...)
 *  3. Tens − tens (no borrow, ≥ 0)   (50−20=30, ...)
 *  4. Tens − units                    (40−6=34, ...)
 *  5. Mixed a+b−c  or  a−b+c         (20+30−10=40, ...)
 *  6. Simple add  (small numbers)     (3+7=10, ...)
 *  7. Simple sub  (small numbers)     (9−4=5, ...)
 *
 * Usage:  node scripts/generate-math-questions.js
 * Output: apps/frontend/src/li-xi-nang-cao/data/math-grade1-questions.json
 */

const path = require("path");
const fs = require("fs");

const TENS = [10, 20, 30, 40, 50, 60, 70, 80, 90];
const UNITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

const questions = [];

/** Generate 4 answer options (includes the correct answer) */
function makeOptions(answer) {
    const set = new Set([answer]);
    const deltas = [1, 2, 3, 5, 10, 20];
    let d = 0;
    while (set.size < 4) {
        const delta = deltas[d % deltas.length];
        const up = answer + delta;
        const down = Math.max(0, answer - delta);
        if (up !== answer) set.add(up);
        if (set.size < 4 && down !== answer) set.add(down);
        d++;
    }
    return [...set].sort((a, b) => a - b);
}

function addQ(prompt, answer) {
    questions.push({ prompt, answer, options: makeOptions(answer) });
}

// ── Type 1: Tens + Tens (result ≤ 130) ───────────────────────────────────────
for (const a of TENS) {
    for (const b of TENS) {
        if (a + b <= 130) addQ(`${a} + ${b} = ?`, a + b);
    }
}

// ── Type 2: Tens + Units ──────────────────────────────────────────────────────
for (const a of TENS) {
    for (const b of UNITS) {
        addQ(`${a} + ${b} = ?`, a + b);
    }
}

// ── Type 3: Tens − Tens (a > b, no borrow, result ≥ 0) ───────────────────────
for (const a of TENS) {
    for (const b of TENS) {
        if (a > b) addQ(`${a} - ${b} = ?`, a - b);
    }
}

// ── Type 4: Tens − Units ──────────────────────────────────────────────────────
for (const a of TENS) {
    for (const b of UNITS) {
        addQ(`${a} - ${b} = ?`, a - b);
    }
}

// ── Type 5: Mixed a + b − c (a, b ∈ tens/units, c ≤ mid, result ≥ 0) ─────────
for (const a of TENS) {
    for (const b of [...TENS, ...UNITS]) {
        const mid = a + b;
        // pick c as a tens or unit that doesn't exceed mid
        const validC = [...TENS, ...UNITS].filter(c => c <= mid && c !== 0);
        for (const c of validC.slice(0, 4)) {   // limit combos per (a,b)
            if (mid - c >= 0) addQ(`${a} + ${b} - ${c} = ?`, mid - c);
        }
    }
}

// ── Type 6: Mixed a − b + c (a ≥ b, both tens/units, c ∈ tens/units) ─────────
for (const a of TENS) {
    for (const b of UNITS.filter(u => u <= a)) {
        const mid = a - b;
        for (const c of UNITS.slice(0, 3)) {
            addQ(`${a} - ${b} + ${c} = ?`, mid + c);
        }
        for (const c of TENS.filter(t => t <= 30).slice(0, 2)) {
            addQ(`${a} - ${b} + ${c} = ?`, mid + c);
        }
    }
}

// ── Type 7: Simple addition (numbers 1–20) ────────────────────────────────────
for (let a = 1; a <= 20; a++) {
    for (let b = 1; b <= 20; b++) {
        if (a + b <= 30) addQ(`${a} + ${b} = ?`, a + b);
    }
}

// ── Type 8: Simple subtraction (numbers 1–20, no negative) ───────────────────
for (let a = 1; a <= 20; a++) {
    for (let b = 1; b < a; b++) {
        addQ(`${a} - ${b} = ?`, a - b);
    }
}

// ── Deduplicate by prompt ─────────────────────────────────────────────────────
const seen = new Set();
const unique = questions.filter(q => {
    if (seen.has(q.prompt)) return false;
    seen.add(q.prompt);
    return true;
});

// ── Compute correctIndex ──────────────────────────────────────────────────────
const final = unique.map(q => ({
    prompt: q.prompt,
    answer: q.answer,
    options: q.options,
    correctIndex: q.options.indexOf(q.answer)
}));

console.error(`Generated ${final.length} unique grade-1 questions.`);

// ── Write JSON ────────────────────────────────────────────────────────────────
const outDir = path.join(__dirname, "../apps/frontend/src/li-xi-nang-cao/data");
const outFile = path.join(outDir, "math-grade1-questions.json");

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outFile, JSON.stringify({ grade1: final }, null, 2), "utf8");

console.error(`Written to ${outFile}`);
