"use client";

import { useState, useMemo, useEffect, FormEvent } from "react";
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

const formatMoney = (value: number) => {
    return Math.round(value).toLocaleString("vi-VN");
};

function SummaryCard({ totals }: { totals: { percent: number, totalInvested: number, totalCurrentValue: number, profit: number } }) {
    return (
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
    );
}

interface TransactionFormProps {
    symbol: string;
    setSymbol: (val: string) => void;
    date: string;
    setDate: (val: string) => void;
    price: string;
    setPrice: (val: string) => void;
    quantity: string;
    setQuantity: (val: string) => void;
    onAdd: (e: React.FormEvent) => void;
    isLoading: boolean;
    addError: string;
    formatInputNumber: (val: string) => string;
}

function TransactionForm({
    symbol, setSymbol, date, setDate, price, setPrice, quantity, setQuantity, onAdd, isLoading, addError, formatInputNumber
}: TransactionFormProps) {
    return (
        <section className="mb-8 rounded-2xl border border-slate-800 bg-slate-900/20 p-4">
            <form onSubmit={onAdd} className="flex flex-wrap gap-2">
                <input
                    placeholder="Mã CP"
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                    className="flex-1 min-w-[70px] rounded-xl border border-slate-700 bg-slate-800/30 px-3 py-2 text-sm outline-none focus:border-cyan-500"
                    required
                />
                <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="flex-[1.5] min-w-[110px] rounded-xl border border-slate-700 bg-slate-800/30 px-3 py-2 text-sm outline-none focus:border-cyan-500"
                    required
                />
                <input
                    placeholder="Giá mua"
                    value={price}
                    onChange={(e) => setPrice(formatInputNumber(e.target.value))}
                    className="flex-1 min-w-[90px] rounded-xl border border-slate-700 bg-slate-800/30 px-3 py-2 text-sm outline-none focus:border-cyan-500"
                    required
                />
                <input
                    placeholder="SL"
                    value={quantity}
                    onChange={(e) => setQuantity(formatInputNumber(e.target.value))}
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
    );
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

    useEffect(() => {
        const savedCode = localStorage.getItem("stock_access_code");
        if (savedCode) {
            setAccessCode(savedCode);
            setIsLoggedIn(true);
            loadTransactions(savedCode, true);
        }
        setIsInitialized(true);
    }, []);

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

    const fetchRealtimePrices = async (symbols: string[]) => {
        if (symbols.length === 0) return;
        setIsRefreshingPrices(true);
        const uniqueSymbols = Array.from(new Set(symbols));

        // Start all fetches concurrently
        await Promise.allSettled(
            uniqueSymbols.map(async (symbol) => {
                try {
                    const res = await fetch(`/api/stocks/price?symbol=${symbol}`);
                    const data = await res.json();
                    if (data.ok) {
                        // Update state IMMEDIATELY for this specific symbol
                        setCurrentPrices(prev => ({
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
        showToast("Cập nhật giá mới nhất thành công", "info");
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
                setTransactions(transactions.filter((tx) => tx.id !== id));
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
                setTransactions(transactions.map(tx =>
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

        transactions.forEach((tx) => {
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
        transactions.forEach((tx) => {
            if (!groups[tx.symbol]) groups[tx.symbol] = [];
            groups[tx.symbol].push(tx);
        });
        Object.keys(groups).forEach((symbol) => {
            groups[symbol].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
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
                            onChange={(e) => setAccessCode(e.target.value)}
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
                            onClick={() => fetchRealtimePrices(transactions.filter(t => t.status === "HOLD").map(t => t.symbol))}
                            disabled={isRefreshingPrices || transactions.filter(t => t.status === "HOLD").length === 0}
                            className="rounded-xl border border-emerald-900/30 bg-emerald-950/20 px-3 py-2 text-[10px] md:text-xs font-medium text-emerald-400 transition hover:bg-emerald-900/30 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            {isRefreshingPrices ? "Đang cập nhật..." : "Làm mới giá"}
                        </button>
                        <button
                            onClick={handleBackToPortal}
                            className="ml-2 text-xs text-slate-500 hover:text-cyan-400"
                        >
                            ← Portal
                        </button>
                    </div>
                </header>

                {/* Tổng quan - Single Card */}
                <SummaryCard totals={totals} />

                {/* Form thêm nhanh */}
                <TransactionForm
                    symbol={symbolInput}
                    setSymbol={setSymbolInput}
                    date={dateInput}
                    setDate={setDateInput}
                    price={priceInput}
                    setPrice={setPriceInput}
                    quantity={quantityInput}
                    setQuantity={setQuantityInput}
                    onAdd={handleAdd}
                    isLoading={isLoading}
                    addError={addError}
                    formatInputNumber={formatInputNumber}
                />

                {/* Danh sách Grouped */}
                <div className="space-y-4">
                    {Object.keys(groupedData).length === 0 ? (
                        <div className="py-20 text-center text-slate-500 border border-dashed border-slate-800 rounded-2xl text-sm">
                            Trống.
                        </div>
                    ) : (
                        Object.keys(groupedData).sort().map((symbol) => (
                            <StockGroup
                                key={symbol}
                                symbol={symbol}
                                transactions={groupedData[symbol]!}
                                priceInfo={currentPrices[symbol]}
                                openAnalysisPopup={openAnalysisPopup}
                                handleDelete={handleDelete}
                                handleOpenSellDialog={handleOpenSellDialog}
                            />
                        ))
                    )}
                </div>
            </div>

            {/* Modal Dialogs */}
            <SellDialog
                sellTx={sellTx}
                sellPriceInput={sellPriceInput}
                setSellPriceInput={setSellPriceInput}
                onClose={() => setSellTx(null)}
                onConfirm={handleConfirmSell}
                isLoading={isLoading}
                formatInputNumber={formatInputNumber}
            />

            <AnalysisPopup
                symbol={analysisSymbol}
                onClose={() => setAnalysisSymbol(null)}
            />

            {/* Toast Notification */}
            {notification && (
                <div className="fixed bottom-8 left-1/2 z-[110] -translate-x-1/2 animate-bounce">
                    <div className={`flex items-center gap-3 rounded-full border px-6 py-3 shadow-2xl backdrop-blur-xl ${notification.type === "success"
                        ? "border-emerald-500/50 bg-emerald-950/80 text-emerald-300"
                        : "border-cyan-500/50 bg-cyan-950/80 text-cyan-300"
                        }`}>
                        <span className="text-xs font-bold uppercase tracking-widest leading-none">{notification.msg}</span>
                    </div>
                </div>
            )}
        </main>
    );
}
