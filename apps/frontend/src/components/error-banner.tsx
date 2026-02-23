"use client";

interface Props {
  message: string;
  onClose: () => void;
}

export const ErrorBanner = ({ message, onClose }: Props) => {
  if (!message) {
    return null;
  }

  return (
    <div className="rounded-xl border border-red-400/60 bg-red-900/30 p-3 text-sm text-red-100">
      <div className="flex items-center justify-between gap-2">
        <p>{message}</p>
        <button className="text-xs text-red-200" onClick={onClose}>
          Dong
        </button>
      </div>
    </div>
  );
};
