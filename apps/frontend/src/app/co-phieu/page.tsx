"use client";

import { useState, useEffect, useMemo } from "react";
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

    // Form states
    const [symbolInput, setSymbolInput] = useState("");
    const [dateInput, setDateInput] = useState(new Date().toISOString().split("T")[0]);
    const [priceInput, setPriceInput] = useState("");
    const [quantityInput, setQuantityInput] = useState("");

    const formatMoney = (value: number) => {
        return Math.round(value).toLocaleString("vi-VN");
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
                // Automatically fetch prices for loaded symbols
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
        const price = parseFloat(priceInput.replace(/,/g, ""));
        const quantity = parseInt(quantityInput.replace(/,/g, ""));

        if (!symbolInput || !dateInput || isNaN(price) || isNaN(quantity)) {
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
                    price,
                    quantity,
                }),
            });
            const data = await res.json();
            if (data.ok) {
                setTransactions([{ id: data.data?.id || Date.now(), symbol, date: dateInput, price, quantity }, ...transactions]);
                setSymbolInput("");
                setPriceInput("");
                setQuantityInput("");
                // Fetch price for new symbol if not exist
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
        if (!confirm("Xác nhận đã bán giao dịch này?")) return;
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
                alert(data.message || "Bán thất bại");
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
                totalCurrentValue += tx.price * tx.quantity; // Fallback to buy price if no current price
            }
        });
        const profit = totalCurrentValue - totalInvested;
        const percent = totalInvested > 0 ? (profit / totalInvested) * 100 : 0;
        return { totalInvested, totalCurrentValue, profit, percent };
    }, [transactions, currentPrices]);

    if (!isLoggedIn) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-slate-950 p-4 font-sans text-slate-100">
                <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/50 p-8 shadow-2xl backdrop-blur-xl">
                    <div className="mb-8 text-center">
                        <h1 className="text-3xl font-bold tracking-tight text-white">Quản lý Cổ phiếu</h1>
                        <p className="mt-2 text-slate-400">Nhập mã truy cập để tiếp tục</p>
                    </div>
                    <form onSubmit={handleLogin} className="space-y-6">
                        <div>
                            <input
                                type="password"
                                value={accessCode}
                                onChange={(e) => setAccessCode(e.target.value)}
                                placeholder="Mã truy cập"
                                className="w-full rounded-2xl border border-slate-700 bg-slate-800/50 px-5 py-4 text-center text-lg outline-none transition focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20"
                                required
                            />
                        </div>
                        {loginError && <p className="text-center text-sm text-red-400">{loginError}</p>}
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full rounded-2xl bg-cyan-600 py-4 font-bold text-white transition hover:bg-cyan-500 active:scale-95 disabled:opacity-50"
                        >
                            {isLoading ? "Đang xác thực..." : "Đăng nhập"}
                        </button>
                    </form>
                    <div className="mt-8 text-center">
                        <Link href="/" className="text-sm text-slate-500 hover:text-cyan-400">
                            ← Quay lại Portal
                        </Link>
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-slate-950 p-4 font-sans text-slate-100 md:p-8">
            <div className="mx-auto max-w-6xl">
                <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold md:text-3xl">Giao dịch đang HOLD</h1>
                        <p className="text-sm text-slate-400">Dữ liệu được đồng bộ realtime với Vietstock</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => loadTransactions(accessCode)}
                            className="rounded-xl border border-slate-700 bg-slate-900/50 px-4 py-2 text-sm font-medium transition hover:bg-slate-800"
                        >
                            Làm mới
                        </button>
                        <Link href="/" className="text-xs text-slate-500 hover:text-cyan-400">
                            ← Quay lại Portal
                        </Link>
                    </div>
                </header>

                {/* Thống kê nhanh */}
                <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-5 backdrop-blur-sm">
                        <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Tổng đầu tư</p>
                        <p className="mt-1 text-xl font-bold">{formatMoney(totals.totalInvested)}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-5 backdrop-blur-sm">
                        <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Giá trị hiện tại</p>
                        <p className="mt-1 text-xl font-bold">{formatMoney(totals.totalCurrentValue)}</p>
                    </div>
                    <div className={`rounded-2xl border border-slate-800 bg-slate-900/30 p-5 backdrop-blur-sm ${totals.profit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Tổng Lãi/Lỗ</p>
                        <p className="mt-1 text-xl font-bold">{formatMoney(totals.profit)}</p>
                    </div>
                    <div className={`rounded-2xl border border-slate-800 bg-slate-900/30 p-5 backdrop-blur-sm ${totals.percent >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Tỉ lệ</p>
                        <p className="mt-1 text-xl font-bold">{totals.percent.toFixed(2)}%</p>
                    </div>
                </div>

                {/* Form thêm mới */}
                <section className="mb-8 rounded-3xl border border-slate-800 bg-slate-900/40 p-6 backdrop-blur-md">
                    <h2 className="mb-4 text-lg font-semibold">Thêm lệnh mua</h2>
                    <form onSubmit={handleAdd} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                        <input
                            placeholder="Mã CP (VD: FPT)"
                            value={symbolInput}
                            onChange={(e) => setSymbolInput(e.target.value.toUpperCase())}
                            className="rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3 outline-none focus:border-cyan-500/50"
                            required
                        />
                        <input
                            type="date"
                            value={dateInput}
                            onChange={(e) => setDateInput(e.target.value)}
                            className="rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3 outline-none focus:border-cyan-500/50"
                            required
                        />
                        <input
                            placeholder="Giá mua"
                            value={priceInput}
                            onChange={(e) => setPriceInput(e.target.value)}
                            className="rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3 outline-none focus:border-cyan-500/50"
                            required
                        />
                        <input
                            placeholder="Số lượng"
                            value={quantityInput}
                            onChange={(e) => setQuantityInput(e.target.value)}
                            className="rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3 outline-none focus:border-cyan-500/50"
                            required
                        />
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="rounded-xl bg-slate-100 px-6 py-3 font-bold text-slate-950 transition hover:bg-white active:scale-95 disabled:opacity-50"
                        >
                            Thêm
                        </button>
                    </form>
                    {addError && <p className="mt-3 text-sm text-red-400">{addError}</p>}
                </section>

                {/* Danh sách */}
                <div className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/40 backdrop-blur-md">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm border-collapse">
                            <thead>
                                <tr className="border-b border-slate-800 bg-slate-800/30">
                                    <th className="px-6 py-4 font-semibold text-slate-300">Mã CP</th>
                                    <th className="px-6 py-4 font-semibold text-slate-300">Ngày mua</th>
                                    <th className="px-6 py-4 font-semibold text-slate-300">Giá mua</th>
                                    <th className="px-6 py-4 font-semibold text-slate-300">Số lượng</th>
                                    <th className="px-6 py-4 font-semibold text-slate-300">Giá hiện tại</th>
                                    <th className="px-6 py-4 font-semibold text-slate-300">Lãi/Lỗ</th>
                                    <th className="px-6 py-4 font-semibold text-slate-300 text-right">Hành động</th>
                                </tr>
                            </thead>
                            <tbody>
                                {transactions.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-10 text-center text-slate-500">
                                            Chưa có giao dịch nào được lưu.
                                        </td>
                                    </tr>
                                ) : (
                                    transactions.map((tx) => {
                                        const currentPrice = currentPrices[tx.symbol] || 0;
                                        const profit = currentPrice > 0 ? (currentPrice - tx.price) * tx.quantity : 0;
                                        const percent = currentPrice > 0 ? ((currentPrice - tx.price) / tx.price) * 100 : 0;
                                        const isProfit = profit >= 0;

                                        return (
                                            <tr key={tx.id} className="border-b border-slate-800/50 hover:bg-slate-800/20 transition">
                                                <td className="px-6 py-4 font-bold text-white">{tx.symbol}</td>
                                                <td className="px-6 py-4 text-slate-400">{new Date(tx.date).toLocaleDateString("vi-VN")}</td>
                                                <td className="px-6 py-4">{formatMoney(tx.price)}</td>
                                                <td className="px-6 py-4 font-medium">{formatMoney(tx.quantity)}</td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <span className={currentPrice > 0 ? "text-cyan-300" : "text-slate-500"}>
                                                            {currentPrice > 0 ? formatMoney(currentPrice) : "Đang tải..."}
                                                        </span>
                                                        {isPricingLoading && <span className="h-2 w-2 animate-ping rounded-full bg-cyan-500"></span>}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {currentPrice > 0 ? (
                                                        <div className={isProfit ? "text-emerald-400" : "text-red-400"}>
                                                            <p className="font-bold">{formatMoney(profit)}</p>
                                                            <p className="text-xs opacity-80">{percent.toFixed(2)}%</p>
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-500">-</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <button
                                                        onClick={() => handleSell(tx.id)}
                                                        className="rounded-lg bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-500 border border-amber-500/20 hover:bg-amber-500 hover:text-white transition"
                                                    >
                                                        Đánh dấu đã bán
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Mobile Cards (Visible only on small screens) */}
                <div className="mt-4 space-y-4 md:hidden">
                    {transactions.map((tx) => {
                        const currentPrice = currentPrices[tx.symbol] || 0;
                        const profit = currentPrice > 0 ? (currentPrice - tx.price) * tx.quantity : 0;
                        const percent = currentPrice > 0 ? ((currentPrice - tx.price) / tx.price) * 100 : 0;
                        const isProfit = profit >= 0;

                        return (
                            <div key={tx.id} className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
                                <div className="mb-4 flex items-center justify-between">
                                    <div>
                                        <h3 className="text-xl font-bold">{tx.symbol}</h3>
                                        <p className="text-xs text-slate-500">{new Date(tx.date).toLocaleDateString("vi-VN")}</p>
                                    </div>
                                    <button
                                        onClick={() => handleSell(tx.id)}
                                        className="rounded-lg bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-500 border border-amber-500/20"
                                    >
                                        Đã bán
                                    </button>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="rounded-xl bg-slate-800/30 p-3">
                                        <p className="text-[10px] uppercase tracking-wider text-slate-500">Giá mua</p>
                                        <p className="font-bold text-slate-200">{formatMoney(tx.price)}</p>
                                    </div>
                                    <div className="rounded-xl bg-slate-800/30 p-3">
                                        <p className="text-[10px] uppercase tracking-wider text-slate-500">Số lượng</p>
                                        <p className="font-bold text-slate-200">{formatMoney(tx.quantity)}</p>
                                    </div>
                                    <div className="rounded-xl bg-slate-800/30 p-3">
                                        <p className="text-[10px] uppercase tracking-wider text-slate-500">Giá hiện tại</p>
                                        <p className="font-bold text-cyan-400">{currentPrice > 0 ? formatMoney(currentPrice) : "..."}</p>
                                    </div>
                                    <div className={`rounded-xl bg-slate-800/30 p-3 ${isProfit ? "text-emerald-400" : "text-red-400"}`}>
                                        <p className="text-[10px] uppercase tracking-wider text-slate-500">Lãi/Lỗ</p>
                                        <p className="font-bold">{currentPrice > 0 ? formatMoney(profit) : "-"}</p>
                                        <p className="text-[10px]">{currentPrice > 0 ? `${percent.toFixed(2)}%` : ""}</p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </main>
    );
}
