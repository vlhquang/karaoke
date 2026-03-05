import { NextResponse } from "next/server";

const SCRIPT_URL = process.env.ARTICLES_APPS_SCRIPT_URL ?? "";

export async function POST(request: Request) {
    if (!SCRIPT_URL) {
        return NextResponse.json(
            { ok: false, message: "Missing ARTICLES_APPS_SCRIPT_URL on server" },
            { status: 500 }
        );
    }

    try {
        const payload = await request.json();
        const upstream = await fetch(SCRIPT_URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify(payload),
            redirect: "follow",
        });

        const text = await upstream.text();

        if (!upstream.ok) {
            const isHtml = /<!doctype html|<html/i.test(text);
            return NextResponse.json(
                {
                    ok: false,
                    message: isHtml
                        ? "Apps Script không trả JSON. Kiểm tra lại Deploy (Web app), quyền 'Anyone', và URL /exec mới nhất."
                        : `Apps Script request failed (${upstream.status})`,
                    details: text.slice(0, 300),
                },
                { status: 502 }
            );
        }

        try {
            const parsed = JSON.parse(text);
            return NextResponse.json(parsed);
        } catch {
            const isHtml = /<!doctype html|<html/i.test(text);
            return NextResponse.json(
                {
                    ok: false,
                    message: isHtml
                        ? "Apps Script không trả JSON. Kiểm tra Deployment access = Anyone và dùng URL /exec mới nhất."
                        : "Invalid JSON response from Apps Script",
                    details: text.slice(0, 300),
                },
                { status: 502 }
            );
        }
    } catch (error) {
        return NextResponse.json(
            {
                ok: false,
                message: "Proxy error",
                details: error instanceof Error ? error.message : "Unknown",
            },
            { status: 500 }
        );
    }
}
