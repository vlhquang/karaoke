"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Platform = "sora2" | "seedance" | "kling" | "veo3";
type PromptProvider = "auto" | "openai" | "gemini";

const platformOptions: Array<{ id: Platform; name: string; note: string }> = [
  { id: "sora2", name: "Sora 2", note: "Text-to-video cinematic" },
  { id: "seedance", name: "Seedance", note: "Shot-based generation" },
  { id: "kling", name: "Kling", note: "Fast short-form generation" },
  { id: "veo3", name: "Veo3", note: "Prompt-driven scene video" }
];

export default function TaoVideoPage() {
  const [inputText, setInputText] = useState("");
  const [platform, setPlatform] = useState<Platform>("kling");
  const [promptProvider, setPromptProvider] = useState<PromptProvider>("auto");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<any>(null);
  const [apiInfo, setApiInfo] = useState<any>(null);
  const [apiInfoError, setApiInfoError] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/video/short", { method: "GET", cache: "no-store" });
        const raw = await res.text();
        const parsed = raw.trim() ? JSON.parse(raw) : null;
        if (!mounted) return;
        if (!res.ok || !parsed?.ok) {
          setApiInfoError(parsed?.message || `Không đọc được trạng thái API (${res.status}).`);
          return;
        }
        setApiInfo(parsed);
      } catch (e) {
        if (!mounted) return;
        setApiInfoError(e instanceof Error ? e.message : "Không đọc được trạng thái API.");
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const onGenerate = async () => {
    setError("");
    setResult(null);

    if (inputText.trim().length < 20) {
      setError("Vui lòng nhập nội dung ít nhất 20 ký tự.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/video/short", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: inputText.trim(),
          platform,
          promptProvider
        })
      });

      const raw = await res.text();
      let data: any = null;
      if (raw.trim()) {
        try {
          data = JSON.parse(raw);
        } catch {
          data = null;
        }
      }

      if (!data) {
        const shortRaw = raw.trim().slice(0, 220);
        setError(
          shortRaw
            ? `API trả về dữ liệu không hợp lệ (${res.status}). ${shortRaw}`
            : `API không trả dữ liệu (${res.status}).`
        );
        return;
      }

      if (!data?.ok) {
        const detailLines = [
          data?.message ? `Lỗi: ${String(data.message)}` : "Không thể tạo nội dung video.",
          data?.errorStep ? `Bước lỗi: ${String(data.errorStep)}` : "",
          data?.upstreamStatus ? `HTTP upstream: ${String(data.upstreamStatus)}` : "",
          data?.upstreamEndpoint ? `Đích kết nối: ${String(data.upstreamEndpoint)}` : "",
          data?.requestId ? `Request ID: ${String(data.requestId)}` : "",
          data?.details ? `Chi tiết: ${String(data.details).slice(0, 300)}` : ""
        ].filter(Boolean);
        setError(detailLines.join("\n"));
        return;
      }

      setResult(data);
    } catch (e) {
      setError(
        e instanceof Error
          ? `Lỗi gọi API: ${e.message}`
          : "Lỗi gọi API không xác định."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const copyText = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // no-op
    }
  };

  const generatedPrompt = String(result?.generatedPrompt ?? "");
  const videoUrl = String(result?.providerResult?.videoUrl ?? "");
  const downloadUrl = String(result?.providerResult?.downloadUrl ?? "");
  const stepLogs = Array.isArray(result?.logs) ? result.logs : [];

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-6 md:px-8 md:py-10">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-bold md:text-3xl">Tạo video Shorts bằng AI</h1>
        <Link
          href="/"
          className="rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-2 text-sm font-semibold text-slate-200 hover:border-cyan-300/50"
        >
          ← Về Portal
        </Link>
      </div>

      <section className="mb-4 rounded-2xl border border-emerald-600/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
        Đang dùng API key từ biến môi trường server (`.env`). Giao diện không còn nhập/lưu key phía client.
      </section>
      <section className="mb-4 rounded-2xl border border-slate-700 bg-slate-900/60 p-4 text-sm">
        <p className="mb-2 text-xs uppercase tracking-wider text-cyan-300">Trạng thái API kết nối</p>
        {apiInfoError ? (
          <p className="text-rose-400">{apiInfoError}</p>
        ) : !apiInfo ? (
          <p className="text-slate-300">Đang kiểm tra cấu hình API...</p>
        ) : (
          <div className="grid gap-1 text-slate-200">
            <p>
              Provider: <span className="font-semibold">{String(apiInfo.provider ?? "-")}</span>
            </p>
            <p>
              Prompt engine mặc định: <span className="font-semibold">{String(apiInfo.promptProvider ?? "-")}</span>
            </p>
            <p>
              ChatGPT Model: <span className="font-semibold">{String(apiInfo.openai?.model ?? "-")}</span>
            </p>
            <p>
              OpenAI Endpoint: <span className="font-semibold">{String(apiInfo.openai?.endpoint ?? "-")}</span>
            </p>
            <p>
              OpenAI key: <span className="font-semibold">{apiInfo.openai?.keyConfigured ? "Đã cấu hình" : "Chưa cấu hình"}</span>
            </p>
            <p>
              Gemini model: <span className="font-semibold">{String(apiInfo.gemini?.model ?? "-")}</span>
            </p>
            <p>
              Gemini key: <span className="font-semibold">{apiInfo.gemini?.keyConfigured ? "Đã cấu hình" : "Chưa cấu hình"}</span>
            </p>
            <p className="text-slate-400">Provider endpoint/key hiển thị trong JSON trạng thái.</p>
          </div>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
          <p className="mb-2 text-xs uppercase tracking-wider text-cyan-300">Input</p>
          <label className="mb-2 block text-sm font-semibold">Nội dung gốc</label>
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Nhập đoạn văn bản, ý tưởng hoặc câu chuyện bạn muốn làm video..."
            className="h-44 w-full rounded-xl border border-slate-700 bg-slate-950/70 p-3 text-sm outline-none focus:border-cyan-400"
          />

          <div className="mt-4 grid gap-3">
            <div>
              <label className="mb-1 block text-sm font-semibold">Nền tảng video</label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value as Platform)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm outline-none focus:border-cyan-400"
              >
                {platformOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name} — {option.note}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold">AI tạo prompt</label>
              <select
                value={promptProvider}
                onChange={(e) => setPromptProvider(e.target.value as PromptProvider)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm outline-none focus:border-cyan-400"
              >
                <option value="auto">Auto (theo cấu hình .env)</option>
                <option value="openai">OpenAI</option>
                <option value="gemini">Gemini</option>
              </select>
            </div>

            <button
              onClick={onGenerate}
              disabled={isLoading}
              className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? "Đang tạo nội dung..." : "Tạo nội dung video"}
            </button>

            {error ? <pre className="whitespace-pre-wrap text-sm text-rose-400">{error}</pre> : null}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
          <p className="mb-2 text-xs uppercase tracking-wider text-emerald-300">Output</p>
          {!result ? (
            <div className="rounded-xl border border-dashed border-slate-700 p-5 text-sm text-slate-400">
              Chưa có dữ liệu. Nhập nội dung và bấm “Tạo nội dung video”.
            </div>
          ) : (
            <div className="space-y-3">
              <OutputBlock label="Prompt engine sử dụng" value={String(result?.promptEngineUsed ?? "")} onCopy={copyText} />
              <OutputBlock label="Prompt tạo video (từ AI Prompt)" value={generatedPrompt} onCopy={copyText} />
              <OutputBlock label="Tiêu đề đề xuất" value={String(result?.title ?? "")} onCopy={copyText} />
              <OutputBlock label="Mô tả" value={String(result?.description ?? "")} onCopy={copyText} />
              <OutputBlock label="Caption" value={String(result?.caption ?? "")} onCopy={copyText} />
              <OutputBlock
                label="Hashtag"
                value={Array.isArray(result?.hashtags) ? result.hashtags.join(" ") : String(result?.hashtags ?? "")}
                onCopy={copyText}
              />
              {videoUrl ? (
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">Video kết quả</p>
                  <video src={videoUrl} controls className="aspect-[9/16] max-h-[460px] w-full rounded-lg bg-black" />
                  <div className="mt-2 flex flex-wrap gap-2">
                    <a
                      href={videoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-md border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-200 hover:border-cyan-300/50"
                    >
                      Mở video
                    </a>
                    {downloadUrl ? (
                      <a
                        href={downloadUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-md border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-200 hover:border-cyan-300/50"
                      >
                        Tải video
                      </a>
                    ) : null}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-amber-300">Chưa có URL video. Hệ thống có thể đang chờ provider render xong.</p>
              )}
              <OutputBlock
                label="Payload gửi sang provider"
                value={result?.providerRequest ? JSON.stringify(result.providerRequest, null, 2) : ""}
                onCopy={copyText}
              />
            </div>
          )}
        </div>
      </section>

      <section className="mt-4 rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs uppercase tracking-wider text-slate-300">Log xử lý chi tiết</p>
        </div>
        {!stepLogs.length ? (
          <p className="text-sm text-slate-400">Chưa có log.</p>
        ) : (
          <div className="space-y-2">
            {stepLogs.map((log: any, idx: number) => (
              <div key={`${log.step}-${idx}`} className="rounded-lg border border-slate-800 bg-slate-950/70 p-2 text-xs text-slate-200">
                <p>
                  <span className="font-semibold text-cyan-300">{String(log.step ?? "-")}</span> • {String(log.at ?? "-")}
                </p>
                <p>{String(log.message ?? "")}</p>
                {log.endpoint ? (
                  <p className="break-all text-slate-400">API: {String(log.endpoint)}</p>
                ) : null}
                {typeof log.status === "number" ? (
                  <p className="text-slate-400">HTTP: {log.status}</p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-4 rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs uppercase tracking-wider text-slate-300">JSON đầy đủ</p>
          {result ? (
            <button
              className="rounded-lg border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-200 hover:border-cyan-300/50"
              onClick={() => copyText(JSON.stringify(result, null, 2))}
            >
              Copy JSON
            </button>
          ) : null}
        </div>
        <pre className="max-h-[420px] overflow-auto rounded-xl bg-slate-950/70 p-3 text-xs text-slate-200">
          {result ? JSON.stringify(result, null, 2) : "{}"}
        </pre>
      </section>
    </main>
  );
}

function OutputBlock({
  label,
  value,
  onCopy
}: {
  label: string;
  value: string;
  onCopy: (value: string) => void;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
        <button
          className="rounded-md border border-slate-700 px-2 py-1 text-[10px] font-semibold text-slate-200 hover:border-cyan-300/50"
          onClick={() => onCopy(value)}
        >
          Copy
        </button>
      </div>
      <p className="whitespace-pre-wrap text-sm text-slate-100">{value || "-"}</p>
    </div>
  );
}
