import { Socket, Server } from "socket.io";
import { GoogleSpreadsheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";
import express from "express";

interface GPSLocation {
    trackingId: string;
    latitude: number;
    longitude: number;
    speed: number;
    heading: number;
    accuracy: number;
    timestamp: string;
}

// In-memory latest locations
const latestLocations = new Map<string, GPSLocation>();

// Google Sheets setup
let doc: GoogleSpreadsheet | null = null;
let sheet: any = null;
let sheetInitError: string | null = null;

export const initGoogleSheets = async () => {
    sheetInitError = null;
    try {
        const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
        const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
        const sheetId = process.env.GPS_SPREADSHEET_ID;

        if (!email || !privateKey || !sheetId) {
            const missing = [];
            if (!email) missing.push("GOOGLE_SERVICE_ACCOUNT_EMAIL");
            if (!privateKey) missing.push("GOOGLE_PRIVATE_KEY");
            if (!sheetId) missing.push("GPS_SPREADSHEET_ID");

            sheetInitError = `Missing configuration: ${missing.join(", ")}`;
            console.warn(`GPS Tracker: ${sheetInitError}. History saving disabled.`);
            return;
        }

        const auth = new JWT({
            email,
            key: privateKey,
            scopes: ["https://www.googleapis.com/auth/spreadsheets"],
        });

        doc = new GoogleSpreadsheet(sheetId, auth);
        await doc.loadInfo();

        sheet = doc.sheetsByTitle["GPS_LOG"];
        if (!sheet) {
            sheet = await doc.addSheet({
                title: "GPS_LOG",
                headerValues: ["timestamp", "trackingId", "latitude", "longitude", "speed", "heading", "accuracy"]
            });
        }
        console.log("GPS Tracker: Google Sheets connected successfully.");
    } catch (err) {
        sheetInitError = `Connection failed: ${err instanceof Error ? err.message : String(err)}`;
        console.error("GPS Tracker: Google Sheets init failed:", err);
    }
};

const saveToSheet = async (data: GPSLocation): Promise<boolean> => {
    if (!sheet) return false;
    try {
        await sheet.addRow({
            timestamp: data.timestamp,
            trackingId: data.trackingId,
            latitude: data.latitude,
            longitude: data.longitude,
            speed: data.speed,
            heading: data.heading,
            accuracy: data.accuracy
        });
        return true;
    } catch (err) {
        console.error("GPS Tracker: Google Sheets save failed:", err);
        return false;
    }
};

export const registerGpsTracker = (io: Server | null, app: express.Express | null) => {
    initGoogleSheets();

    // Socket.IO
    if (io) {
        const gpsIo = io.of("/gps");

        gpsIo.on("connection", (socket: Socket) => {
            socket.on("join_tracking", (trackingId: string) => {
                socket.join(trackingId);
                // Send latest known location immediately if available
                const lastLoc = latestLocations.get(trackingId);
                if (lastLoc) {
                    socket.emit("location_update", lastLoc);
                }
            });

            socket.on("leave_tracking", (trackingId: string) => {
                socket.leave(trackingId);
            });

            socket.on("send_location", async (data: GPSLocation, ack?: (res: { ok: boolean; status: string }) => void) => {
                // Broadcast to viewers
                gpsIo.to(data.trackingId).emit("location_update", data);

                // Save to memory
                latestLocations.set(data.trackingId, data);

                // Sync to sheet
                const synced = await saveToSheet(data);
                if (ack) {
                    ack({ ok: true, status: synced ? "synced" : "memory_only" });
                }
            });

            socket.on("viewer_location", (data: { trackingId: string; viewerId: string; latitude: number; longitude: number }) => {
                // Broadcast viewer location to all clients in the tracking room (including the sender)
                gpsIo.to(data.trackingId).emit("viewer_location_update", data);
            });
        });
    }

    // REST API
    if (app) {
        app.post("/api/gps/location", express.json(), async (req, res) => {
            const data = req.body as GPSLocation;
            if (!data.trackingId || !data.latitude || !data.longitude) {
                res.status(400).json({ error: "Invalid data" });
                return;
            }

            // Fallback for devices that cannot use WebSocket
            data.timestamp = data.timestamp || new Date().toISOString();

            latestLocations.set(data.trackingId, data);
            const synced = await saveToSheet(data);

            res.json({ success: true, status: synced ? "synced" : "memory_only" });
        });

        app.get("/api/gps/location", (req, res) => {
            const id = req.query.id as string;
            if (!id) {
                res.status(400).json({ error: "Missing trackingId" });
                return;
            }
            const loc = latestLocations.get(id);
            res.json(loc || null);
        });

        app.get("/api/gps/locations", (req, res) => {
            const idsString = req.query.ids as string;
            if (!idsString) {
                res.status(400).json({ error: "Missing ids" });
                return;
            }
            const ids = idsString.split(",");
            const result: Record<string, GPSLocation> = {};
            for (const id of ids) {
                const loc = latestLocations.get(id);
                if (loc) {
                    result[id] = loc;
                }
            }
            res.json(result);
        });

        app.get("/api/gps/history", async (req, res) => {
            const id = req.query.id as string;
            const limit = parseInt(req.query.limit as string) || 100;
            if (!id) {
                res.status(400).json({ error: "Missing trackingId" });
                return;
            }
            if (!sheet) {
                res.status(503).json({
                    error: "History storage currently unavailable",
                    details: sheetInitError || "Initialization in progress or unknown error"
                });
                return;
            }

            try {
                // Get all active rows, relying on Google Sheets auto-cropping empty rows
                const rows = await sheet.getRows();
                const history = rows
                    .map((r: any) => r.toObject())
                    .filter((r: any) => String(r.trackingId) === id);
                res.json(history.slice(-limit));
            } catch (err) {
                res.status(500).json({ error: "Failed to fetch history " + err });
            }
        });

        app.get("/api/gps/historyByDate", async (req, res) => {
            const id = req.query.id as string;
            const dateStr = req.query.date as string; // YYYY-MM-DD
            if (!id || !dateStr) {
                res.status(400).json({ error: "Missing id or date" });
                return;
            }
            if (!sheet) {
                res.status(503).json({ error: "History storage unavailable" });
                return;
            }
            try {
                // In a real prod environment we wouldn't fetch all rows, but Google Sheets API lacks advanced querying.
                // Fetching all populated rows since we have no complex query API
                const rows = await sheet.getRows();
                const history = rows
                    .map((r: any) => r.toObject())
                    .filter((r: any) => {
                        if (String(r.trackingId) !== id) return false;
                        // timestamp is ISO e.g. "2023-11-20T10:20:30.000Z"
                        const cellDateStr = String(r.timestamp).substring(0, 10);
                        return cellDateStr === dateStr;
                    });
                res.json(history);
            } catch (err) {
                res.status(500).json({ error: "Failed to fetch history" });
            }
        });
    }
};
