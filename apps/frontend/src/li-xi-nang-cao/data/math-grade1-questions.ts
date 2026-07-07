/**
 * Grade-1 math question bank for Vua Toán Học (Math King game).
 *
 * Pre-generated covering all grade-1 rules:
 *  1. Tens + Tens         (20+30=50)
 *  2. Tens + Units        (40+7=47)
 *  3. Tens − Tens (≥0)    (60−20=40)
 *  4. Tens − Units        (50−6=44)
 *  5. Mixed a+b−c         (20+30−10=40)
 *  6. Mixed a−b+c         (40−5+3=38)
 *  7. Simple add  1–20    (8+5=13)
 *  8. Simple sub  1–20    (15−7=8)
 *
 * Each question: { prompt, answer, options[4], correctIndex }
 * The options array is pre-shuffled; correctIndex points to the answer in it.
 */

export interface MathQ {
    prompt: string;
    answer: number;
    options: number[];
    correctIndex: number;
}

/** Build 4 wrong-looking distractors + the answer, already sorted */
function opts(answer: number): number[] {
    const set = new Set<number>([answer]);
    const deltas = [1, 2, 3, 5, 10, 20];
    let d = 0;
    while (set.size < 4) {
        const delta = deltas[d % deltas.length];
        const up = answer + delta;
        const dn = Math.max(0, answer - delta);
        if (up !== answer) set.add(up);
        if (set.size < 4 && dn !== answer) set.add(dn);
        d++;
    }
    return [...set].sort((a, b) => a - b);
}

function q(prompt: string, answer: number): MathQ {
    const options = opts(answer);
    return { prompt, answer, options, correctIndex: options.indexOf(answer) };
}

const TENS = [10, 20, 30, 40, 50, 60, 70, 80, 90] as const;
const UNITS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

const bank: MathQ[] = [];

// ── Type 1: Tens + Tens ──────────────────────────────────────────────────────
for (const a of TENS) {
    for (const b of TENS) {
        if (a + b <= 130) bank.push(q(`${a} + ${b} = ?`, a + b));
    }
}

// ── Type 2: Tens + Units ─────────────────────────────────────────────────────
for (const a of TENS) {
    for (const b of UNITS) {
        bank.push(q(`${a} + ${b} = ?`, a + b));
    }
}

// ── Type 3: Tens − Tens (a > b) ───────────────────────────────────────────────
for (const a of TENS) {
    for (const b of TENS) {
        if (a > b) bank.push(q(`${a} - ${b} = ?`, a - b));
    }
}

// ── Type 4: Tens − Units ──────────────────────────────────────────────────────
for (const a of TENS) {
    for (const b of UNITS) {
        bank.push(q(`${a} - ${b} = ?`, a - b));
    }
}

// ── Type 5: Mixed a + b − c ──────────────────────────────────────────────────
const mixSources: number[] = [...TENS.slice(0, 5), ...UNITS];
for (const a of TENS) {
    for (const b of mixSources.slice(0, 6)) {
        const mid = a + b;
        for (const c of mixSources.filter(v => v > 0 && v <= mid).slice(0, 3)) {
            bank.push(q(`${a} + ${b} - ${c} = ?`, mid - c));
        }
    }
}

// ── Type 6: Mixed a − b + c ──────────────────────────────────────────────────
for (const a of TENS) {
    for (const b of UNITS.filter(u => u <= a).slice(0, 4)) {
        const mid = a - b;
        for (const c of [1, 2, 3, 5]) bank.push(q(`${a} - ${b} + ${c} = ?`, mid + c));
        for (const c of [10, 20]) bank.push(q(`${a} - ${b} + ${c} = ?`, mid + c));
    }
}

// ── Type 7: Simple add (1–20) ─────────────────────────────────────────────────
for (let a = 1; a <= 20; a++) {
    for (let b = 1; b <= 20; b++) {
        if (a + b <= 30) bank.push(q(`${a} + ${b} = ?`, a + b));
    }
}

// ── Type 8: Simple sub (1–20) ─────────────────────────────────────────────────
for (let a = 2; a <= 20; a++) {
    for (let b = 1; b < a; b++) {
        bank.push(q(`${a} - ${b} = ?`, a - b));
    }
}

// ── Deduplicate by prompt ─────────────────────────────────────────────────────
const seen = new Set<string>();
export const grade1Questions: MathQ[] = bank.filter(item => {
    if (seen.has(item.prompt)) return false;
    seen.add(item.prompt);
    return true;
});
