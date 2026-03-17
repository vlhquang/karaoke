"use client";

import { useState, useMemo, useEffect, useRef, FormEvent, ChangeEvent } from "react";

interface Transaction {
    id: number;
    symbol: string;
    date: string;
    price: number;
    quantity: number;
    status: "HOLD" | "SOLD";
    sellPrice?: number;
    sellDate?: string;
}

interface PriceInfo {
    current: number;
    previous: number | null;
    opening: number | null;
    reference: number | null;
    color: string | null;
    timestamp: string | null;
}

interface WorkerStatus {
    running: boolean;
    intervalMinutes: number;
    lastRunAt: string | null;
    nextRunAt: string | null;
    lastStatus: "idle" | "updated" | "skipped" | "error";
    lastMessage: string;
}

export default function StockPage() {
    const [accessCode, setAccessCode] = useState("");
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [currentPrices, setCurrentPrices] = useState<Record<string, PriceInfo>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [isRefreshingSheet, setIsRefreshingSheet] = useState(false);
    const [isRefreshingPrices, setIsRefreshingPrices] = useState(false);
    const [loginError, setLoginError] = useState("");
    const [addError, setAddError] = useState("");
    const [notification, setNotification] = useState<{ msg: string; type: "success" | "info" } | null>(null);
    const [isInitialized, setIsInitialized] = useState(false);

    // Form states
    const [symbolInput, setSymbolInput] = useState("");
    const [dateInput, setDateInput] = useState(new Date().toISOString().split("T")[0]);
    const [priceInput, setPriceInput] = useState("");
    const [quantityInput, setQuantityInput] = useState("");

    // Sell Dialog states
    const [sellTx, setSellTx] = useState<Transaction | null>(null);
    const [sellPriceInput, setSellPriceInput] = useState("");
    const [analysisSymbol, setAnalysisSymbol] = useState<string | null>(null);

    // Profit/Loss target states
    const [profitTarget, setProfitTarget] = useState<number>(10);
    const [lossTarget, setLossTarget] = useState<number>(5);

    // Server-side refresh configuration states
    const [autoRefreshMinutes, setAutoRefreshMinutes] = useState(1);
    const [lastUpdated, setLastUpdated] = useState<string | null>(null);
    const [workerStatus, setWorkerStatus] = useState<WorkerStatus | null>(null);
    const [recentlyUpdatedSymbols, setRecentlyUpdatedSymbols] = useState<Record<string, boolean>>({});
    const [refreshCountdown, setRefreshCountdown] = useState(60);
    const [isMinimalMode, setIsMinimalMode] = useState(false);
    const [isWakeLockActive, setIsWakeLockActive] = useState(false);
    const [isAutoUpdateEnabled, setIsAutoUpdateEnabled] = useState(true);
    const wakeLockRef = useRef<any>(null);

    const isSyncingPricesRef = useRef(false);
    const highlightTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

    useEffect(() => {
        const savedCode = localStorage.getItem("stock_access_code");
        if (savedCode) {
            setAccessCode(savedCode);
            setIsLoggedIn(true);
            loadTransactions(savedCode, true);
            loadServerData(savedCode);
            loadWorkerStatus(savedCode);
        }

        const savedProfit = localStorage.getItem("stock_profit_target");
        const savedLoss = localStorage.getItem("stock_loss_target");
        if (savedProfit) setProfitTarget(parseFloat(savedProfit));
        if (savedLoss) setLossTarget(parseFloat(savedLoss));

        setIsInitialized(true);

        // Load UI preferences
        const savedMinimal = localStorage.getItem("stock_minimal_mode");
        const savedWakeLock = localStorage.getItem("stock_wake_lock");
        const savedAutoUpdate = localStorage.getItem("stock_auto_update");

        if (savedMinimal === "true") setIsMinimalMode(true);
        if (savedWakeLock === "true") setIsWakeLockActive(true);
        if (savedAutoUpdate === "false") setIsAutoUpdateEnabled(false);
    }, []);

    useEffect(() => {
        return () => {
            Object.values(highlightTimersRef.current).forEach((timer) => clearTimeout(timer));
            if (wakeLockRef.current) {
                wakeLockRef.current.release().catch(console.error);
            }
        };
    }, []);

    // Wake Lock Logic
    useEffect(() => {
        if (!isWakeLockActive) {
            if (wakeLockRef.current) {
                wakeLockRef.current.release().then(() => {
                    wakeLockRef.current = null;
                }).catch(console.error);
            }
            return;
        }

        const requestWakeLock = async () => {
            try {
                if ('wakeLock' in navigator) {
                    wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
                    console.log('Wake Lock is active');
                }
            } catch (err: any) {
                console.error(`${err.name}, ${err.message}`);
                setIsWakeLockActive(false);
            }
        };

        requestWakeLock();

        const handleVisibilityChange = () => {
            if (wakeLockRef.current !== null && document.visibilityState === 'visible') {
                requestWakeLock();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            if (wakeLockRef.current) {
                wakeLockRef.current.release().catch(console.error);
                wakeLockRef.current = null;
            }
        };
    }, [isWakeLockActive]);

    // Auto-refresh countdown logic
    useEffect(() => {
        if (!isLoggedIn || !isAutoUpdateEnabled) return;

        const hasHoldStocks = transactions.some(t => t.status === "HOLD");
        if (!hasHoldStocks) return;

        if (isRefreshingPrices) return;

        const timer = setInterval(() => {
            setRefreshCountdown((prev: number) => {
                if (prev <= 1) {
                    // Trigger refresh
                    const holdSymbols = transactions
                        .filter((t: Transaction) => t.status === "HOLD")
                        .map((t: Transaction) => t.symbol);
                    if (holdSymbols.length > 0) {
                        fetchRealtimePrices(holdSymbols, true);
                    }
                    return 60;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [isLoggedIn, isRefreshingPrices, transactions]);

    // Reset countdown when refresh finishes
    useEffect(() => {
        if (!isRefreshingPrices) {
            setRefreshCountdown(60);
        }
    }, [isRefreshingPrices]);

    const markSymbolRecentlyUpdated = (symbol: string) => {
        const normalizedSymbol = symbol.trim().toUpperCase();
        if (!normalizedSymbol) return;

        if (highlightTimersRef.current[normalizedSymbol]) {
            clearTimeout(highlightTimersRef.current[normalizedSymbol]);
        }

        setRecentlyUpdatedSymbols((prev: Record<string, boolean>) => ({ ...prev, [normalizedSymbol]: true }));

        highlightTimersRef.current[normalizedSymbol] = setTimeout(() => {
            setRecentlyUpdatedSymbols((prev: Record<string, boolean>) => {
                const next = { ...prev };
                delete next[normalizedSymbol];
                return next;
            });
            delete highlightTimersRef.current[normalizedSymbol];
        }, 5000);
    };

    const syncPricesFromServer = async (code: string) => {
        if (isSyncingPricesRef.current) return;
        isSyncingPricesRef.current = true;
        try {
            const pRes = await fetch("/api/stocks", {
                method: "POST",
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({ action: "get_prices", accessCode: code }),
            });
            const pData = await pRes.json();
            if (pData.ok && pData.data) {
                const mappedPrices: Record<string, PriceInfo> = {};
                let latestTs: string | null = null;
                let latestTsMs = Number.NEGATIVE_INFINITY;
                const changedSymbols: string[] = [];
                for (const symbol in pData.data) {
                    const normalizedSymbol = symbol.trim().toUpperCase();
                    const p = pData.data[symbol];
                    const ts = typeof p.timestamp === "string" ? p.timestamp : null;
                    mappedPrices[normalizedSymbol] = {
                        current: p.price,
                        opening: p.openingPrice,
                        reference: p.referencePrice,
                        previous: null,
                        color: typeof p.color === "string" ? p.color : null,
                        timestamp: ts
                    };
                    const tsMs = parseTimestampToMs(ts);
                    if (tsMs !== null && tsMs > latestTsMs) {
                        latestTsMs = tsMs;
                        latestTs = ts;
                    } else if (latestTs === null && ts) {
                        latestTs = ts;
                    }
                }
                setCurrentPrices((prev: Record<string, PriceInfo>) => {
                    const next = { ...prev };
                    for (const symbol in mappedPrices) {
                        const incoming = mappedPrices[symbol];
                        const prevItem = prev[symbol];
                        const hasChanged =
                            !prevItem ||
                            prevItem.current !== incoming.current ||
                            prevItem.reference !== incoming.reference ||
                            prevItem.opening !== incoming.opening ||
                            prevItem.timestamp !== incoming.timestamp;
                        if (hasChanged) {
                            changedSymbols.push(symbol);
                        }
                        next[symbol] = {
                            ...incoming,
                            previous: prevItem?.current ?? incoming.previous
                        };
                    }
                    return next;
                });
                changedSymbols.forEach(markSymbolRecentlyUpdated);
                setLastUpdated(latestTs);
            }
        } catch (err) {
            console.error("Failed to sync stock prices from server", err);
        } finally {
            isSyncingPricesRef.current = false;
        }
    };

    const loadServerData = async (code: string) => {
        try {
            await syncPricesFromServer(code);

            const cRes = await fetch("/api/stocks", {
                method: "POST",
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({ action: "get_config", accessCode: code }),
            });
            const cData = await cRes.json();
            if (cData.ok && cData.data) {
                if (cData.data.AUTO_REFRESH_MINUTES !== undefined) {
                    setAutoRefreshMinutes(parseInt(cData.data.AUTO_REFRESH_MINUTES) || 1);
                }
            }
        } catch (err) {
            console.error("Failed to load server data", err);
        }
    };

    const loadWorkerStatus = async (code: string) => {
        try {
            const res = await fetch(`/api/stocks/worker-status`, {
                cache: "no-store"
            });
            const data = await res.json();
            if (data?.ok && data?.data) {
                setWorkerStatus(data.data as WorkerStatus);
            }
        } catch (err) {
            console.error("Failed to load worker status", err);
        }
    };

    const formatMoney = (value: number) => {
        return Math.round(value).toLocaleString("vi-VN");
    };

    const formatInputNumber = (val: string) => {
        const num = val.replace(/\D/g, "");
        return num ? parseInt(num).toLocaleString("vi-VN") : "";
    };

    const showToast = (msg: string, type: "success" | "info" = "success") => {
        setNotification({ msg, type });
        setTimeout(() => setNotification(null), 3000);
    };

    const fetchRealtimePrices = async (symbols: string[], isRefresh = false) => {
        if (symbols.length === 0) return;
        setIsRefreshingPrices(true);
        const uniqueSymbols = Array.from(new Set(symbols.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean)));

        await Promise.allSettled(
            uniqueSymbols.map(async (symbol) => {
                try {
                    const cacheBuster = isRefresh ? `&_t=${Date.now()}` : "";
                    const refreshParam = isRefresh ? "&refresh=true" : "";
                    const res = await fetch(`/api/stocks/price?symbol=${symbol}${refreshParam}${cacheBuster}`);
                    const data = await res.json();
                    if (data.ok) {
                        setCurrentPrices((prev: Record<string, PriceInfo>) => ({
                            ...prev,
                            [symbol]: {
                                current: data.price,
                                opening: data.openingPrice,
                                reference: data.referencePrice,
                                previous: prev[symbol]?.current || null,
                                color: data.color || null,
                                timestamp: data.timestamp
                            }
                        }));
                        markSymbolRecentlyUpdated(symbol);

                        // Update global lastUpdated if this fetch is newer
                        if (data.timestamp) {
                            setLastUpdated((prev: string | null) => {
                                if (!prev) return data.timestamp;
                                const currentT = parseTimestampToMs(prev);
                                const newT = parseTimestampToMs(data.timestamp);
                                if (currentT !== null && newT !== null && newT > currentT) {
                                    return data.timestamp;
                                }
                                return prev;
                            });
                        }
                    }
                } catch (err) {
                    console.error(`Failed to fetch price for ${symbol}`, err);
                }
            })
        );

        setIsRefreshingPrices(false);
        if (isRefresh) {
            showToast("Cập nhật giá mới nhất thành công", "info");
        }
    };

    const loadTransactions = async (code: string, isSilent = false) => {
        if (!isSilent) setIsRefreshingSheet(true);
        setIsLoading(true);
        try {
            const res = await fetch("/api/stocks", {
                method: "POST",
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({ action: "list", accessCode: code }),
            });
            const data = await res.json();
            if (data.ok) {
                const list = (data.data || []).map((tx: any) => ({
                    ...tx,
                    symbol: String(tx.symbol || "").trim().toUpperCase(),
                    status: String(tx.status || "").trim().toUpperCase() as "HOLD" | "SOLD"
                }));
                setTransactions(list);
                if (!isSilent) showToast("Tải dữ liệu từ Google Sheets xong");
                const symbols = list.filter((tx: Transaction) => tx.status === "HOLD").map((tx: Transaction) => tx.symbol);
                if (symbols.length > 0) {
                    fetchRealtimePrices(symbols);
                }
            } else {
                throw new Error(data.message || "Không thể tải dữ liệu");
            }
        } catch (err: any) {
            alert(err.message);
        } finally {
            setIsLoading(false);
            if (!isSilent) setIsRefreshingSheet(false);
        }
    };

    const handleLogin = async (e: FormEvent) => {
        e.preventDefault();
        setLoginError("");
        setIsLoading(true);
        try {
            const res = await fetch("/api/stocks", {
                method: "POST",
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({ action: "login", accessCode }),
            });
            const data = await res.json();
            if (data.ok) {
                setIsLoggedIn(true);
                localStorage.setItem("stock_access_code", accessCode);
                loadTransactions(accessCode, true);
                loadServerData(accessCode);
                loadWorkerStatus(accessCode);
            } else {
                setLoginError(data.message || "Mã truy cập không hợp lệ");
            }
        } catch (err) {
            setLoginError("Lỗi kết nối server");
        } finally {
            setIsLoading(false);
        }
    };

    const handleBackToPortal = () => {
        localStorage.removeItem("stock_access_code");
        window.location.href = "/";
    };

    const handleAdd = async (e: FormEvent) => {
        e.preventDefault();
        setAddError("");
        const priceValue = parseFloat(priceInput.replace(/\D/g, ""));
        const quantityValue = parseInt(quantityInput.replace(/\D/g, ""));

        if (!symbolInput || !dateInput || isNaN(priceValue) || isNaN(quantityValue)) {
            setAddError("Vui lòng nhập đầy đủ thông tin");
            return;
        }

        setIsLoading(true);
        try {
            const symbol = symbolInput.toUpperCase();
            const res = await fetch("/api/stocks", {
                method: "POST",
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({
                    action: "add",
                    accessCode,
                    symbol,
                    date: dateInput,
                    price: priceValue,
                    quantity: quantityValue,
                }),
            });
            const data = await res.json();
            if (data.ok) {
                const newTx: Transaction = {
                    id: data.data?.id || Date.now(),
                    symbol,
                    date: dateInput,
                    price: priceValue,
                    quantity: quantityValue,
                    status: "HOLD"
                };
                setTransactions([newTx, ...transactions]);
                setSymbolInput("");
                setPriceInput("");
                setQuantityInput("");
                fetchRealtimePrices([symbol]);
            } else {
                setAddError(data.message || "Thêm giao dịch thất bại");
            }
        } catch (err) {
            setAddError("Lỗi kết nối server");
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Xác nhận xóa vĩnh viễn giao dịch này?")) return;
        setIsLoading(true);
        try {
            const res = await fetch("/api/stocks", {
                method: "POST",
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({ action: "delete", accessCode, id }),
            });
            const data = await res.json();
            if (data.ok) {
                setTransactions(transactions.filter((tx: Transaction) => tx.id !== id));
                showToast("Đã xóa giao dịch");
            } else {
                alert(data.message || "Xóa thất bại");
            }
        } catch (err) {
            alert("Lỗi kết nối server");
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenSellDialog = (tx: Transaction) => {
        setSellTx(tx);
        const current = currentPrices[tx.symbol]?.current || tx.price;
        setSellPriceInput(current.toLocaleString("vi-VN"));
    };

    const handleConfirmSell = async () => {
        if (!sellTx) return;
        const sellPriceValue = parseFloat(sellPriceInput.replace(/\D/g, ""));
        if (isNaN(sellPriceValue) || sellPriceValue <= 0) {
            alert("Giá bán không hợp lệ");
            return;
        }

        setIsLoading(true);
        try {
            const res = await fetch("/api/stocks", {
                method: "POST",
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({
                    action: "sell",
                    accessCode,
                    id: sellTx.id,
                    sellPrice: sellPriceValue,
                }),
            });
            const data = await res.json();
            if (data.ok) {
                const now = new Date();
                const pad = (n: number) => n.toString().padStart(2, '0');
                const formattedNow = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
                setTransactions(transactions.map((tx: Transaction) =>
                    tx.id === sellTx.id
                        ? { ...tx, status: "SOLD", sellPrice: sellPriceValue, sellDate: data.data?.sellDate || formattedNow }
                        : tx
                ));
                setSellTx(null);
                showToast("Đã ghi nhận bán thành công");
            } else {
                alert(data.message || "Bán thất bại");
            }
        } catch (err) {
            alert("Lỗi kết nối server");
        } finally {
            setIsLoading(false);
        }
    };

    const openAnalysisPopup = (symbol: string) => {
        setAnalysisSymbol(symbol.toUpperCase());
    };

    const totalInvestment = useMemo(() => {
        return transactions
            .filter((tx: Transaction) => tx.status === "HOLD")
            .reduce((sum: number, tx: Transaction) => sum + tx.price * tx.quantity, 0);
    }, [transactions]);

    const totalMarketValue = useMemo(() => {
        return transactions
            .filter((tx: Transaction) => tx.status === "HOLD")
            .reduce((sum: number, tx: Transaction) => {
                const current = currentPrices[tx.symbol]?.current || 0;
                return sum + (current > 0 ? current : tx.price) * tx.quantity;
            }, 0);
    }, [transactions, currentPrices]);

    const totalProfitLossManual = totalMarketValue - totalInvestment;
    const totalProfitValueSold = useMemo(() => {
        return transactions
            .filter((tx: Transaction) => tx.status === "SOLD" && tx.sellPrice !== undefined)
            .reduce((sum: number, tx: Transaction) => sum + (tx.sellPrice! - tx.price) * tx.quantity, 0);
    }, [transactions]);

    const totalSoldInvestment = useMemo(() => {
        return transactions
            .filter((tx: Transaction) => tx.status === "SOLD" && tx.sellPrice !== undefined)
            .reduce((sum: number, tx: Transaction) => sum + tx.price * tx.quantity, 0);
    }, [transactions]);

    const overallTotalProfit = totalProfitLossManual + totalProfitValueSold;
    const overallTotalInvestment = totalInvestment + totalSoldInvestment;

    const groupedTransactions = useMemo(() => {
        const groups: Record<string, Transaction[]> = {};
        transactions.forEach((tx: Transaction) => {
            if (!groups[tx.symbol]) groups[tx.symbol] = [];
            groups[tx.symbol].push(tx);
        });
        return groups;
    }, [transactions]);

    const analysisUrl = analysisSymbol ? `https://fireant.vn/ma-chung-khoan/${analysisSymbol}` : "";

    const getStockPriceColorClass = (price: number, info: PriceInfo | null) => {
        if (!info || price <= 0) return "text-slate-600";

        // Tier 1: Direct color from Vietstock
        if (info.color === "purple") return "text-stock-ceiling";
        if (info.color === "blue") return "text-stock-floor";

        // Tier 2: Calculation Fallback (7% margin for HOSE)
        const ref = info.reference || info.opening || 0;
        if (ref > 0) {
            if (price >= ref * 1.069) return "text-stock-ceiling";
            if (price <= ref * 0.931) return "text-stock-floor";
        }

        // Standard colors
        if (price > ref) return "text-emerald-400";
        if (price < ref) return "text-red-400";
        return "text-slate-400"; // Reference price
    };

    if (!isInitialized) return null;

    if (!isLoggedIn) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4 font-sans text-slate-200">
                <div className="w-full max-w-md space-y-8 rounded-3xl border border-slate-800 bg-slate-900/50 p-8 backdrop-blur-xl">
                    <div className="text-center">
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-500">
                            <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                            </svg>
                        </div>
                        <h2 className="mt-6 text-2xl font-black tracking-tight text-white uppercase">Danh Mục Đầu Tư</h2>
                        <p className="mt-2 text-sm text-slate-500">Nhập mã để quản lý danh mục</p>
                    </div>

                    <form className="mt-8 space-y-4" onSubmit={handleLogin}>
                        <div>
                            <input
                                autoFocus
                                type="password"
                                value={accessCode}
                                onChange={(e: ChangeEvent<HTMLInputElement>) => setAccessCode(e.target.value)}
                                className="w-full rounded-2xl border border-slate-700 bg-slate-800/50 px-5 py-4 text-center font-mono text-xl tracking-[0.5em] text-white outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
                                placeholder="••••••"
                            />
                            {loginError && <p className="mt-2 text-center text-sm font-bold text-red-500 uppercase">{loginError}</p>}
                        </div>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full rounded-2xl bg-cyan-600 py-4 font-black text-white hover:bg-cyan-500 active:scale-[0.98] transition-all disabled:opacity-50"
                        >
                            {isLoading ? "ĐANG XÁC THỰC..." : "TRUY CẬP HỆ THỐNG"}
                        </button>
                    </form>

                    <div className="pt-4 border-t border-slate-800">
                        <button
                            onClick={handleBackToPortal}
                            className="w-full text-center text-xs font-bold text-slate-500 hover:text-slate-300 transition-colors uppercase"
                        >
                            Quay lại trang chủ portal
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <main className="min-h-screen bg-slate-950 font-sans text-slate-200">
            {/* Header section with worker status */}
            <header className="border-b border-slate-800 bg-slate-900/50 pt-8 pb-6 bg-transparent">
                <div className="mx-auto max-w-6xl px-4 flex flex-col items-center">
                    <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-cyan-500 text-slate-950">
                                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                </svg>
                            </div>
                            <div>
                                <h1 className="text-xl font-black text-white leading-none uppercase">Stock Manager</h1>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Portfolio Tracker Pro</p>
                            </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                            {/* Worker status and update time removed */}
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => {
                                        const next = !isMinimalMode;
                                        setIsMinimalMode(next);
                                        localStorage.setItem("stock_minimal_mode", next.toString());
                                    }}
                                    className={`w-20 rounded-lg py-1.5 text-[10px] font-black uppercase transition-all ${isMinimalMode ? "bg-cyan-500 text-slate-950" : "bg-slate-800 text-slate-400"}`}
                                >
                                    Tối giản
                                </button>
                                <button
                                    onClick={() => {
                                        const next = !isWakeLockActive;
                                        setIsWakeLockActive(next);
                                        localStorage.setItem("stock_wake_lock", next.toString());
                                    }}
                                    className={`w-20 rounded-lg py-1.5 text-[10px] font-black uppercase transition-all ${isWakeLockActive ? "bg-orange-500 text-slate-950" : "bg-slate-800 text-slate-400"}`}
                                >
                                    Sáng màn
                                </button>
                                <button
                                    onClick={() => {
                                        const next = !isAutoUpdateEnabled;
                                        setIsAutoUpdateEnabled(next);
                                        localStorage.setItem("stock_auto_update", next.toString());
                                    }}
                                    className={`w-20 rounded-lg py-1.5 text-[10px] font-black uppercase transition-all ${isAutoUpdateEnabled ? "bg-emerald-500 text-slate-950" : "bg-slate-800 text-slate-400"}`}
                                >
                                    Auto
                                </button>
                            </div>
                        </div>

                    </div>
                </div>
            </header>

            <div className={`mx-auto max-w-6xl px-4 py-8 space-y-8 ${isMinimalMode ? "hidden" : "block"}`}>
                {/* Summary Section moved here */}
                <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 shadow-lg shadow-cyan-950/10">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Đang đầu tư (Hold)</p>
                        <p className="mt-1 text-2xl font-black text-white">{formatMoney(totalInvestment)}</p>
                        <div className="mt-1 text-[10px] font-bold text-slate-600 uppercase border-t border-slate-800/50 pt-1">
                            Giá trị TT: <span className="text-white">{formatMoney(totalMarketValue)}</span>
                        </div>
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 shadow-lg shadow-emerald-950/10">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Lãi / Lỗ tạm tính</p>
                        <div className="mt-1 flex items-baseline gap-2">
                            <p className={`text-2xl font-black ${totalProfitLossManual >= 0 ? "text-emerald-400" : "text-red-400 text-opacity-80"}`}>
                                {(totalProfitLossManual > 0 ? "+" : "") + formatMoney(totalProfitLossManual)}
                            </p>
                            <span className={`text-xs font-bold ${totalProfitLossManual >= 0 ? "text-emerald-500/60" : "text-red-500/60"}`}>
                                ({totalInvestment > 0 ? ((totalProfitLossManual / totalInvestment) * 100).toFixed(2) : "0.00"}%)
                            </span>
                        </div>
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 shadow-lg shadow-slate-950/10">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Lợi nhuận chốt (Sold)</p>
                        <div className="mt-1 flex items-baseline gap-2">
                            <p className={`text-2xl font-black ${totalProfitValueSold >= 0 ? "text-emerald-400" : "text-red-400 text-opacity-80"}`}>
                                {(totalProfitValueSold > 0 ? "+" : "") + formatMoney(totalProfitValueSold)}
                            </p>
                            <span className={`text-xs font-bold ${totalProfitValueSold >= 0 ? "text-emerald-500/60" : "text-red-500/60"}`}>
                                ({totalSoldInvestment > 0 ? ((totalProfitValueSold / totalSoldInvestment) * 100).toFixed(2) : "0.00"}%)
                            </span>
                        </div>
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-emerald-900/10 p-4 shadow-lg border-emerald-500/20">
                        <p className="text-[10px] font-bold text-emerald-500/80 uppercase tracking-widest">Tổng hiệu suất (Hold+Sold)</p>
                        <div className="mt-1 flex items-baseline gap-2">
                            <p className={`text-2xl font-black ${overallTotalProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                {(overallTotalProfit > 0 ? "+" : "") + formatMoney(overallTotalProfit)}
                            </p>
                            <span className={`text-xs font-bold ${overallTotalProfit >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                                ({overallTotalInvestment > 0 ? ((overallTotalProfit / overallTotalInvestment) * 100).toFixed(2) : "0.00"}%)
                            </span>
                        </div>
                    </div>
                </div>
                {/* Form and Settings Grid */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                    {/* Add Transaction Form */}
                    <div className="lg:col-span-8">
                        <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6">
                            <div className="flex items-center gap-2 mb-6">
                                <div className="h-5 w-1 bg-cyan-500 rounded-full"></div>
                                <h3 className="text-sm font-black text-white uppercase tracking-widest">Thêm giao dịch mới</h3>
                            </div>

                            <form className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4" onSubmit={handleAdd}>
                                <div>
                                    <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Mã Chứng Khoán</label>
                                    <input
                                        type="text"
                                        value={symbolInput}
                                        onChange={(e: ChangeEvent<HTMLInputElement>) => setSymbolInput(e.target.value.toUpperCase())}
                                        className="w-full rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3 text-sm font-bold text-white outline-none focus:border-cyan-500"
                                        placeholder="VND, HPG..."
                                    />
                                </div>
                                <div>
                                    <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Ngày Mua</label>
                                    <input
                                        type="date"
                                        value={dateInput}
                                        onChange={(e: ChangeEvent<HTMLInputElement>) => setDateInput(e.target.value)}
                                        className="w-full rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3 text-sm font-bold text-white outline-none focus:border-cyan-500"
                                    />
                                </div>
                                <div>
                                    <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Giá Vốn</label>
                                    <input
                                        type="text"
                                        value={priceInput}
                                        onChange={(e: ChangeEvent<HTMLInputElement>) => setPriceInput(formatInputNumber(e.target.value))}
                                        className="w-full rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3 text-sm font-bold text-white outline-none focus:border-cyan-500 text-right"
                                        placeholder="0"
                                    />
                                </div>
                                <div>
                                    <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Số Lượng</label>
                                    <input
                                        type="text"
                                        value={quantityInput}
                                        onChange={(e: ChangeEvent<HTMLInputElement>) => setQuantityInput(formatInputNumber(e.target.value))}
                                        className="w-full rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3 text-sm font-bold text-white outline-none focus:border-cyan-500 text-right"
                                        placeholder="0"
                                    />
                                </div>
                                <div className="sm:col-span-2 md:col-span-4 flex items-center justify-between gap-4">
                                    {addError && <p className="text-xs font-bold text-red-500 uppercase">{addError}</p>}
                                    <button
                                        type="submit"
                                        disabled={isLoading}
                                        className="ml-auto flex items-center gap-2 rounded-xl bg-cyan-600 px-8 py-3.5 text-xs font-black text-white hover:bg-cyan-500 active:scale-95 transition-all disabled:opacity-50"
                                    >
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                                        </svg>
                                        THÊM VÀO DANH MỤC
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>

                    {/* Target Settings */}
                    <div className="lg:col-span-4">
                        <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6 h-full">
                            <div className="flex items-center gap-2 mb-6">
                                <div className="h-5 w-1 bg-emerald-500 rounded-full"></div>
                                <h3 className="text-sm font-black text-white uppercase tracking-widest">Thiết lập mục tiêu</h3>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Chốt lời mục tiêu</label>
                                        <span className="text-xs font-black text-emerald-400">{profitTarget}%</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="1"
                                        max="100"
                                        value={profitTarget}
                                        onChange={(e: ChangeEvent<HTMLInputElement>) => {
                                            const val = parseInt(e.target.value);
                                            setProfitTarget(val);
                                            localStorage.setItem("stock_profit_target", val.toString());
                                        }}
                                        className="w-full accent-emerald-500"
                                    />
                                </div>
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Cắt lỗ kỷ luật</label>
                                        <span className="text-xs font-black text-red-400">{lossTarget}%</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="1"
                                        max="100"
                                        value={lossTarget}
                                        onChange={(e: ChangeEvent<HTMLInputElement>) => {
                                            const val = parseInt(e.target.value);
                                            setLossTarget(val);
                                            localStorage.setItem("stock_loss_target", val.toString());
                                        }}
                                        className="w-full accent-red-500"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    {Object.keys(groupedTransactions).sort().map((symbol: string) => {
                        const txs = groupedTransactions[symbol].sort((a: Transaction, b: Transaction) => b.id - a.id);
                        const price = currentPrices[symbol];
                        const currentPriceValue = price?.current || 0;
                        const isRecentlyChanged = recentlyUpdatedSymbols[symbol];

                        return (
                            <div key={symbol} className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/40 shadow-sm transition-all hover:bg-slate-900/60">
                                <div className={`flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800/50 px-6 py-4 transition-colors duration-[2000ms] ${isRecentlyChanged ? "price-update-flash" : "bg-transparent"}`}>
                                    <div className="flex items-center gap-4">
                                        <button
                                            onClick={() => openAnalysisPopup(symbol)}
                                            className="group flex flex-col"
                                        >
                                            <span className="text-2xl font-black text-white group-hover:text-cyan-400 transition-colors uppercase">{symbol}</span>
                                            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-tighter group-hover:text-cyan-600">Xem Fireant Chart →</span>
                                        </button>
                                        <div className="h-8 w-px bg-slate-800 mx-2 hidden sm:block"></div>
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] text-slate-500 uppercase font-black">Thị giá</span>
                                                {price?.timestamp && (
                                                    <span className="text-[9px] font-bold text-slate-500 bg-slate-800/50 px-1.5 py-0.5 rounded">
                                                        {formatDateTime(price.timestamp)}
                                                    </span>
                                                )}
                                                {isRecentlyChanged && (
                                                    <span className="animate-pulse flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[8px] font-black text-emerald-500">
                                                        <span className="h-1 w-1 rounded-full bg-emerald-500"></span>
                                                        VỪA CẬP NHẬT
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-xl font-black ${getStockPriceColorClass(currentPriceValue, price || null)}`}>
                                                    {currentPriceValue > 0 ? formatMoney(currentPriceValue) : "Đang chờ..."}
                                                </span>
                                                {currentPriceValue > 0 && price?.reference && (
                                                    <div className={`flex items-center gap-1 text-[11px] font-black ${getStockPriceColorClass(currentPriceValue, price || null)}`}>
                                                        <span>{currentPriceValue >= price.reference ? "+" : ""}{formatMoney(currentPriceValue - price.reference)}</span>
                                                        <span>({((currentPriceValue - price.reference) / price.reference * 100).toFixed(1)}%)</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-3 flex items-center gap-6 sm:mt-0">
                                        <div className="flex flex-col items-end">
                                            <span className="text-[10px] text-slate-500 uppercase font-black">Mở cửa / Tham chiếu</span>
                                            <span className="text-xs font-bold text-slate-400">{formatMoney(price?.opening || 0)} / {formatMoney(price?.reference || 0)}</span>
                                        </div>
                                        <div className="h-8 w-px bg-slate-800/50"></div>
                                        <div className="flex flex-col items-end mr-2">
                                            <span className="text-[10px] text-slate-500 uppercase font-black">Hiệu suất danh mục ({symbol})</span>
                                            <div className="flex flex-col items-end">
                                                {(() => {
                                                    const symbolHoldTxs = txs.filter((t: Transaction) => t.status === "HOLD");
                                                    const symbolSoldTxs = txs.filter((t: Transaction) => t.status === "SOLD");

                                                    const groupInvestment = symbolHoldTxs.reduce((sum: number, t: Transaction) => sum + t.price * t.quantity, 0);
                                                    const groupMarketValue = symbolHoldTxs.reduce((sum: number, t: Transaction) => {
                                                        const current = currentPriceValue;
                                                        return sum + (current > 0 ? current : t.price) * t.quantity;
                                                    }, 0);
                                                    const groupUnrealizedPL = groupMarketValue - groupInvestment;

                                                    const groupSoldInvestment = symbolSoldTxs.reduce((sum: number, t: Transaction) => sum + t.price * t.quantity, 0);
                                                    const groupRealizedPL = symbolSoldTxs.reduce((sum: number, t: Transaction) => sum + ((t.sellPrice || 0) - t.price) * t.quantity, 0);

                                                    const groupTotalPL = groupUnrealizedPL + groupRealizedPL;
                                                    const groupTotalInvestment = groupInvestment + groupSoldInvestment;
                                                    const groupPLPerc = groupTotalInvestment > 0 ? (groupTotalPL / groupTotalInvestment) * 100 : 0;

                                                    return (
                                                        <div className="flex items-center gap-2">
                                                            <span className={`text-sm font-black ${groupTotalPL >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                                                {(groupTotalPL >= 0 ? "+" : "") + formatMoney(groupTotalPL)}
                                                            </span>
                                                            <span className={`text-[10px] font-black ${groupTotalPL >= 0 ? "text-emerald-500/70" : "text-red-500/70"}`}>
                                                                ({groupPLPerc.toFixed(1)}%)
                                                            </span>
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Transactions Table (Desktop) */}
                                <div className="hidden md:block overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="bg-slate-900/50 text-[10px] font-black uppercase tracking-widest text-slate-500">
                                                <th className="px-6 py-4">Ngày giao dịch</th>
                                                <th className="px-4 py-4 text-right">Giá vốn / TB</th>
                                                <th className="px-4 py-4 text-right">Số lượng</th>
                                                <th className="px-4 py-4 text-center">Trạng thái</th>
                                                <th className="px-4 py-4 text-right">Giá mục tiêu</th>
                                                <th className="px-6 py-4 text-right">Lãi/Lỗ tạm tính</th>
                                                <th className="px-6 py-4 text-right">Thao tác</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800/30">
                                            {txs.map((tx: Transaction) => {
                                                const isSold = tx.status === "SOLD";
                                                const hasLivePrice = currentPriceValue > 0;
                                                let p = 0;
                                                let pPerc = 0;
                                                if (isSold) {
                                                    p = (tx.sellPrice! - tx.price) * tx.quantity;
                                                    pPerc = ((tx.sellPrice! - tx.price) / tx.price) * 100;
                                                } else if (hasLivePrice) {
                                                    p = (currentPriceValue - tx.price) * tx.quantity;
                                                    pPerc = ((currentPriceValue - tx.price) / tx.price) * 100;
                                                }

                                                return (
                                                    <tr key={tx.id} className={`group hover:bg-slate-800/20 transition-colors ${isSold ? "opacity-60 bg-slate-900/60" : ""}`}>
                                                        <td className="px-6 py-5">
                                                            <div className="flex flex-col">
                                                                <span className="text-sm font-bold text-slate-300">{new Date(tx.date).toLocaleDateString("vi-VN")}</span>
                                                                {isSold && (
                                                                    <span className="text-[10px] font-bold text-slate-500 mt-1">Bán: {formatSellDate(tx.sellDate)}</span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-5 text-right text-sm font-bold text-white">
                                                            {formatMoney(tx.price)}
                                                        </td>
                                                        <td className="px-4 py-5 text-right text-sm font-bold text-slate-400">
                                                            {tx.quantity.toLocaleString("vi-VN")}
                                                        </td>
                                                        <td className="px-4 py-5 text-center">
                                                            <span className={`inline-flex rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-tighter ${isSold ? "bg-emerald-950 text-emerald-500" : "bg-cyan-950 text-cyan-500"}`}>
                                                                {isSold ? "ĐÃ BÁN" : "ĐANG GIỮ"}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-5 text-right">
                                                            {!isSold && (
                                                                <div className="flex flex-col gap-1 items-end">
                                                                    <div className="flex items-center gap-1.5">
                                                                        <span className="text-[9px] font-bold text-emerald-600">T: </span>
                                                                        <span className="text-[11px] font-black text-emerald-500/80">{formatMoney(tx.price * (1 + profitTarget / 100))}</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-1.5">
                                                                        <span className="text-[9px] font-bold text-red-600">C: </span>
                                                                        <span className="text-[11px] font-black text-red-500/80">{formatMoney(tx.price * (1 - lossTarget / 100))}</span>
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {isSold && (
                                                                <div className="flex flex-col items-end">
                                                                    <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-tighter">Giá bán thực tế</span>
                                                                    <span className="text-sm font-black text-emerald-500">{formatMoney(tx.sellPrice!)}</span>
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className={`px-6 py-5 text-right font-black ${p >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                                            <div className="flex flex-col">
                                                                <span className="text-sm">{p >= 0 ? "+" : ""}{formatMoney(p)}</span>
                                                                {(isSold || hasLivePrice) && (
                                                                    <span className="text-[10px] opacity-60">({pPerc.toFixed(1)}%)</span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-5 text-right">
                                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                {!isSold && (
                                                                    <button
                                                                        onClick={() => handleOpenSellDialog(tx)}
                                                                        className="rounded-lg bg-emerald-600/20 px-4 py-2 text-[10px] font-black text-emerald-400 hover:bg-emerald-600/40"
                                                                    >
                                                                        CHỐT BÁN
                                                                    </button>
                                                                )}
                                                                <button
                                                                    onClick={() => handleDelete(tx.id)}
                                                                    className="p-2 text-slate-700 hover:text-red-500 transition-colors"
                                                                    title="Xóa vĩnh viễn"
                                                                >
                                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                                    </svg>
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Mobile View (Cards) */}
                                <div className="md:hidden divide-y divide-slate-800/30">
                                    {txs.map((tx: Transaction) => {
                                        const isSold = tx.status === "SOLD";
                                        const hasLivePrice = currentPriceValue > 0;
                                        let p = 0;
                                        let pPerc = 0;
                                        if (isSold) {
                                            p = (tx.sellPrice! - tx.price) * tx.quantity;
                                            pPerc = ((tx.sellPrice! - tx.price) / tx.price) * 100;
                                        } else if (hasLivePrice) {
                                            p = (currentPriceValue - tx.price) * tx.quantity;
                                            pPerc = ((currentPriceValue - tx.price) / tx.price) * 100;
                                        }

                                        return (
                                            <div key={tx.id} className={`px-6 py-4 flex flex-col gap-3 ${isSold ? "bg-slate-900/60 opacity-60" : ""}`}>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[10px] font-black text-slate-500 uppercase">{new Date(tx.date).toLocaleDateString("vi-VN")}</span>
                                                    <span className={`rounded-full px-2 py-0.5 text-[8px] font-black uppercase ${isSold ? "bg-emerald-950 text-emerald-500" : "bg-cyan-950 text-cyan-500"}`}>
                                                        {isSold ? `ĐÃ BÁN ${formatSellDate(tx.sellDate)} - ${formatMoney(tx.sellPrice!)}` : "ĐANG GIỮ"}
                                                    </span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <div className="flex flex-col">
                                                        <span className="text-[9px] font-bold text-slate-600 uppercase">Mua {tx.quantity.toLocaleString("vi-VN")}</span>
                                                        <span className="text-base font-black text-white">{formatMoney(tx.price)}</span>
                                                    </div>
                                                    <div className="flex items-center justify-end">
                                                        <div className="flex flex-col items-end">
                                                            <span className="text-[9px] font-bold text-slate-600 uppercase">Lãi / Lỗ</span>
                                                            <div className={`text-base font-black ${p >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                                                {p >= 0 ? "+" : ""}{formatMoney(p)}
                                                                <span className="ml-1 text-xs opacity-60">({pPerc.toFixed(1)}%)</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4 bg-slate-950/30 rounded-xl px-3 py-2">
                                                    <div className="flex flex-col">
                                                        <span className="text-[8px] font-black text-emerald-600 uppercase">Mục tiêu</span>
                                                        <span className="text-[10px] font-bold text-emerald-500">{formatMoney(tx.price * (1 + profitTarget / 100))}</span>
                                                    </div>
                                                    <div className="w-px h-4 bg-slate-800"></div>
                                                    <div className="flex flex-col">
                                                        <span className="text-[8px] font-black text-red-600 uppercase">Cắt lỗ</span>
                                                        <span className="text-[10px] font-bold text-red-500">{formatMoney(tx.price * (1 - lossTarget / 100))}</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 mt-1">
                                                    {!isSold && (
                                                        <button
                                                            onClick={() => handleOpenSellDialog(tx)}
                                                            className="flex-1 rounded-xl bg-emerald-600/20 py-3 text-[10px] font-black text-emerald-400 active:bg-emerald-600/40"
                                                        >
                                                            BÁN GIAO DỊCH NÀY
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => handleDelete(tx.id)}
                                                        className="h-10 w-10 flex items-center justify-center rounded-xl border border-slate-800 text-slate-700 active:bg-red-500/10 active:text-red-500"
                                                    >
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Sell Dialog Modal */}
                {sellTx && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={() => setSellTx(null)}></div>
                        <div className="relative w-full max-w-sm rounded-3xl border border-slate-800 bg-slate-900 p-8 shadow-2xl">
                            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500">
                                <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 11l3 3L22 4" />
                                </svg>
                            </div>
                            <h3 className="mb-1 text-xl font-black text-white uppercase">Xác nhận bán</h3>
                            <p className="mb-8 text-xs font-bold text-slate-500 uppercase leading-relaxed">
                                Bán <span className="text-white">{sellTx.quantity}</span> cổ phiếu <span className="text-cyan-400">{sellTx.symbol}</span> mua ngày {new Date(sellTx.date).toLocaleDateString("vi-VN")}?
                            </p>

                            <div className="space-y-6">
                                <div>
                                    <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-500">Giá bán thực tế</label>
                                    <input
                                        autoFocus
                                        value={sellPriceInput}
                                        onChange={(e: ChangeEvent<HTMLInputElement>) => setSellPriceInput(formatInputNumber(e.target.value))}
                                        className="w-full rounded-2xl border border-slate-700 bg-slate-800/50 px-5 py-4 text-2xl font-black text-white outline-none focus:border-emerald-500 transition-all text-right"
                                        placeholder="0"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <button
                                        onClick={() => setSellTx(null)}
                                        className="rounded-2xl border border-slate-700 py-4 text-xs font-black text-slate-400 hover:bg-slate-800 transition-all uppercase"
                                    >
                                        Hủy bỏ
                                    </button>
                                    <button
                                        onClick={handleConfirmSell}
                                        disabled={isLoading}
                                        className="rounded-2xl bg-emerald-600 py-4 text-xs font-black text-white hover:bg-emerald-500 active:scale-95 transition-all disabled:opacity-50 uppercase shadow-lg shadow-emerald-900/20"
                                    >
                                        {isLoading ? "Đang lưu..." : "Xác nhận bán"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Symbol Analysis Popup */}
                {analysisSymbol && (
                    <div className="fixed inset-0 z-[105] flex items-center justify-center p-2 sm:p-4">
                        <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm" onClick={() => setAnalysisSymbol(null)}></div>
                        <div className="relative w-full max-w-6xl h-[90vh] rounded-3xl border border-slate-800 bg-slate-950 shadow-2xl overflow-hidden flex flex-col">
                            <div className="flex items-center justify-between gap-4 border-b border-slate-800 px-6 py-4 bg-slate-900/50">
                                <div>
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Dữ liệu phân tích chứng khoán</p>
                                    <h3 className="text-lg font-black text-white uppercase leading-none">Fireant Chart: <span className="text-cyan-400">{analysisSymbol}</span></h3>
                                </div>
                                <div className="flex items-center gap-3">
                                    <a
                                        href={analysisUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2.5 text-[10px] font-black text-cyan-400 hover:bg-cyan-500/20 transition-all uppercase"
                                    >
                                        Mở tab mới
                                    </a>
                                    <button
                                        onClick={() => setAnalysisSymbol(null)}
                                        className="rounded-xl bg-slate-800 px-4 py-2.5 text-[10px] font-black text-slate-300 hover:bg-slate-700 transition-all uppercase"
                                    >
                                        Đóng
                                    </button>
                                </div>
                            </div>
                            <div className="flex-1 relative">
                                <iframe
                                    src={analysisUrl}
                                    title={`Fireant ${analysisSymbol}`}
                                    className="absolute inset-0 h-full w-full"
                                    referrerPolicy="strict-origin-when-cross-origin"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Bubble Buttons at Bottom */}
                <div className="fixed bottom-8 right-8 z-[90] flex flex-col gap-4 items-end">
                    <button
                        onClick={() => loadTransactions(accessCode)}
                        disabled={isRefreshingSheet}
                        className="group flex h-14 w-14 md:h-16 md:w-auto md:px-6 items-center justify-center gap-3 rounded-2xl bg-slate-900 border border-slate-800 text-white shadow-2xl hover:scale-110 active:scale-95 transition-all disabled:opacity-50"
                        title="Làm mới dữ liệu từ Sheets"
                    >
                        <div className={isRefreshingSheet ? "animate-spin" : ""}>
                            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                        </div>
                        <span className="hidden md:block text-xs font-black uppercase tracking-widest">Làm mới Sheet</span>
                    </button>
                    <button
                        onClick={() => fetchRealtimePrices(transactions.filter((t: Transaction) => t.status === "HOLD").map((t: Transaction) => t.symbol), true)}
                        disabled={isRefreshingPrices || transactions.filter((t: Transaction) => t.status === "HOLD").length === 0}
                        className="group flex h-14 w-14 md:h-16 md:w-auto md:px-6 items-center justify-center gap-3 rounded-2xl bg-cyan-600 text-white shadow-2xl hover:scale-110 active:scale-95 transition-all disabled:opacity-50"
                        title="Làm mới giá thị trường"
                    >
                        <div className="relative flex items-center justify-center">
                            <div className={isRefreshingPrices ? "animate-spin" : ""}>
                                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                </svg>
                            </div>
                            {!isRefreshingPrices && (
                                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-slate-900 text-[8px] font-black text-cyan-400 border border-cyan-500/30">
                                    {refreshCountdown}
                                </span>
                            )}
                        </div>
                        <span className="hidden md:block text-xs font-black uppercase tracking-widest">Làm mới giá</span>
                    </button>
                </div>

                {/* Toast Notification */}
                {notification && (
                    <div className="fixed bottom-12 left-1/2 z-[110] -translate-x-1/2 animate-bounce">
                        <div className={`flex items-center gap-3 rounded-full border px-8 py-3.5 shadow-2xl backdrop-blur-xl ${notification.type === "success"
                            ? "border-emerald-500/50 bg-emerald-950/80 text-emerald-300"
                            : "border-cyan-500/50 bg-cyan-950/80 text-cyan-300"
                            }`}>
                            <div className={`h-2 w-2 rounded-full ${notification.type === "success" ? "bg-emerald-400" : "bg-cyan-400"}`}></div>
                            <span className="text-[10px] font-black uppercase tracking-[0.2em]">{notification.msg}</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Minimalist Mode View */}
            {isMinimalMode && (
                <div className="fixed inset-0 top-[120px] bg-slate-950 z-10 overflow-y-auto px-4 pb-32">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {Object.entries(groupedTransactions).map(([symbol, txs]) => {
                            const holdTxs = txs.filter(t => t.status === "HOLD");
                            if (holdTxs.length === 0) return null;

                            const info = currentPrices[symbol] || null;
                            const currentPriceValue = info?.current || 0;
                            const referenceValue = info?.reference || 0;
                            const avgPrice = holdTxs.reduce((sum, t) => sum + t.price, 0) / holdTxs.length;

                            const pPerc = currentPriceValue > 0
                                ? ((currentPriceValue - avgPrice) / avgPrice) * 100
                                : 0;

                            const isRecentlyUpdated = recentlyUpdatedSymbols[symbol];

                            return (
                                <div
                                    key={symbol}
                                    onClick={() => openAnalysisPopup(symbol)}
                                    className={`relative rounded-2xl border p-4 transition-all active:scale-95 ${isRecentlyUpdated ? "border-cyan-500 bg-cyan-500/10 shadow-[0_0_15px_rgba(6,182,212,0.3)]" : "border-slate-800 bg-slate-900/40"
                                        }`}
                                >
                                    <div className="flex flex-col h-full justify-between gap-1">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-black text-white">{symbol}</span>
                                            {isRecentlyUpdated && (
                                                <span className="flex h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
                                            )}
                                        </div>
                                        <div className={`text-xl font-black leading-none ${getStockPriceColorClass(currentPriceValue, info)}`}>
                                            {currentPriceValue > 0 ? formatMoney(currentPriceValue) : "---"}
                                        </div>
                                        <div className="flex items-center justify-between mt-1 border-t border-slate-800/50 pt-1">
                                            <div className="flex flex-col">
                                                <span className="text-[8px] font-bold text-slate-500 uppercase">TC / AVG</span>
                                                <span className="text-[10px] font-bold text-slate-400">
                                                    {referenceValue > 0 ? formatMoney(referenceValue) : "---"} / {formatMoney(avgPrice)}
                                                </span>
                                            </div>
                                            <span className={`text-sm font-black ${pPerc >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                                {pPerc >= 0 ? "+" : ""}{pPerc.toFixed(1)}%
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Quick Summary in Minimal Mode - Simplified */}
                    <div className="fixed bottom-0 left-0 right-0 bg-slate-900/80 backdrop-blur-xl border-t border-slate-800 p-4 flex justify-end items-center z-20">
                        <div className="flex items-center gap-3">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mr-2">Refresh in</span>
                            {!isAutoUpdateEnabled && (
                                <button
                                    onClick={() => fetchRealtimePrices(transactions.filter((t: Transaction) => t.status === "HOLD").map((t: Transaction) => t.symbol), true)}
                                    className="rounded-xl bg-cyan-600 p-3 text-white shadow-lg active:scale-90 transition-all"
                                >
                                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                </button>
                            )}
                            <div className="relative">
                                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-800 text-cyan-400 border border-slate-700`}>
                                    <span className="text-xs font-black">{refreshCountdown}s</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}

function formatDateTime(input: string | null): string | null {
    if (!input) return null;
    const date = new Date(input);
    if (Number.isNaN(date.getTime())) {
        return input;
    }
    return date.toLocaleString("vi-VN", {
        weekday: "short",
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    });
}

function parseTimestampToMs(input: string | null): number | null {
    if (!input) return null;
    const nativeMs = Date.parse(input);
    if (!Number.isNaN(nativeMs)) return nativeMs;

    const match = input.match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})$/);
    if (!match) return null;

    const [, dd, mm, yyyy, hh, mi, ss] = match;
    const utcMs = Date.UTC(
        Number(yyyy),
        Number(mm) - 1,
        Number(dd),
        Number(hh) - 7,
        Number(mi),
        Number(ss),
        0
    );

    return Number.isNaN(utcMs) ? null : utcMs;
}

function formatSellDate(input: string | undefined | null): string {
    if (!input) return "N/A";

    // Check if it's already in dd/MM/yyyy HH:mm:ss format
    const longFormatRegex = /^\d{2}\/\d{2}\/\d{4}$/;
    if (longFormatRegex.test(input)) return input;

    // Try to parse as date
    const date = new Date(input);
    if (isNaN(date.getTime())) return input;

    const pad = (n: number) => n.toString().padStart(2, '0');
    const d = pad(date.getDate());
    const m = pad(date.getMonth() + 1);
    const y = date.getFullYear();
    // const h = pad(date.getHours());
    // const min = pad(date.getMinutes());
    // const s = pad(date.getSeconds());

    return `${d}/${m}/${y}`;
}
