"use client";

import { create } from "zustand";
import type { LotoConfig, LotoRoomSnapshot, LotoGameStatus, LotoMemberState } from "@karaoke/shared";
import { getSocket } from "../lib/socket";

type LotoRole = "host" | "guest" | null;

// ── Session cache ──

const LOTO_SESSION_KEY = "loto_session_v1";

interface LotoSessionCache {
    roomCode: string;
    userId: string;
    displayName: string;
    role: LotoRole;
}

const saveLotoSession = (session: LotoSessionCache): void => {
    if (typeof window === "undefined") return;
    localStorage.setItem(LOTO_SESSION_KEY, JSON.stringify(session));
};

const loadLotoSession = (): LotoSessionCache | null => {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem(LOTO_SESSION_KEY);
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw) as LotoSessionCache;
        if (!parsed.roomCode || !parsed.userId || !parsed.role) return null;
        return parsed;
    } catch {
        return null;
    }
};

const clearLotoSession = (): void => {
    if (typeof window === "undefined") return;
    localStorage.removeItem(LOTO_SESSION_KEY);
};

// ── Bingo card generation ──

type BingoCard = number[][]; // 9 rows, each row has numbers or 0 (blank)

const shuffle = <T>(arr: T[]): T[] => {
    const next = [...arr];
    for (let i = next.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [next[i], next[j]] = [next[j], next[i]];
    }
    return next;
};

const sampleWithoutReplacement = (pool: number[], count: number): number[] => {
    return shuffle(pool).slice(0, count);
};

const getColumnRange = (maxNumber: 60 | 90, col: number): { start: number; end: number } => {
    if (maxNumber === 90) {
        if (col === 0) return { start: 1, end: 9 };
        if (col === 8) return { start: 80, end: 90 };
        return { start: col * 10, end: col * 10 + 9 };
    }

    // 60-so: 6 cot, moi cot 10 so
    const start = col * 10 + 1;
    const end = col * 10 + 10;
    return { start, end };
};

const buildColumnCapacities = (maxNumber: 60 | 90, cols: number): number[] => {
    return Array.from({ length: cols }, (_, c) => {
        const { start, end } = getColumnRange(maxNumber, c);
        return end - start + 1;
    });
};

const distributeColumnCounts = (
    cols: number,
    totalNumbers: number,
    capacities: number[],
    maxPerColumn: number
): number[] => {
    const counts = new Array(cols).fill(0);
    let remaining = totalNumbers;
    while (remaining > 0) {
        const candidates = counts
            .map((count, index) => ({ count, index }))
            .filter((item) => item.count < Math.min(capacities[item.index], maxPerColumn))
        if (candidates.length === 0) {
            throw new Error("Cannot distribute column counts");
        }

        // Prefer least-filled columns to avoid one column being over-dense.
        const minCount = Math.min(...candidates.map((item) => item.count));
        const balancedCandidates = candidates
            .filter((item) => item.count <= minCount + 1)
            .map((item) => item.index);

        const pickedPool = balancedCandidates.length > 0 ? balancedCandidates : candidates.map((item) => item.index);
        const picked = pickedPool[Math.floor(Math.random() * pickedPool.length)];
        counts[picked] += 1;
        remaining -= 1;
    }
    return counts;
};

const buildLayout = (rows: number, cols: number, numsPerRow: number, colCounts: number[]): boolean[][] => {
    const rowQuota = new Array(rows).fill(numsPerRow);
    const layout: boolean[][] = Array.from({ length: rows }, () => Array(cols).fill(false));
    const colOrder = colCounts
        .map((count, index) => ({ count, index }))
        .sort((a, b) => b.count - a.count)
        .map((item) => item.index);

    for (const col of colOrder) {
        const need = colCounts[col];
        if (need === 0) continue;

        const candidates = shuffle(
            rowQuota
                .map((quota, rowIndex) => ({ quota, rowIndex }))
                .filter((item) => item.quota > 0)
                .sort((a, b) => b.quota - a.quota)
        );

        if (candidates.length < need) {
            throw new Error("Cannot place column values");
        }

        const pickedRows = candidates.slice(0, need).map((item) => item.rowIndex);
        for (const row of pickedRows) {
            layout[row][col] = true;
            rowQuota[row] -= 1;
        }
    }

    if (!rowQuota.every((q) => q === 0)) {
        throw new Error("Row quota not satisfied");
    }
    return layout;
};

const generateBingoCard = (maxNumber: 60 | 90): BingoCard => {
    const rows = 9;
    const cols = maxNumber === 60 ? 6 : 9;
    const numsPerRow = maxNumber === 60 ? 4 : 5;
    const totalNumbers = numsPerRow * rows;
    const capacities = buildColumnCapacities(maxNumber, cols);
    // Never allow a full column (all 9 rows filled) and keep distribution balanced.
    const maxPerColumn = maxNumber === 60 ? 7 : 6;

    for (let attempt = 0; attempt < 400; attempt++) {
        try {
            const colCounts = distributeColumnCounts(cols, totalNumbers, capacities, maxPerColumn);
            const layout = buildLayout(rows, cols, numsPerRow, colCounts);
            const card: number[][] = Array.from({ length: rows }, () => Array(cols).fill(0));

            for (let c = 0; c < cols; c++) {
                const { start, end } = getColumnRange(maxNumber, c);
                const pool = Array.from({ length: end - start + 1 }, (_, i) => start + i);
                const need = colCounts[c];
                if (need === 0) continue;
                const numbers = sampleWithoutReplacement(pool, need);
                let idx = 0;
                for (let r = 0; r < rows; r++) {
                    if (layout[r][c]) {
                        card[r][c] = numbers[idx++];
                    }
                }
            }

            return card;
        } catch {
            // retry with a new randomized layout
        }
    }

    throw new Error("Cannot generate valid loto board");
};

const generateInitialBoards = (maxNumber: 60 | 90): BingoCard[] => {
    return [generateBingoCard(maxNumber)];
};

// ── Store ──

interface LotoStore {
    connected: boolean;
    roomCode: string;
    userId: string;
    displayName: string;
    role: LotoRole;
    config: LotoConfig;
    calledNumbers: number[];
    currentNumber: number | null;
    gameStatus: LotoGameStatus;
    memberCount: number;
    readyCount: number;
    members: LotoMemberState[];
    isReady: boolean;
    boards: BingoCard[];
    winnerName: string;
    winnerBankingInfo?: { bankId: string; accountNo: string };
    betAmount: number;
    errorMessage: string;
    isSpinning: boolean;
    initialized: boolean;
    theme: string;

    setTheme: (theme: string) => void;
    connect: () => void;
    createRoom: (displayName: string, config: LotoConfig, bankingInfo?: { bankId: string; accountNo: string }) => Promise<void>;
    joinRoom: (roomCode: string, displayName: string, bankingInfo?: { bankId: string; accountNo: string }) => Promise<boolean>;
    startGame: () => Promise<void>;
    pauseGame: () => Promise<void>;
    callNumber: () => Promise<void>;
    claimWin: () => Promise<void>;
    toggleReady: (ready: boolean) => Promise<void>;
    resetRound: () => Promise<void>;
    closeRoom: () => Promise<void>;
    randomizeBoard: () => void;
    clearError: () => void;
}

type SetFn = (fn: (state: LotoStore) => Partial<LotoStore>) => void;
type GetFn = () => LotoStore;

const emitWithAck = async <TResponse>(
    event: string,
    payload: Record<string, unknown>
): Promise<TResponse> => {
    const socket = await getSocket();
    return await new Promise<TResponse>((resolve) => {
        const timeoutId = window.setTimeout(() => {
            resolve({ ok: false, message: "Không kết nối được realtime socket" } as TResponse);
        }, 6000);

        socket.emit(event, payload, (response: TResponse) => {
            window.clearTimeout(timeoutId);
            resolve(response);
        });
    });
};

const applyLotoSnapshot = (set: SetFn, snapshot: LotoRoomSnapshot): void => {
    set((state) => ({
        roomCode: snapshot.room.roomCode,
        config: snapshot.room.config,
        calledNumbers: snapshot.room.calledNumbers,
        currentNumber: snapshot.room.currentNumber,
        gameStatus: snapshot.room.gameStatus,
        memberCount: snapshot.room.memberCount,
        readyCount: snapshot.room.readyCount,
        members: snapshot.room.members,
        isReady: snapshot.room.members.some((m) => m.userId === state.userId && m.ready),
        winnerName: snapshot.room.gameStatus === "finished" ? state.winnerName : "",
        winnerBankingInfo: snapshot.room.gameStatus === "finished" ? state.winnerBankingInfo : undefined,
        betAmount: snapshot.room.config.betAmount,
        boards: snapshot.myBoard ? [snapshot.myBoard] : state.boards,
        errorMessage: ""
    }));
};

const tryRestoreLotoSession = async (set: SetFn, get: GetFn): Promise<void> => {
    const cached = loadLotoSession();
    if (!cached) return;
    // Don't restore if already in a room
    if (get().roomCode) return;

    const response = await emitWithAck<
        { ok: true; roomCode: string; userId: string; displayName: string; role: "host" | "guest" } | { ok: false; message: string }
    >("loto_restore_session", {
        roomCode: cached.roomCode,
        userId: cached.userId
    });

    if (!response.ok) {
        clearLotoSession();
        return;
    }

    saveLotoSession({
        roomCode: response.roomCode,
        userId: response.userId,
        displayName: response.displayName,
        role: response.role
    });

    set(() => ({
        roomCode: response.roomCode,
        userId: response.userId,
        displayName: response.displayName,
        role: response.role,
        errorMessage: ""
    }));
};

const submitBoardToServer = async (board: number[][], get: GetFn): Promise<void> => {
    const { roomCode } = get();
    if (!roomCode) return;
    await emitWithAck<{ ok: true } | { ok: false; message: string }>(
        "loto_submit_board",
        { roomCode, board }
    );
};

const setupLotoSocketListeners = async (set: SetFn, get: GetFn): Promise<void> => {
    let socket;
    try {
        socket = await getSocket();
    } catch (error) {
        set(() => ({
            connected: false,
            errorMessage: error instanceof Error ? error.message : "Không tải được Socket.IO client"
        }));
        return;
    }

    socket.on("connect", () => {
        set(() => ({ connected: true }));
        void tryRestoreLotoSession(set, get);
    });

    socket.on("disconnect", () => {
        set(() => ({ connected: false }));
    });

    socket.on("loto_room_created", (snapshot) => {
        applyLotoSnapshot(set, snapshot as LotoRoomSnapshot);
    });

    socket.on("loto_room_joined", (snapshot) => {
        applyLotoSnapshot(set, snapshot as LotoRoomSnapshot);
    });

    socket.on("loto_state_updated", (snapshot) => {
        applyLotoSnapshot(set, snapshot as LotoRoomSnapshot);
    });

    socket.on("loto_number_called", (payload) => {
        const data = payload as { number: number; calledNumbers: number[] };
        set(() => ({
            currentNumber: data.number,
            calledNumbers: data.calledNumbers,
            isSpinning: false
        }));
        // Voice announcement
        const { config } = get();
        if (config.voiceEnabled && typeof window !== "undefined" && window.speechSynthesis) {
            const utterance = new SpeechSynthesisUtterance(`Số ${data.number}`);
            utterance.lang = "vi-VN";
            utterance.rate = 0.9;
            window.speechSynthesis.speak(utterance);
        }
    });

    socket.on("loto_game_won", (payload) => {
        const data = payload as { winnerName: string; roomCode: string; betAmount?: number; winnerBankingInfo?: { bankId: string; accountNo: string } };
        set(() => ({ winnerName: data.winnerName, winnerBankingInfo: data.winnerBankingInfo, betAmount: data.betAmount || 0, gameStatus: "finished" }));
    });

    socket.on("loto_room_closed", () => {
        clearLotoSession();
        set(() => ({
            roomCode: "",
            userId: "",
            role: null,
            calledNumbers: [],
            currentNumber: null,
            gameStatus: "waiting",
            memberCount: 0,
            readyCount: 0,
            members: [],
            isReady: false,
            boards: [],
            winnerName: "",
            winnerBankingInfo: undefined,
            betAmount: 0,
            errorMessage: "Phòng đã bị đóng bởi chủ phòng"
        }));
    });

    if (!socket.connected) {
        socket.connect();
    } else {
        set(() => ({ connected: true }));
        void tryRestoreLotoSession(set, get);
    }
};

export const useLotoStore = create<LotoStore>((set, get) => ({
    connected: false,
    roomCode: "",
    userId: "",
    displayName: "",
    role: null,
    config: { maxNumber: 90, intervalSeconds: 5, voiceEnabled: true, betAmount: 0 },
    calledNumbers: [],
    currentNumber: null,
    gameStatus: "waiting",
    memberCount: 0,
    readyCount: 0,
    members: [],
    isReady: false,
    boards: [],
    winnerName: "",
    winnerBankingInfo: undefined,
    betAmount: 0,
    errorMessage: "",
    isSpinning: false,
    initialized: false,
    theme: "default",

    setTheme: (theme: string) => {
        set(() => ({ theme }));
        if (typeof window !== "undefined") {
            localStorage.setItem("loto_theme", theme);
        }
    },

    connect: () => {
        if (get().initialized) return;

        if (typeof window !== "undefined") {
            const savedTheme = localStorage.getItem("loto_theme");
            if (savedTheme) {
                set(() => ({ theme: savedTheme }));
            }
        }

        void setupLotoSocketListeners(set, get);
        set(() => ({ initialized: true }));
    },

    createRoom: async (displayName: string, config: LotoConfig, bankingInfo?: { bankId: string; accountNo: string }) => {
        const response = await emitWithAck<{ ok: true; roomCode: string; userId: string } | { ok: false; message: string }>(
            "loto_create_room",
            { displayName, config, bankingInfo }
        );
        if (!response.ok) {
            set(() => ({ errorMessage: response.message }));
            return;
        }
        const boards = generateInitialBoards(config.maxNumber);
        saveLotoSession({
            roomCode: response.roomCode,
            userId: response.userId,
            displayName,
            role: "host"
        });
        set(() => ({
            roomCode: response.roomCode,
            userId: response.userId,
            displayName,
            role: "host",
            config,
            isReady: false,
            boards,
            errorMessage: ""
        }));
        // Submit initial board to server
        if (boards[0]) {
            void submitBoardToServer(boards[0], get);
        }
    },

    joinRoom: async (roomCode: string, displayName: string, bankingInfo?: { bankId: string; accountNo: string }) => {
        const response = await emitWithAck<{ ok: true; roomCode: string; userId: string } | { ok: false; message: string }>(
            "loto_join_room",
            { roomCode: roomCode.trim().toUpperCase(), displayName, bankingInfo }
        );
        if (!response.ok) {
            set(() => ({ errorMessage: response.message }));
            return false;
        }
        saveLotoSession({
            roomCode: response.roomCode,
            userId: response.userId,
            displayName,
            role: "guest"
        });
        set(() => ({
            roomCode: response.roomCode,
            userId: response.userId,
            displayName,
            role: "guest",
            isReady: false,
            boards: [],
            errorMessage: ""
        }));
        return true;
    },

    startGame: async () => {
        const { roomCode } = get();
        const response = await emitWithAck<{ ok: true } | { ok: false; message: string }>(
            "loto_start_game",
            { roomCode }
        );
        if (!response.ok) {
            set(() => ({ errorMessage: response.message }));
        }
    },

    pauseGame: async () => {
        const { roomCode } = get();
        const response = await emitWithAck<{ ok: true } | { ok: false; message: string }>(
            "loto_pause_game",
            { roomCode }
        );
        if (!response.ok) {
            set(() => ({ errorMessage: response.message }));
        }
    },

    callNumber: async () => {
        const { roomCode } = get();
        const response = await emitWithAck<{ ok: true; number: number } | { ok: false; message: string }>(
            "loto_call_number",
            { roomCode }
        );
        if (!response.ok) {
            set(() => ({ errorMessage: response.message }));
        }
    },

    claimWin: async () => {
        const { roomCode } = get();
        const response = await emitWithAck<{ ok: true } | { ok: false; message: string }>(
            "loto_claim_win",
            { roomCode }
        );
        if (!response.ok) {
            set(() => ({ errorMessage: response.message }));
        }
    },

    toggleReady: async (ready: boolean) => {
        const { roomCode } = get();
        const response = await emitWithAck<{ ok: true } | { ok: false; message: string }>(
            "loto_toggle_ready",
            { roomCode, ready }
        );
        if (!response.ok) {
            set(() => ({ errorMessage: response.message }));
        }
    },

    resetRound: async () => {
        const { roomCode } = get();
        const response = await emitWithAck<{ ok: true } | { ok: false; message: string }>(
            "loto_reset_round",
            { roomCode }
        );
        if (!response.ok) {
            set(() => ({ errorMessage: response.message }));
            return;
        }
        set(() => ({ winnerName: "", winnerBankingInfo: undefined, boards: [] }));
    },

    closeRoom: async () => {
        const { roomCode } = get();
        const response = await emitWithAck<{ ok: true } | { ok: false; message: string }>(
            "loto_close_room",
            { roomCode }
        );
        if (!response.ok) {
            set(() => ({ errorMessage: response.message }));
            return;
        }
        clearLotoSession();
        set(() => ({
            roomCode: "",
            userId: "",
            role: null,
            calledNumbers: [],
            currentNumber: null,
            gameStatus: "waiting",
            memberCount: 0,
            readyCount: 0,
            members: [],
            isReady: false,
            boards: [],
            winnerName: "",
            winnerBankingInfo: undefined,
            betAmount: 0
        }));
    },

    randomizeBoard: () => {
        const { config } = get();
        const card = generateBingoCard(config.maxNumber);
        set(() => ({ boards: [card] }));
        void submitBoardToServer(card, get);
    },

    clearError: () => {
        set(() => ({ errorMessage: "" }));
    }
}));

export type { BingoCard };
