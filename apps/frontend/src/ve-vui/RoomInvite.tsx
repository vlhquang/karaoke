"use client";

import { useEffect, useId, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Copy, Download, QrCode, X } from "lucide-react";

export function RoomInvite({ code, open, onClose }: { code: string; open: boolean; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const linkRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const linkId = useId();
  const [inviteUrl, setInviteUrl] = useState("");
  const [feedback, setFeedback] = useState("");
  const [copyingQR, setCopyingQR] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!open) { if (dialog.open) dialog.close(); return; }
    setInviteUrl(`${window.location.origin}/ve-vui?phong=${code}`);
    setFeedback("");
    if (!dialog.open) dialog.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
      if (dialog.open) dialog.close();
    };
  }, [open, code]);

  const copyLink = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(inviteUrl);
      setFeedback("Đã sao chép liên kết. Dán vào tin nhắn để mời cả nhà nhé!");
    } catch {
      const input = linkRef.current;
      input?.focus();
      input?.select();
      try {
        if (input && document.execCommand("copy")) { setFeedback("Đã sao chép liên kết mời vào phòng."); return; }
      } catch { /* Leave the full invite link selected for manual copying. */ }
      setFeedback("Liên kết đã được chọn. Nhấn giữ hoặc dùng lệnh sao chép của thiết bị để lấy liên kết.");
    }
  };

  const copyQR = async () => {
    const canvas = canvasRef.current;
    if (!canvas || copyingQR) return;
    if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
      setFeedback("Thiết bị chưa hỗ trợ sao chép ảnh. Bấm “Tải mã QR” để lưu và gửi ảnh nhé.");
      return;
    }
    setCopyingQR(true);
    setFeedback("");
    try {
      // Start the clipboard write during the tap; encode the PNG asynchronously.
      const png = new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("PNG unavailable")), "image/png"));
      await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
      setFeedback("Đã sao chép ảnh QR. Dán vào tin nhắn để chia sẻ phòng nhé!");
    } catch {
      setFeedback("Chưa sao chép được ảnh QR. Bấm “Tải mã QR” để lưu và gửi ảnh nhé.");
    } finally { setCopyingQR(false); }
  };

  const downloadQR = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `ve-vui-phong-${code}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    setFeedback("Đã tải mã QR. Bạn có thể gửi ảnh cho mọi người.");
  };

  return <dialog ref={dialogRef} className="vv-share-dialog" aria-labelledby={titleId} onClose={onClose}>
    <div className="vv-share-heading"><div><h2 id={titleId}><QrCode size={22} />Mời cả nhà vào chơi</h2><p>Quét mã QR hoặc mở liên kết để vào phòng.</p></div><button type="button" className="vv-icon-btn" aria-label="Đóng cửa sổ chia sẻ" onClick={onClose}><X size={21} /></button></div>
    <div className="vv-share-qr">{open && inviteUrl && <QRCodeCanvas ref={canvasRef} value={inviteUrl} size={256} level="M" marginSize={4} title={`Mã QR vào phòng ${code}`} />}<span>Phòng <strong>{code}</strong></span></div>
    <label htmlFor={linkId}>Liên kết mời vào phòng</label>
    <div className="vv-share-link"><input ref={linkRef} id={linkId} value={inviteUrl} readOnly onFocus={event => event.currentTarget.select()} /><button type="button" className="vv-btn vv-primary" disabled={!inviteUrl} onClick={copyLink}><Copy size={17} />Sao chép link</button></div>
    <div className="vv-share-actions"><button type="button" className="vv-btn vv-secondary" disabled={!inviteUrl || copyingQR} onClick={copyQR}><Copy size={18} />{copyingQR ? "Đang sao chép..." : "Sao chép ảnh QR"}</button><button type="button" className="vv-btn vv-secondary" disabled={!inviteUrl} onClick={downloadQR}><Download size={18} />Tải mã QR</button></div>
    <p className="vv-share-feedback" role="status">{feedback}</p>
  </dialog>;
}
