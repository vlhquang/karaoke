import { NextResponse } from "next/server";

const SCRIPT_URL = process.env.STOCK_APPS_SCRIPT_URL ?? "";

export async function POST(request: Request) {
  if (!SCRIPT_URL) {
    return NextResponse.json(
      {
        ok: false,
        message: "Missing STOCK_APPS_SCRIPT_URL on server"
      },
      { status: 500 }
    );
  }

  try {
    const payload = await request.json();
    const action = String(payload?.action ?? "").trim().toLowerCase();
    const upstream = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
      redirect: "follow"
    });

    const text = await upstream.text();
    if (!upstream.ok) {
      const looksLikeHtml = /<!doctype html|<html/i.test(text);
      return NextResponse.json(
        {
          ok: false,
          message: looksLikeHtml
            ? "Apps Script khong tra JSON. Kiem tra lai Deploy (Web app), quyen truy cap 'Anyone', va URL /exec moi nhat."
            : `Apps Script request failed (${upstream.status})`,
          details: text.slice(0, 300)
        },
        { status: 502 }
      );
    }

    try {
      const parsed = JSON.parse(text) as { ok?: boolean; message?: string };
      const recentActions = ["delete", "update_status", "update_prices", "save_config"];
      if (!parsed?.ok && recentActions.includes(action) && /unsupported action/i.test(String(parsed?.message ?? ""))) {
        return NextResponse.json({
          ok: false,
          message:
            `Apps Script đang là bản cũ chưa hỗ trợ action "${action}". Hãy copy code mới nhất từ file /docs/STOCK_APPS_SCRIPT.gs vào Apps Script editor, chọn "Deploy" > "New Deployment", chọn loại "Web app", quyền truy cập "Anyone", rồi sử dụng URL /exec mới nhất.`
        });
      }
      return NextResponse.json(parsed);
    } catch {
      const looksLikeHtml = /<!doctype html|<html/i.test(text);
      return NextResponse.json(
        {
          ok: false,
          message: looksLikeHtml
            ? "Apps Script khong tra JSON. Kiem tra Deployment access = Anyone va dung URL /exec moi nhat."
            : "Invalid JSON response from Apps Script",
          details: text.slice(0, 300)
        },
        { status: 502 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: "Proxy error",
        details: error instanceof Error ? error.message : "Unknown"
      },
      { status: 500 }
    );
  }
}
