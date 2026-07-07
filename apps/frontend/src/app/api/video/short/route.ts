import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Platform = "sora2" | "seedance" | "kling" | "veo3";
type PromptProvider = "openai" | "gemini";

interface ShortRequest {
  text: string;
  platform: Platform;
  promptProvider?: PromptProvider | "auto";
}

interface StepLog {
  step: string;
  at: string;
  message: string;
  endpoint?: string;
  status?: number;
}

interface ProviderConfig {
  label: string;
  createEndpoint: string;
  statusEndpoint: string;
  createPayloadTemplate: string;
  apiKey: string;
  accessKey: string;
  secretKey: string;
}

const PLATFORM_LABEL: Record<Platform, string> = {
  sora2: "Sora 2",
  seedance: "Seedance",
  kling: "Kling",
  veo3: "Veo3"
};

const now = (): string => new Date().toISOString();

const safeHint = (value: string): string | null =>
  value ? `${value.slice(0, 4)}***${value.slice(-3)}` : null;

const getProviderConfig = (platform: Platform): ProviderConfig => {
  const upper = platform.toUpperCase();
  return {
    label: PLATFORM_LABEL[platform],
    createEndpoint: String(process.env[`${upper}_API_ENDPOINT`] ?? "").trim(),
    statusEndpoint: String(process.env[`${upper}_STATUS_ENDPOINT`] ?? "").trim(),
    createPayloadTemplate: String(process.env[`${upper}_CREATE_PAYLOAD_TEMPLATE`] ?? "").trim(),
    apiKey: String(process.env[`${upper}_API_KEY`] ?? "").trim(),
    accessKey: String(process.env[`${upper}_ACCESS_KEY`] ?? "").trim(),
    secretKey: String(process.env[`${upper}_SECRET_KEY`] ?? "").trim()
  };
};

const buildProviderHeaders = (cfg: ProviderConfig): HeadersInit => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };
  if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`;
  if (cfg.accessKey) headers["x-access-key"] = cfg.accessKey;
  if (cfg.secretKey) headers["x-secret-key"] = cfg.secretKey;
  return headers;
};

const parseJsonSafe = async (res: Response): Promise<any> => {
  const text = await res.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { _raw: text };
  }
};

const parseGeneratedFromText = (
  outputText: string,
  fallbackText: string
): {
  prompt: string;
  title?: string;
  description?: string;
  caption?: string;
  hashtags?: string[];
} => {
  let generated: {
    prompt: string;
    title?: string;
    description?: string;
    caption?: string;
    hashtags?: string[];
  } = {
    prompt: fallbackText
  };
  try {
    if (outputText.startsWith("{")) {
      generated = JSON.parse(outputText);
    } else {
      const start = outputText.indexOf("{");
      const end = outputText.lastIndexOf("}");
      if (start >= 0 && end > start) {
        generated = JSON.parse(outputText.slice(start, end + 1));
      }
    }
  } catch {
    generated = { prompt: outputText || fallbackText };
  }
  if (!generated.prompt?.trim()) generated.prompt = fallbackText;
  return generated;
};

const getGeminiEndpoint = (apiKey: string, model: string): string => {
  const custom = String(process.env.GEMINI_API_ENDPOINT ?? "").trim();
  if (custom) {
    return custom
      .replace("{model}", encodeURIComponent(model))
      .replace("{key}", encodeURIComponent(apiKey));
  }
  return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
};

const applyTemplate = (value: unknown, vars: Record<string, string>): unknown => {
  if (typeof value === "string") {
    return value.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_all, key: string) => vars[key] ?? "");
  }
  if (Array.isArray(value)) {
    return value.map((item) => applyTemplate(item, vars));
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const next: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      next[k] = applyTemplate(v, vars);
    }
    return next;
  }
  return value;
};

const buildProviderCreatePayload = (
  cfg: ProviderConfig,
  prompt: string
): Record<string, unknown> => {
  const vars = {
    prompt,
    aspect_ratio: "9:16",
    resolution: "1080x1920",
    duration_sec: "30"
  };
  if (cfg.createPayloadTemplate) {
    try {
      const parsed = JSON.parse(cfg.createPayloadTemplate) as unknown;
      const applied = applyTemplate(parsed, vars);
      if (applied && typeof applied === "object" && !Array.isArray(applied)) {
        return applied as Record<string, unknown>;
      }
    } catch {
      // fallback to default payload
    }
  }
  return {
    prompt,
    aspectRatio: "9:16",
    resolution: "1080x1920",
    durationSec: 30
  };
};

const extractVideoInfo = (payload: any): { videoUrl: string | null; downloadUrl: string | null; taskId: string | null; status: string | null } => {
  const videoUrl =
    payload?.videoUrl ??
    payload?.video_url ??
    payload?.data?.videoUrl ??
    payload?.data?.video_url ??
    payload?.output?.videoUrl ??
    payload?.url ??
    null;
  const downloadUrl =
    payload?.downloadUrl ??
    payload?.download_url ??
    payload?.data?.downloadUrl ??
    payload?.data?.download_url ??
    videoUrl ??
    null;
  const taskId =
    payload?.taskId ??
    payload?.task_id ??
    payload?.id ??
    payload?.jobId ??
    payload?.data?.taskId ??
    payload?.data?.id ??
    null;
  const status =
    payload?.status ??
    payload?.state ??
    payload?.data?.status ??
    payload?.data?.state ??
    null;
  return { videoUrl, downloadUrl, taskId, status };
};

export async function GET() {
  const promptProvider = (String(process.env.PROMPT_AI_PROVIDER ?? "openai").trim().toLowerCase() ||
    "openai") as PromptProvider;
  const openaiApiKey = String(process.env.OPENAI_API_KEY ?? "").trim();
  const openaiEndpoint = String(process.env.OPENAI_API_ENDPOINT ?? "https://api.openai.com/v1/responses").trim();
  const openaiModel = String(process.env.OPENAI_MODEL ?? "gpt-4.1-mini").trim();
  const geminiApiKey = String(process.env.GEMINI_API_KEY ?? "").trim();
  const geminiModel = String(process.env.GEMINI_MODEL ?? "gemini-2.0-flash").trim();
  const geminiEndpoint = getGeminiEndpoint(geminiApiKey || "KEY", geminiModel);

  const providers = (["sora2", "seedance", "kling", "veo3"] as Platform[]).map((platform) => {
    const cfg = getProviderConfig(platform);
    return {
      id: platform,
      label: cfg.label,
      createEndpoint: cfg.createEndpoint || null,
      statusEndpoint: cfg.statusEndpoint || null,
      createPayloadTemplateConfigured: Boolean(cfg.createPayloadTemplate),
      keyConfigured: Boolean(cfg.apiKey || (cfg.accessKey && cfg.secretKey)),
      keyHint: safeHint(cfg.apiKey || cfg.accessKey)
    };
  });

  return NextResponse.json({
    ok: true,
    service: "video-short",
    flow: "prompt_ai_then_provider_video",
    promptProvider,
    openai: {
      endpoint: openaiEndpoint,
      model: openaiModel,
      keyConfigured: Boolean(openaiApiKey),
      keyHint: safeHint(openaiApiKey)
    },
    gemini: {
      endpoint: geminiEndpoint.replace(encodeURIComponent(geminiApiKey || "KEY"), "***"),
      model: geminiModel,
      keyConfigured: Boolean(geminiApiKey),
      keyHint: safeHint(geminiApiKey)
    },
    providers
  });
}

export async function POST(request: Request) {
  const requestId =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const logs: StepLog[] = [];
  const pushLog = (step: string, message: string, endpoint?: string, status?: number): void => {
    logs.push({ step, at: now(), message, endpoint, status });
  };

  try {
    pushLog("parse_request_body", "Đang đọc payload đầu vào");
    const body = (await request.json()) as Partial<ShortRequest>;
    const text = String(body.text ?? "").trim();
    const platform = String(body.platform ?? "") as Platform;
    const promptProviderInput = String(body.promptProvider ?? "auto").trim().toLowerCase();

    if (!text || text.length < 20) {
      pushLog("validate_input", "Nội dung đầu vào không hợp lệ");
      return NextResponse.json(
        { ok: false, requestId, logs, errorStep: "validate_input", message: "Vui lòng nhập nội dung ít nhất 20 ký tự." },
        { status: 400 }
      );
    }
    if (!["sora2", "seedance", "kling", "veo3"].includes(platform)) {
      pushLog("validate_platform", "Nền tảng video không hợp lệ");
      return NextResponse.json(
        { ok: false, requestId, logs, errorStep: "validate_platform", message: "Nền tảng video không hợp lệ." },
        { status: 400 }
      );
    }
    if (!["auto", "openai", "gemini"].includes(promptProviderInput)) {
      pushLog("validate_prompt_provider", "Prompt provider không hợp lệ");
      return NextResponse.json(
        { ok: false, requestId, logs, errorStep: "validate_prompt_provider", message: "Prompt provider không hợp lệ." },
        { status: 400 }
      );
    }

    const openaiApiKey = String(process.env.OPENAI_API_KEY ?? "").trim();
    const openaiEndpoint = String(process.env.OPENAI_API_ENDPOINT ?? "https://api.openai.com/v1/responses").trim();
    const openaiModel = String(process.env.OPENAI_MODEL ?? "gpt-4.1-mini").trim();
    const geminiApiKey = String(process.env.GEMINI_API_KEY ?? "").trim();
    const geminiModel = String(process.env.GEMINI_MODEL ?? "gemini-2.0-flash").trim();
    const promptProvider = (
      promptProviderInput === "auto"
        ? (String(process.env.PROMPT_AI_PROVIDER ?? "openai").trim().toLowerCase() || "openai")
        : promptProviderInput
    ) as PromptProvider;
    const allowFallback = String(process.env.PROMPT_AI_FALLBACK ?? "true").trim().toLowerCase() !== "false";

    const providerCfg = getProviderConfig(platform);
    if (!providerCfg.createEndpoint) {
      pushLog("read_provider_env", `Thiếu ${platform.toUpperCase()}_API_ENDPOINT`);
      return NextResponse.json(
        {
          ok: false,
          requestId,
          logs,
          errorStep: "read_provider_env",
          message: `Thiếu ${platform.toUpperCase()}_API_ENDPOINT trong .env.`
        },
        { status: 500 }
      );
    }
    if (!providerCfg.apiKey && !(providerCfg.accessKey && providerCfg.secretKey)) {
      pushLog("read_provider_env", `Thiếu API key cho ${providerCfg.label}`);
      return NextResponse.json(
        {
          ok: false,
          requestId,
          logs,
          errorStep: "read_provider_env",
          message: `Thiếu key cho ${providerCfg.label}. Cấu hình ${platform.toUpperCase()}_API_KEY hoặc ACCESS_KEY + SECRET_KEY trong .env.`
        },
        { status: 500 }
      );
    }

    const systemInstruction =
      "Bạn là chuyên gia viết prompt tạo video AI. Trả về JSON hợp lệ theo schema: {\"prompt\":\"...\",\"title\":\"...\",\"description\":\"...\",\"caption\":\"...\",\"hashtags\":[\"#...\"]}. Prompt cần tối ưu cho video dọc 9:16, 1080x1920, 25-45 giây.";
    const userInstruction = `Nền tảng mục tiêu: ${providerCfg.label}\nYêu cầu người dùng: ${text}`;

    const engines: PromptProvider[] = promptProvider === "gemini" ? ["gemini", "openai"] : ["openai", "gemini"];
    let generated: {
      prompt: string;
      title?: string;
      description?: string;
      caption?: string;
      hashtags?: string[];
    } = { prompt: text };
    let promptEngineUsed: PromptProvider | null = null;

    for (const engine of engines) {
      if (promptEngineUsed) break;
      if (engine !== promptProvider && !allowFallback) break;

      if (engine === "openai") {
        if (!openaiApiKey) {
          pushLog("prompt_engine_skip", "Bỏ qua OpenAI do thiếu OPENAI_API_KEY");
          continue;
        }
        pushLog("openai_generate_prompt:start", "Đang gọi OpenAI tạo prompt video", openaiEndpoint);
        const res = await fetch(openaiEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${openaiApiKey}`
          },
          body: JSON.stringify({
            model: openaiModel,
            input: [
              { role: "system", content: systemInstruction },
              { role: "user", content: userInstruction }
            ],
            max_output_tokens: 700,
            temperature: 0.7
          })
        });
        const payload = await parseJsonSafe(res);
        pushLog("openai_generate_prompt:done", "Đã nhận phản hồi OpenAI", openaiEndpoint, res.status);
        if (!res.ok) {
          pushLog("openai_generate_prompt:error", "OpenAI trả lỗi, thử engine khác nếu có");
          continue;
        }
        const outputText = String(
          payload?.output_text ??
            payload?.output?.[0]?.content?.[0]?.text ??
            payload?.choices?.[0]?.message?.content ??
            ""
        ).trim();
        generated = parseGeneratedFromText(outputText, text);
        promptEngineUsed = "openai";
      } else {
        if (!geminiApiKey) {
          pushLog("prompt_engine_skip", "Bỏ qua Gemini do thiếu GEMINI_API_KEY");
          continue;
        }
        const geminiEndpoint = getGeminiEndpoint(geminiApiKey, geminiModel);
        pushLog(
          "gemini_generate_prompt:start",
          "Đang gọi Gemini tạo prompt video",
          geminiEndpoint.replace(encodeURIComponent(geminiApiKey), "***")
        );
        const res = await fetch(geminiEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            generationConfig: {
              temperature: 0.7,
              topP: 0.9,
              maxOutputTokens: 700
            },
            contents: [
              {
                role: "user",
                parts: [{ text: `${systemInstruction}\n\n${userInstruction}` }]
              }
            ]
          })
        });
        const payload = await parseJsonSafe(res);
        pushLog(
          "gemini_generate_prompt:done",
          "Đã nhận phản hồi Gemini",
          geminiEndpoint.replace(encodeURIComponent(geminiApiKey), "***"),
          res.status
        );
        if (!res.ok) {
          pushLog("gemini_generate_prompt:error", "Gemini trả lỗi, thử engine khác nếu có");
          continue;
        }
        const outputText = String(
          payload?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text ?? "").join("\n") ?? ""
        ).trim();
        generated = parseGeneratedFromText(outputText, text);
        promptEngineUsed = "gemini";
      }
    }

    if (!promptEngineUsed) {
      return NextResponse.json(
        {
          ok: false,
          requestId,
          logs,
          errorStep: "generate_prompt",
          message: "Không tạo được prompt từ OpenAI/Gemini. Kiểm tra key, quota, endpoint trong .env."
        },
        { status: 502 }
      );
    }

    pushLog("generate_prompt:parsed", `Đã tạo prompt video thành công bằng ${promptEngineUsed.toUpperCase()}`);

    const providerRequest = buildProviderCreatePayload(providerCfg, generated.prompt);

    pushLog("provider_create_video:start", `Đang gọi ${providerCfg.label} tạo video`, providerCfg.createEndpoint);
    const providerRes = await fetch(providerCfg.createEndpoint, {
      method: "POST",
      headers: buildProviderHeaders(providerCfg),
      body: JSON.stringify(providerRequest)
    });
    const providerPayload = await parseJsonSafe(providerRes);
    pushLog("provider_create_video:done", `Đã nhận phản hồi từ ${providerCfg.label}`, providerCfg.createEndpoint, providerRes.status);
    if (!providerRes.ok) {
      return NextResponse.json(
        {
          ok: false,
          requestId,
          logs,
          errorStep: "provider_create_video",
          message: `${providerCfg.label} trả lỗi.`,
          upstreamStatus: providerRes.status,
          upstreamEndpoint: providerCfg.createEndpoint,
          providerRequest,
          details: JSON.stringify(providerPayload).slice(0, 700),
          generatedPrompt: generated.prompt
        },
        { status: 502 }
      );
    }

    let info = extractVideoInfo(providerPayload);
    if (!info.videoUrl && info.taskId && providerCfg.statusEndpoint) {
      const pollMax = Math.max(1, Number(process.env.VIDEO_POLL_MAX_ATTEMPTS ?? 20));
      const pollIntervalMs = Math.max(500, Number(process.env.VIDEO_POLL_INTERVAL_MS ?? 3000));
      for (let i = 1; i <= pollMax; i += 1) {
        const url = providerCfg.statusEndpoint.includes("{taskId}")
          ? providerCfg.statusEndpoint.replace("{taskId}", encodeURIComponent(String(info.taskId)))
          : `${providerCfg.statusEndpoint}${providerCfg.statusEndpoint.includes("?") ? "&" : "?"}taskId=${encodeURIComponent(String(info.taskId))}`;
        pushLog("provider_poll_status:start", `Đang poll trạng thái lần ${i}/${pollMax}`, url);
        const pollRes = await fetch(url, { method: "GET", headers: buildProviderHeaders(providerCfg) });
        const pollPayload = await parseJsonSafe(pollRes);
        pushLog("provider_poll_status:done", `Nhận trạng thái lần ${i}/${pollMax}`, url, pollRes.status);
        if (!pollRes.ok) continue;
        info = extractVideoInfo(pollPayload);
        if (info.videoUrl) break;
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      }
    }

    pushLog("done", "Hoàn tất luồng tạo video");
    return NextResponse.json({
      ok: true,
      requestId,
      logs,
      platform,
      platformLabel: providerCfg.label,
      promptEngineUsed,
      generatedPrompt: generated.prompt,
      title: generated.title ?? null,
      description: generated.description ?? null,
      caption: generated.caption ?? null,
      hashtags: Array.isArray(generated.hashtags) ? generated.hashtags : [],
      apiLinks: {
        promptProvider: promptEngineUsed,
        openaiEndpoint,
        geminiEndpoint:
          geminiApiKey && geminiModel
            ? getGeminiEndpoint(geminiApiKey, geminiModel).replace(encodeURIComponent(geminiApiKey), "***")
            : null,
        providerCreateEndpoint: providerCfg.createEndpoint,
        providerStatusEndpoint: providerCfg.statusEndpoint || null
      },
      providerRequest,
      providerResult: {
        status: info.status,
        taskId: info.taskId,
        videoUrl: info.videoUrl,
        downloadUrl: info.downloadUrl
      }
    });
  } catch (error) {
    pushLog("internal_exception", "Lỗi ngoài dự kiến");
    console.error("[api/video/short] internal error", { requestId, logs, error });
    return NextResponse.json(
      {
        ok: false,
        requestId,
        logs,
        errorStep: "internal_exception",
        message: "Lỗi xử lý yêu cầu tạo video.",
        details: error instanceof Error ? error.message : "Unknown"
      },
      { status: 500 }
    );
  }
}
