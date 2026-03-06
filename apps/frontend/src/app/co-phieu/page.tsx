"use client";

import { useState, useMemo, useEffect, FormEvent, ChangeEvent } from "react";
import Link from "next/link";

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
    timestamp: string | null;
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

    // Server-side refresh configuration states
    const [isAutoRefreshEnabled, setIsAutoRefreshEnabled] = useState(false);
    const [autoRefreshMinutes, setAutoRefreshMinutes] = useState(5);
    const [isSavingConfig, setIsSavingConfig] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<string | null>(null);

    useEffect(() => {
        const savedCode = localStorage.getItem("stock_access_code");
        if (savedCode) {
            setAccessCode(savedCode);
            setIsLoggedIn(true);
            loadTransactions(savedCode, true);
            loadServerData(savedCode);
        }
        setIsInitialized(true);
    }, []);

    const loadServerData = async (code: string) => {
        try {
            // Load prices from server
            const pRes = await fetch("/api/stocks", {
                method: "POST",
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({ action: "get_prices", accessCode: code }),
            });
            const pData = await pRes.json();
            if (pData.ok && pData.data) {
                const mappedPrices: Record<string, PriceInfo> = {};
                let latestTs: string | null = null;
                for (const symbol in pData.data) {
                    const p = pData.data[symbol];
                    mappedPrices[symbol] = {
                        current: p.price,
                        opening: p.openingPrice,
                        reference: p.referencePrice,
                        previous: null,
                        timestamp: p.timestamp
                    };
                    if (!latestTs || p.timestamp > latestTs) latestTs = p.timestamp;
                }
                setCurrentPrices(mappedPrices);
                setLastUpdated(latestTs);
            }

            // Load config from server
            const cRes = await fetch("/api/stocks", {
                method: "POST",
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({ action: "get_config", accessCode: code }),
            });
            const cData = await cRes.json();
            if (cData.ok && cData.data) {
                if (cData.data.AUTO_REFRESH_ENABLED !== undefined) {
                    setIsAutoRefreshEnabled(cData.data.AUTO_REFRESH_ENABLED === "true");
                }
                if (cData.data.AUTO_REFRESH_MINUTES !== undefined) {
                    setAutoRefreshMinutes(parseInt(cData.data.AUTO_REFRESH_MINUTES) || 5);
                }
            }
        } catch (err) {
            console.error("Failed to load server data", err);
        }
    };

    const saveServerConfig = async (key: string, value: string) => {
        setIsSavingConfig(true);
        try {
            const res = await fetch("/api/stocks", {
                method: "POST",
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({ action: "save_config", accessCode, key, value }),
            });
            const data = await res.json();
            if (data.ok) {
                showToast(`Đã lưu cấu hình ${key}`, "info");
            }
        } catch (err) {
            showToast("Lỗi lưu cấu hình", "info");
        } finally {
            setIsSavingConfig(false);
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
        const uniqueSymbols = Array.from(new Set(symbols));

        // Start all fetches concurrently
        await Promise.allSettled(
            uniqueSymbols.map(async (symbol) => {
                try {
                    const cacheBuster = isRefresh ? `&_t=${Date.now()}` : "";
                    const refreshParam = isRefresh ? "&refresh=true" : "";
                    const res = await fetch(`/api/stocks/price?symbol=${symbol}${refreshParam}${cacheBuster}`);
                    const data = await res.json();
                    if (data.ok) {
                        // Update state IMMEDIATELY for this specific symbol
                        setCurrentPrices((prev: Record<string, PriceInfo>) => ({
                            ...prev,
                            [symbol]: {
                                current: data.price,
                                opening: data.openingPrice,
                                reference: data.referencePrice,
                                previous: prev[symbol]?.current || null,
                                timestamp: data.timestamp
                            }
                        }));
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
                const list = data.data || [];
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
        if (!confirm("Xác nhận đánh dấu giao dịch này là DELETED?")) return;
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
                showToast("Đã cập nhật trạng thái DELETED");
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
        // Default sell price is current price if available, otherwise buy price
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
                    sellPrice: sellPriceValue
                }),
            });
            const data = await res.json();
            if (data.ok) {
                setTransactions(transactions.map((tx: Transaction) =>
                    tx.id === sellTx.id
                        ? { ...tx, status: "SOLD", sellPrice: sellPriceValue, sellDate: data.data?.sellDate || new Date().toISOString().split("T")[0] }
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

    const analysisUrl = analysisSymbol
        ? `https://fireant.vn/ma-chung-khoan/${encodeURIComponent(analysisSymbol)}`
        : "";

    const totals = useMemo(() => {
        let totalInvested = 0;
        let totalCurrentValue = 0;

        transactions.forEach((tx: Transaction) => {
            const cost = tx.price * tx.quantity;
            totalInvested += cost;

            if (tx.status === "SOLD") {
                const proceed = (tx.sellPrice || 0) * tx.quantity;
                totalCurrentValue += proceed;
            } else {
                const currentPrice = currentPrices[tx.symbol]?.current || 0;
                if (currentPrice > 0) {
                    totalCurrentValue += currentPrice * tx.quantity;
                } else {
                    totalCurrentValue += cost;
                }
            }
        });

        const profit = totalCurrentValue - totalInvested;
        const percent = totalInvested > 0 ? (profit / totalInvested) * 100 : 0;
        return { totalInvested, totalCurrentValue, profit, percent };
    }, [transactions, currentPrices]);

    const groupedData = useMemo(() => {
        const groups: Record<string, Transaction[]> = {};
        transactions.forEach((tx: Transaction) => {
            if (!groups[tx.symbol]) groups[tx.symbol] = [];
            groups[tx.symbol].push(tx);
        });
        Object.keys(groups).forEach((symbol: string) => {
            groups[symbol].sort((a: Transaction, b: Transaction) => new Date(b.date).getTime() - new Date(a.date).getTime());
        });
        return groups;
    }, [transactions]);

    if (!isInitialized) return null;

    if (!isLoggedIn) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-slate-950 p-4 font-sans text-slate-100">
                <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/50 p-8 shadow-2xl backdrop-blur-xl">
                    <div className="mb-8 text-center">
                        <h1 className="text-3xl font-bold tracking-tight text-white">Quản lý Cổ phiếu</h1>
                        <p className="mt-2 text-slate-400">Nhập mã truy cập để tiếp tục</p>
                    </div>
                    <form onSubmit={handleLogin} className="space-y-6">
                        <input
                            type="password"
                            value={accessCode}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => setAccessCode(e.target.value)}
                            placeholder="Mã truy cập"
                            className="w-full rounded-2xl border border-slate-700 bg-slate-800/50 px-5 py-4 text-center text-lg outline-none transition focus:border-cyan-500/50"
                            required
                        />
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full rounded-2xl bg-cyan-600 py-4 font-bold text-white hover:bg-cyan-500 disabled:opacity-50"
                        >
                            {isLoading ? "Đang xác thực..." : "Đăng nhập"}
                        </button>
                    </form>
                    {loginError && <p className="mt-4 text-center text-sm text-red-400">{loginError}</p>}
                    <div className="mt-8 text-center">
                        <button
                            onClick={() => window.location.href = "/"}
                            className="text-sm text-slate-500 hover:text-cyan-400"
                        >
                            ← Quay lại Portal
                        </button>
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-slate-950 p-4 font-sans text-slate-100 md:p-8">
            <div className="mx-auto max-w-6xl">
                <header className="mb-6 flex items-center justify-between gap-4">
                    <h1 className="text-2xl font-bold md:text-3xl uppercase tracking-tight">HOLDING</h1>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => loadTransactions(accessCode)}
                            disabled={isRefreshingSheet}
                            className="rounded-xl border border-slate-700 bg-slate-900/50 px-3 py-2 text-[10px] md:text-xs font-medium transition hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            {isRefreshingSheet ? "Đang tải..." : "Làm mới"}
                        </button>
                        <button
                            onClick={() => fetchRealtimePrices(transactions.filter((t: Transaction) => t.status === "HOLD").map((t: Transaction) => t.symbol), true)}
                            disabled={isRefreshingPrices || transactions.filter(t => t.status === "HOLD").length === 0}
                            className="rounded-xl border border-emerald-900/30 bg-emerald-950/20 px-3 py-2 text-[10px] md:text-xs font-medium text-emerald-400 transition hover:bg-emerald-900/30 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            {isRefreshingPrices ? "Đang cập nhật..." : "Làm mới giá"}
                        </button>
                        <div className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/50 px-3 py-1.5">
                            <div className="flex items-center gap-1">
                                <input
                                    type="checkbox"
                                    id="auto-refresh"
                                    disabled={isSavingConfig}
                                    checked={isAutoRefreshEnabled}
                                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                                        const val = e.target.checked;
                                        setIsAutoRefreshEnabled(val);
                                        saveServerConfig("AUTO_REFRESH_ENABLED", String(val));
                                    }}
                                    className="h-3 w-3 rounded accent-cyan-500"
                                />
                                <label htmlFor="auto-refresh" className="text-[10px] md:text-xs text-slate-400 cursor-pointer select-none">Cron</label>
                            </div>

                            <input
                                type="number"
                                min="1"
                                max="60"
                                disabled={isSavingConfig}
                                value={autoRefreshMinutes}
                                onChange={(e: ChangeEvent<HTMLInputElement>) => setAutoRefreshMinutes(parseInt(e.target.value) || 1)}
                                onBlur={(e: ChangeEvent<HTMLInputElement>) => saveServerConfig("AUTO_REFRESH_MINUTES", e.target.value)}
                                className="w-8 border-none bg-transparent p-0 text-center text-[10px] md:text-xs font-bold text-cyan-400 outline-none"
                            />
                            <span className="text-[10px] md:text-xs text-slate-600">phút</span>

                            {lastUpdated && (
                                <div className="ml-1 flex items-center gap-1 border-l border-slate-700 pl-2">
                                    <span className="text-[8px] md:text-[10px] text-slate-500 whitespace-nowrap">
                                        Server: {lastUpdated.split(',')[1] || lastUpdated}
                                    </span>
                                </div>
                            )}
                        </div>
                        <button
                            onClick={handleBackToPortal}
                            className="ml-2 text-xs text-slate-500 hover:text-cyan-400"
                        >
                            ← Portal
                        </button>
                    </div>
                </header>

                {/* Tổng quan - Single Card */}
                <section className="mb-6">
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 backdrop-blur-md">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
                            <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Danh mục tổng quát</h2>
                            <div className={`text-lg font-black ${totals.percent >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                {totals.percent >= 0 ? "+" : ""}{totals.percent.toFixed(2)}%
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-xs uppercase tracking-wider text-slate-500">Đầu tư</p>
                                <p className="text-xl font-bold">{formatMoney(totals.totalInvested)}</p>
                            </div>
                            <div>
                                <p className="text-xs uppercase tracking-wider text-slate-500">Hiện tại + Đã bán</p>
                                <p className="text-xl font-bold text-cyan-400">{formatMoney(totals.totalCurrentValue)}</p>
                            </div>
                            <div className="col-span-2 rounded-xl bg-slate-800/30 p-3 mt-1 flex items-center justify-between">
                                <p className="text-xs uppercase tracking-wider text-slate-500">Tổng Lãi / Lỗ</p>
                                <p className={`text-2xl font-black ${totals.profit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                    {totals.profit >= 0 ? "+" : ""}{formatMoney(totals.profit)}
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Form thêm nhanh */}
                <section className="mb-8 rounded-2xl border border-slate-800 bg-slate-900/20 p-4">
                    <form onSubmit={handleAdd} className="flex flex-wrap gap-2">
                        <input
                            placeholder="Mã CP"
                            value={symbolInput}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => setSymbolInput(e.target.value.toUpperCase())}
                            className="flex-1 min-w-[70px] rounded-xl border border-slate-700 bg-slate-800/30 px-3 py-2 text-sm outline-none focus:border-cyan-500"
                            required
                        />
                        <input
                            type="date"
                            value={dateInput}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => setDateInput(e.target.value)}
                            className="flex-[1.5] min-w-[110px] rounded-xl border border-slate-700 bg-slate-800/30 px-3 py-2 text-sm outline-none focus:border-cyan-500"
                            required
                        />
                        <input
                            placeholder="Giá mua"
                            value={priceInput}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => setPriceInput(formatInputNumber(e.target.value))}
                            className="flex-1 min-w-[90px] rounded-xl border border-slate-700 bg-slate-800/30 px-3 py-2 text-sm outline-none focus:border-cyan-500"
                            required
                        />
                        <input
                            placeholder="SL"
                            value={quantityInput}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => setQuantityInput(formatInputNumber(e.target.value))}
                            className="flex-[0.5] min-w-[60px] rounded-xl border border-slate-700 bg-slate-800/30 px-3 py-2 text-sm outline-none focus:border-cyan-500"
                            required
                        />
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-white disabled:opacity-50"
                        >
                            Thêm
                        </button>
                    </form>
                    {addError && <p className="mt-2 text-[11px] text-red-400 text-center">{addError}</p>}
                </section>

                {/* Danh sách Grouped */}
                <div className="space-y-4">
                    {Object.keys(groupedData).length === 0 ? (
                        <div className="py-20 text-center text-slate-500 border border-dashed border-slate-800 rounded-2xl text-sm">
                            Trống.
                        </div>
                    ) : (
                        Object.keys(groupedData).sort().map((symbol) => {
                            const txs = groupedData[symbol]!;
                            const priceInfo = currentPrices[symbol];
                            const currentPriceValue = priceInfo?.current || 0;

                            let gInv = 0, gQty = 0, gProfit = 0;
                            txs.forEach((t: Transaction) => {
                                const cost = t.price * t.quantity;
                                gInv += cost;
                                if (t.status === "SOLD") {
                                    gProfit += (t.sellPrice! * t.quantity) - cost;
                                } else {
                                    gQty += t.quantity;
                                    if (currentPriceValue > 0) {
                                        gProfit += (currentPriceValue * t.quantity) - cost;
                                    }
                                }
                            });
                            const gPerc = gInv > 0 ? (gProfit / gInv) * 100 : 0;

                            return (
                                <div key={symbol} className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden">
                                    <div className="bg-slate-800/40 px-4 py-3 flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800 gap-3">
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => openAnalysisPopup(symbol)}
                                                className="text-xl font-black text-cyan-300 underline decoration-dotted underline-offset-4 hover:text-cyan-200"
                                                title={`Mở phân tích kỹ thuật ${symbol}`}
                                            >
                                                {symbol}
                                            </button>
                                            {gQty > 0 && <span className="text-sm text-slate-500 font-mono">({gQty})</span>}
                                        </div>

                                        <div className="flex-1 md:text-right">
                                            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Giá hiện tại</p>
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-mono text-slate-500 leading-none mb-1">
                                                    Cập nhật: {priceInfo?.timestamp || "--/--/---- --:--:--"}
                                                </span>

                                                <div className="flex items-baseline md:justify-end gap-2">
                                                    <span className={`text-2xl font-black ${currentPriceValue > 0 && priceInfo?.reference
                                                        ? (currentPriceValue > priceInfo.reference ? "text-emerald-400" : currentPriceValue < priceInfo.reference ? "text-red-400" : "text-cyan-400")
                                                        : "text-slate-600"
                                                        }`}>
                                                        {currentPriceValue > 0 ? formatMoney(currentPriceValue) : "..."}
                                                    </span>

                                                    {currentPriceValue > 0 && priceInfo?.reference !== undefined && priceInfo?.reference !== null && (
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${currentPriceValue >= priceInfo.reference ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
                                                            {currentPriceValue >= priceInfo.reference ? "↑" : "↓"}
                                                            {formatMoney(Math.abs(currentPriceValue - priceInfo.reference))}
                                                            <span className="ml-1 opacity-70">
                                                                ({(((currentPriceValue - priceInfo.reference) / priceInfo.reference) * 100).toFixed(2)}%)
                                                            </span>
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Giá tham chiếu & Giá mở cửa */}
                                                {priceInfo && (
                                                    <div className="flex gap-3 md:justify-end mt-1">
                                                        {priceInfo.reference !== null && (
                                                            <span className="text-[10px] font-mono text-slate-500">
                                                                TC: <span className="text-yellow-500 font-bold">{formatMoney(priceInfo.reference)}</span>
                                                            </span>
                                                        )}
                                                        {priceInfo.opening !== null && (
                                                            <span className="text-[10px] font-mono text-slate-500">
                                                                MO: <span className="text-sky-400 font-bold">{formatMoney(priceInfo.opening)}</span>
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="md:ml-4 flex flex-col items-end justify-center border-l border-slate-800/50 pl-4">
                                            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Tổng Lãi / Lỗ</p>
                                            <p className={`text-lg font-black leading-none ${gProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                                {gProfit !== 0 ? (gProfit > 0 ? "+" : "") + formatMoney(gProfit) : "0"}
                                            </p>
                                            <p className={`text-[11px] font-bold ${gProfit >= 0 ? "text-emerald-500/60" : "text-red-500/60"}`}>
                                                {gPerc.toFixed(1)}%
                                            </p>
                                        </div>
                                    </div>

                                    {/* Desktop Table */}
                                    <div className="hidden md:block overflow-x-auto">
                                        <table className="w-full text-sm text-left">
                                            <tbody className="divide-y divide-slate-800/30">
                                                {txs.map((tx: Transaction) => {
                                                    const isSold = tx.status === "SOLD";
                                                    let p = 0;
                                                    let pPerc = 0;
                                                    if (isSold) {
                                                        p = (tx.sellPrice! - tx.price) * tx.quantity;
                                                        pPerc = ((tx.sellPrice! - tx.price) / tx.price) * 100;
                                                    } else if (currentPriceValue > 0) {
                                                        p = (currentPriceValue - tx.price) * tx.quantity;
                                                        pPerc = ((currentPriceValue - tx.price) / tx.price) * 100;
                                                    }

                                                    return (
                                                        <tr key={tx.id} className={`hover:bg-slate-800/20 ${isSold ? "bg-slate-900/80 opacity-60" : ""}`}>
                                                            <td className="px-4 py-2">
                                                                <div className="flex flex-col">
                                                                    <span className="text-slate-400">{new Date(tx.date).toLocaleDateString("vi-VN")}</span>
                                                                    {isSold && <span className="text-[10px] font-bold text-emerald-500 uppercase">ĐÃ BÁN {tx.sellDate}</span>}
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-2 text-right">
                                                                <div className="flex flex-col">
                                                                    <span className="text-[10px] text-slate-500 uppercase font-bold">Mua</span>
                                                                    <span className="text-slate-200">{formatMoney(tx.price)}</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-2 text-right">
                                                                <div className="flex flex-col">
                                                                    <span className="text-[10px] text-slate-500 uppercase font-bold">SL</span>
                                                                    <span className="text-slate-200">{tx.quantity}</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-2 text-right">
                                                                {isSold ? (
                                                                    <div className="flex flex-col">
                                                                        <span className="text-[10px] text-emerald-600 uppercase font-bold">Bán</span>
                                                                        <span className="text-emerald-400 font-bold">{formatMoney(tx.sellPrice!)}</span>
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex flex-col">
                                                                        <span className="text-[10px] text-slate-500 uppercase font-bold">Đang giữ</span>
                                                                        <span className="text-slate-400">HOLD</span>
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td className={`px-4 py-2 text-right font-bold ${p >= 0 ? "text-emerald-500/60" : "text-red-500/60"}`}>
                                                                <div className="flex flex-col">
                                                                    <span className="text-[10px] text-slate-500 uppercase font-bold">Lãi/Lỗ {isSold ? "thực" : "tính"}</span>
                                                                    <span>
                                                                        {p !== 0 ? (p > 0 ? "+" : "") + formatMoney(p) : "-"}
                                                                        {p !== 0 && tx.price > 0 && (
                                                                            <span className="ml-1 text-[11px] opacity-60">
                                                                                ({pPerc.toFixed(1)}%)
                                                                            </span>
                                                                        )}
                                                                    </span>
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-2 text-right">
                                                                <div className="flex items-center justify-end gap-1">
                                                                    {!isSold && (
                                                                        <button
                                                                            onClick={() => handleOpenSellDialog(tx)}
                                                                            className="rounded-lg bg-emerald-600/20 px-3 py-1.5 text-[10px] font-bold text-emerald-400 hover:bg-emerald-600/40 transition-colors"
                                                                        >
                                                                            BÁN
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

                                    <div className="md:hidden divide-y divide-slate-800/30">
                                        {txs.map((tx: Transaction) => {
                                            const isSold = tx.status === "SOLD";
                                            let p = 0;
                                            let pPerc = 0;
                                            if (isSold) {
                                                p = (tx.sellPrice! - tx.price) * tx.quantity;
                                                pPerc = ((tx.sellPrice! - tx.price) / tx.price) * 100;
                                            } else if (currentPriceValue > 0) {
                                                p = (currentPriceValue - tx.price) * tx.quantity;
                                                pPerc = ((currentPriceValue - tx.price) / tx.price) * 100;
                                            }

                                            return (
                                                <div key={tx.id} className={`px-4 py-3 flex flex-col gap-2 ${isSold ? "bg-slate-900/60 opacity-60" : ""}`}>
                                                    <div className="flex items-center justify-between text-[11px] font-bold">
                                                        <span className="text-slate-500 uppercase">{new Date(tx.date).toLocaleDateString("vi-VN")}</span>
                                                        {isSold ? (
                                                            <span className="text-emerald-500 uppercase">ĐÃ BÁN {tx.sellDate}</span>
                                                        ) : (
                                                            <span className="text-cyan-600 uppercase tracking-widest">ĐANG GIỮ</span>
                                                        )}
                                                    </div>

                                                    <div className="flex items-center justify-between">
                                                        <div className="flex flex-col">
                                                            <span className="text-[10px] text-slate-600 uppercase font-bold">Mua {tx.quantity}</span>
                                                            <span className="text-sm font-medium">{formatMoney(tx.price)}</span>
                                                        </div>

                                                        {isSold && (
                                                            <div className="flex flex-col items-center">
                                                                <span className="text-[10px] text-emerald-700 uppercase font-bold text-center">Bán</span>
                                                                <span className="text-sm font-bold text-emerald-400">{formatMoney(tx.sellPrice!)}</span>
                                                            </div>
                                                        )}

                                                        <div className="flex flex-col items-end">
                                                            <span className="text-[10px] text-slate-600 uppercase font-bold">Lãi / Lỗ</span>
                                                            <div className={`text-sm font-bold ${p >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                                                {p !== 0 ? (p > 0 ? "+" : "") + formatMoney(p) : "-"}
                                                                <span className="ml-1 text-[10px] opacity-60">({pPerc.toFixed(1)}%)</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center justify-end gap-2 mt-1">
                                                        {!isSold && (
                                                            <button
                                                                onClick={() => handleOpenSellDialog(tx)}
                                                                className="flex-1 rounded-xl bg-emerald-600/20 py-2.5 text-xs font-bold text-emerald-400 active:bg-emerald-600/40"
                                                            >
                                                                BÁN GIAO DỊCH NÀY
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => handleDelete(tx.id)}
                                                            className={`p-2.5 rounded-xl border border-slate-800 text-slate-600 hover:text-red-500 active:bg-red-500/10 ${!isSold ? "" : "flex-1"}`}
                                                        >
                                                            <svg className="mx-auto w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                        })
                    )}
                </div>
            </div >

            {/* Sell Dialog Modal */}
            {
                sellTx && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setSellTx(null)}></div>
                        <div className="relative w-full max-w-sm rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
                            <h3 className="mb-1 text-xl font-bold text-white">Xác nhận bán</h3>
                            <p className="mb-6 text-sm text-slate-400">
                                Bán <span className="text-white font-bold">{sellTx.quantity}</span> cổ phiếu <span className="text-white font-bold">{sellTx.symbol}</span> mua ngày {new Date(sellTx.date).toLocaleDateString("vi-VN")}?
                            </p>

                            <div className="space-y-4">
                                <div>
                                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Giá bán thực tế</label>
                                    <input
                                        autoFocus
                                        value={sellPriceInput}
                                        onChange={(e: ChangeEvent<HTMLInputElement>) => setSellPriceInput(formatInputNumber(e.target.value))}
                                        className="w-full rounded-2xl border border-slate-700 bg-slate-800/50 px-4 py-3 text-lg font-bold outline-none focus:border-emerald-500"
                                        placeholder="0"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3 pt-2">
                                    <button
                                        onClick={() => setSellTx(null)}
                                        className="rounded-2xl border border-slate-700 py-3 font-bold text-slate-400 transition hover:bg-slate-800"
                                    >
                                        Hủy
                                    </button>
                                    <button
                                        onClick={handleConfirmSell}
                                        disabled={isLoading}
                                        className="rounded-2xl bg-emerald-600 py-3 font-bold text-white transition hover:bg-emerald-500 disabled:opacity-50"
                                    >
                                        {isLoading ? "Đang xử lý..." : "Xác nhận Bán"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Symbol Analysis Popup */}
            {
                analysisSymbol && (
                    <div className="fixed inset-0 z-[105] flex items-center justify-center p-2 sm:p-4">
                        <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm" onClick={() => setAnalysisSymbol(null)}></div>
                        <div className="relative w-full max-w-6xl rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden">
                            <div className="flex items-center justify-between gap-2 border-b border-slate-800 px-3 py-2 sm:px-4 sm:py-3">
                                <p className="text-xs sm:text-sm font-bold text-white">
                                    Chi tiết mã: <span className="text-cyan-300">{analysisSymbol}</span>
                                </p>
                                <div className="flex items-center gap-2">
                                    <a
                                        href={analysisUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="rounded-lg border border-cyan-700/40 bg-cyan-500/10 px-3 py-1.5 text-[11px] font-bold text-cyan-300 hover:bg-cyan-500/20"
                                    >
                                        Mở tab mới
                                    </a>
                                    <button
                                        type="button"
                                        onClick={() => setAnalysisSymbol(null)}
                                        className="rounded-lg border border-slate-700 px-3 py-1.5 text-[11px] font-bold text-slate-300 hover:bg-slate-800"
                                    >
                                        Đóng
                                    </button>
                                </div>
                            </div>
                            <iframe
                                src={analysisUrl}
                                title={`Fireant ${analysisSymbol}`}
                                className="h-[78vh] w-full bg-slate-950"
                                referrerPolicy="strict-origin-when-cross-origin"
                            />
                        </div>
                    </div>
                )
            }

            {/* Toast Notification */}
            {
                notification && (
                    <div className="fixed bottom-8 left-1/2 z-[110] -translate-x-1/2 animate-bounce">
                        <div className={`flex items-center gap-3 rounded-full border px-6 py-3 shadow-2xl backdrop-blur-xl ${notification.type === "success"
                            ? "border-emerald-500/50 bg-emerald-950/80 text-emerald-300"
                            : "border-cyan-500/50 bg-cyan-950/80 text-cyan-300"
                            }`}>
                            <span className="text-xs font-bold uppercase tracking-widest leading-none">{notification.msg}</span>
                        </div>
                    </div>
                )
            }
        </main >
    );
}
