"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

interface Transaction {
    id: number;
    symbol: string;
    date: string;
    price: number;
    quantity: number;
}

export default function StockPage() {
    const [accessCode, setAccessCode] = useState("");
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [currentPrices, setCurrentPrices] = useState<Record<string, number>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [loginError, setLoginError] = useState("");
    const [addError, setAddError] = useState("");
    const [isPricingLoading, setIsPricingLoading] = useState(false);
    const [notification, setNotification] = useState<{ msg: string; type: "success" | "info" } | null>(null);

    // Form states
    const [symbolInput, setSymbolInput] = useState("");
    const [dateInput, setDateInput] = useState(new Date().toISOString().split("T")[0]);
    const [priceInput, setPriceInput] = useState("");
    const [quantityInput, setQuantityInput] = useState("");

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
        setIsPricingLoading(true);
        const uniqueSymbols = Array.from(new Set(symbols));
        const priceMap: Record<string, number> = { ...currentPrices };

        await Promise.all(
            uniqueSymbols.map(async (symbol) => {
                try {
                    const res = await fetch(`/api/stocks/price?symbol=${symbol}`);
                    const data = await res.json();
                    if (data.ok) {
                        priceMap[symbol] = data.price;
                    }
                } catch (err) {
                    console.error(`Failed to fetch price for ${symbol}`, err);
                }
            })
        );

        setCurrentPrices(priceMap);
        setIsPricingLoading(false);
        showToast("Cập nhật giá mới nhất thành công", "info");
    };

    const loadTransactions = async (code: string) => {
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
                showToast("Tải dữ liệu từ Google Sheets xong");
                const symbols = list.map((tx: Transaction) => tx.symbol);
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
        }
    };

    const handleLogin = async (e: React.FormEvent) => {
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
                loadTransactions(accessCode);
            } else {
                setLoginError(data.message || "Mã truy cập không hợp lệ");
            }
        } catch (err) {
            setLoginError("Lỗi kết nối server");
        } finally {
            setIsLoading(false);
        }
    };

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        setAddError("");
        const priceValue = parseFloat(priceInput.replace(/,/g, ""));
        const quantityValue = parseInt(quantityInput.replace(/,/g, ""));

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
                setTransactions([{ id: data.data?.id || Date.now(), symbol, date: dateInput, price: priceValue, quantity: quantityValue }, ...transactions]);
                setSymbolInput("");
                setPriceInput("");
                setQuantityInput("");
                if (!currentPrices[symbol]) {
                    fetchRealtimePrices([symbol]);
                }
            } else {
                setAddError(data.message || "Thêm giao dịch thất bại");
            }
        } catch (err) {
            setAddError("Lỗi kết nối server");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSell = async (id: number) => {
        if (!confirm("Xác nhận gỡ giao dịch này?")) return;
        setIsLoading(true);
        try {
            const res = await fetch("/api/stocks", {
                method: "POST",
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({ action: "sell", accessCode, id }),
            });
            const data = await res.json();
            if (data.ok) {
                setTransactions(transactions.filter((tx) => tx.id !== id));
            } else {
                alert(data.message || "Gỡ thất bại");
            }
        } catch (err) {
            alert("Lỗi kết nối server");
        } finally {
            setIsLoading(false);
        }
    };

    const totals = useMemo(() => {
        let totalInvested = 0;
        let totalCurrentValue = 0;
        transactions.forEach((tx) => {
            totalInvested += tx.price * tx.quantity;
            const currentPrice = currentPrices[tx.symbol] || 0;
            if (currentPrice > 0) {
                totalCurrentValue += currentPrice * tx.quantity;
            } else {
                totalCurrentValue += tx.price * tx.quantity;
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
                        <Link href="/" className="text-sm text-slate-500 hover:text-cyan-400">← Quay lại Portal</Link>
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
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => loadTransactions(accessCode)}
                            className="rounded-xl border border-slate-700 bg-slate-900/50 px-3 py-2 text-xs font-medium transition hover:bg-slate-800"
                        >
                            Làm mới
                        </button>
                        <Link href="/" className="text-xs text-slate-500 hover:text-cyan-400">← Portal</Link>
                    </div>
                </header>

                {/* Tổng quan - Single Card */}
                <section className="mb-6">
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 backdrop-blur-md">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
                            <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Danh mục tổng quát</h2>
                            <div className={`text-sm font-black ${totals.percent >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                {totals.percent >= 0 ? "+" : ""}{totals.percent.toFixed(2)}%
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-[9px] uppercase tracking-wider text-slate-500">Đầu tư</p>
                                <p className="text-lg font-bold">{formatMoney(totals.totalInvested)}</p>
                            </div>
                            <div>
                                <p className="text-[9px] uppercase tracking-wider text-slate-500">Hiện tại</p>
                                <p className="text-lg font-bold text-cyan-400">{formatMoney(totals.totalCurrentValue)}</p>
                            </div>
                            <div className="col-span-2 rounded-xl bg-slate-800/30 p-3 mt-1 flex items-center justify-between">
                                <p className="text-[9px] uppercase tracking-wider text-slate-500">Lãi / Lỗ</p>
                                <p className={`text-xl font-black ${totals.profit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
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
                            onChange={(e) => setSymbolInput(e.target.value.toUpperCase())}
                            className="flex-1 min-w-[70px] rounded-xl border border-slate-700 bg-slate-800/30 px-3 py-2 text-xs outline-none focus:border-cyan-500"
                            required
                        />
                        <input
                            type="date"
                            value={dateInput}
                            onChange={(e) => setDateInput(e.target.value)}
                            className="flex-[1.5] min-w-[110px] rounded-xl border border-slate-700 bg-slate-800/30 px-3 py-2 text-xs outline-none focus:border-cyan-500"
                            required
                        />
                        <input
                            placeholder="Giá mua"
                            value={priceInput}
                            onChange={(e) => setPriceInput(formatInputNumber(e.target.value))}
                            className="flex-1 min-w-[90px] rounded-xl border border-slate-700 bg-slate-800/30 px-3 py-2 text-xs outline-none focus:border-cyan-500"
                            required
                        />
                        <input
                            placeholder="SL"
                            value={quantityInput}
                            onChange={(e) => setQuantityInput(formatInputNumber(e.target.value))}
                            className="flex-[0.5] min-w-[60px] rounded-xl border border-slate-700 bg-slate-800/30 px-3 py-2 text-xs outline-none focus:border-cyan-500"
                            required
                        />
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-bold text-slate-950 transition hover:bg-white disabled:opacity-50"
                        >
                            Thêm
                        </button>
                    </form>
                    {addError && <p className="mt-2 text-[9px] text-red-400 text-center">{addError}</p>}
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
                            const currentPrice = currentPrices[symbol] || 0;
                            let gInv = 0, gQty = 0;
                            txs.forEach(t => { gInv += t.price * t.quantity; gQty += t.quantity; });
                            const gProfit = currentPrice > 0 ? (currentPrice * gQty) - gInv : 0;
                            const gPerc = gInv > 0 ? (gProfit / gInv) * 100 : 0;

                            return (
                                <div key={symbol} className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden">
                                    <div className="bg-slate-800/40 px-4 py-3 flex items-center justify-between border-b border-slate-800">
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg font-black">{symbol}</span>
                                            <span className="text-[10px] text-slate-500 font-mono">({gQty})</span>
                                        </div>
                                        <div className="text-right">
                                            <p className={`text-xs font-bold ${currentPrice > 0 ? "text-cyan-400" : "text-slate-600"}`}>
                                                {currentPrice > 0 ? formatMoney(currentPrice) : "..."}
                                            </p>
                                            <p className={`text-[10px] font-bold ${gProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                                {gProfit !== 0 ? (gProfit > 0 ? "+" : "") + formatMoney(gProfit) : ""}
                                                {gProfit !== 0 && <span className="ml-1 opacity-70">{gPerc.toFixed(1)}%</span>}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Desktop Table */}
                                    <div className="hidden md:block overflow-x-auto">
                                        <table className="w-full text-[11px] text-left">
                                            <tbody className="divide-y divide-slate-800/30">
                                                {txs.map((tx) => {
                                                    const p = currentPrice > 0 ? (currentPrice - tx.price) * tx.quantity : 0;
                                                    return (
                                                        <tr key={tx.id} className="hover:bg-slate-800/20">
                                                            <td className="px-4 py-2 text-slate-500">{new Date(tx.date).toLocaleDateString("vi-VN")}</td>
                                                            <td className="px-4 py-2 text-right">Giá: <span className="text-slate-200">{formatMoney(tx.price)}</span></td>
                                                            <td className="px-4 py-2 text-right">SL: <span className="text-slate-200">{tx.quantity}</span></td>
                                                            <td className={`px-4 py-2 text-right font-bold ${p >= 0 ? "text-emerald-500/60" : "text-red-500/60"}`}>
                                                                {p !== 0 ? (p > 0 ? "+" : "") + formatMoney(p) : "-"}
                                                                {p !== 0 && tx.price > 0 && (
                                                                    <span className="ml-1 text-[9px] opacity-60">
                                                                        ({(((currentPrice - tx.price) / tx.price) * 100).toFixed(1)}%)
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-2 text-right">
                                                                <button
                                                                    onClick={() => handleSell(tx.id)}
                                                                    className="p-2 text-slate-600 hover:text-red-500 transition-colors"
                                                                    title="Gỡ giao dịch"
                                                                >
                                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                                    </svg>
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Mobile Compact View (No scroll) */}
                                    <div className="md:hidden divide-y divide-slate-800/30">
                                        {txs.map((tx) => {
                                            const p = currentPrice > 0 ? (currentPrice - tx.price) * tx.quantity : 0;
                                            return (
                                                <div key={tx.id} className="px-4 py-2 flex items-center justify-between text-[11px]">
                                                    <div className="flex-1 opacity-60">{new Date(tx.date).toLocaleDateString("vi-VN", { day: '2-digit', month: '2-digit' })}</div>
                                                    <div className="flex-[1.5] text-center">
                                                        <span className="opacity-40">Giá:</span> {formatMoney(tx.price)}
                                                        <span className="ml-1 text-slate-500">({tx.quantity})</span>
                                                    </div>
                                                    <div className={`flex-[1.5] text-right font-bold ${p >= 0 ? "text-emerald-500/80" : "text-red-500/80"}`}>
                                                        {p !== 0 ? (p > 0 ? "+" : "") + formatMoney(p) : "-"}
                                                        {p !== 0 && tx.price > 0 && (
                                                            <div className="text-[9px] font-normal opacity-60 leading-none">
                                                                {(((currentPrice - tx.price) / tx.price) * 100).toFixed(1)}%
                                                            </div>
                                                        )}
                                                    </div>
                                                    <button
                                                        onClick={() => handleSell(tx.id)}
                                                        className="ml-2 p-3 text-slate-700 active:text-red-500"
                                                    >
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Toast Notification */}
            {notification && (
                <div className="fixed bottom-8 left-1/2 z-50 -translate-x-1/2 animate-bounce">
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
