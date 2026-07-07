"use client";

interface LotoWinnerPopupProps {
    open: boolean;
    winnerName: string;
    winnerBankingInfo?: { bankId: string; accountNo: string };
    betAmount: number;
    onClose: () => void;
}

export function LotoWinnerPopup({ open, winnerName, winnerBankingInfo, betAmount, onClose }: LotoWinnerPopupProps) {
    if (!open || !winnerName) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/85 p-4">
            <div className="w-full max-w-md rounded-2xl border border-emerald-300/50 bg-slate-900 p-5 text-center shadow-[0_0_40px_rgba(52,211,153,0.25)]">
                <p className="text-2xl font-bold text-emerald-300">Chiến thắng!</p>
                <p className="mt-2 text-sm text-emerald-100">
                    <span className="font-semibold">{winnerName}</span> đã về nhất.
                </p>

                {winnerBankingInfo ? (
                    <div className="mt-4 flex flex-col items-center gap-2">
                        <p className="text-sm font-semibold text-cyan-100">Quét QR để chuyển khoản thưởng</p>
                        {!!betAmount && <p className="text-sm text-cyan-200">{(betAmount || 0).toLocaleString("en-US")} VND</p>}
                        <img
                            src={`https://img.vietqr.io/image/${winnerBankingInfo.bankId}-${winnerBankingInfo.accountNo}-compact2.png?amount=${betAmount || 0}&addInfo=Thuong Lo to`}
                            alt="QR nhận thưởng"
                            className="h-72 w-72 max-w-full rounded-xl bg-white p-2 object-contain"
                        />
                    </div>
                ) : (
                    <p className="mt-4 text-sm text-slate-300">Người thắng chưa cung cấp Tài khoản nhận thưởng.</p>
                )}

                <button
                    onClick={onClose}
                    className="mt-5 w-full rounded-lg bg-emerald-500 px-4 py-2 font-semibold text-slate-900 hover:bg-emerald-400"
                >
                    Đóng thông báo
                </button>
            </div>
        </div>
    );
}

