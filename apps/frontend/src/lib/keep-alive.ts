/**
 * Render Keep-Alive Utility
 * 
 * This module provides a simple cron-like functionality to ping the server
 * every 14 minutes to prevent it from "sleeping" on Render's free tier.
 */

export function startKeepAlive(url?: string, intervalMs: number = 14 * 60 * 1000) {
    const targetUrl = url || process.env.NEXT_PUBLIC_APP_ORIGIN || "http://localhost:3000";

    if (process.env.NODE_ENV !== "production") {
        console.log(`[Keep-Alive] Skip cron in ${process.env.NODE_ENV} mode.`);
        return;
    }

    console.log(`[Keep-Alive] Starting cron to ping ${targetUrl} every ${intervalMs / 60000} minutes.`);

    // Initial ping
    ping(targetUrl);

    // Periodic ping
    const timer = setInterval(() => {
        ping(targetUrl);
    }, intervalMs);

    return () => clearInterval(timer);
}

async function ping(url: string) {
    try {
        const healthUrl = `${url.replace(/\/$/, "")}/health`;
        const res = await fetch(healthUrl);
        if (res.ok) {
            console.log(`[Keep-Alive] Ping success: ${new Date().toISOString()} - ${healthUrl}`);
        } else {
            console.warn(`[Keep-Alive] Ping failed with status ${res.status}: ${healthUrl}`);
        }
    } catch (err) {
        console.error(`[Keep-Alive] Ping error:`, err);
    }
}
