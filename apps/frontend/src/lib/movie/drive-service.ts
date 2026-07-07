import { google } from "googleapis";
import fs from "fs";

function getAuth() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET or GOOGLE_REFRESH_TOKEN is not set");
  }
  const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
  oauth2.setCredentials({ refresh_token: refreshToken });
  return oauth2;
}

function getFolderId(): string {
  const id = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!id) throw new Error("GOOGLE_DRIVE_FOLDER_ID is not set");
  return id;
}

export interface DriveFile {
  id: string;
  name: string;
  size: string;
  mimeType: string;
  createdTime: string;
  thumbnailLink?: string;
}

export async function uploadToDrive(
  filePath: string,
  fileName: string,
  onProgress: (percent: number) => void,
  signal?: { cancelled: boolean }
): Promise<{ id: string; name: string }> {
  const auth = getAuth();
  const drive = google.drive({ version: "v3", auth });

  const fileSize = fs.statSync(filePath).size;
  let uploaded = 0;

  const readStream = fs.createReadStream(filePath);
  readStream.on("data", (chunk: string | Buffer) => {
    if (signal?.cancelled) {
      readStream.destroy(new Error("Upload cancelled"));
      return;
    }
    uploaded += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk);
    onProgress(Math.min(99, Math.round((uploaded / fileSize) * 100)));
  });

  const res = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [getFolderId()],
    },
    media: {
      mimeType: "video/mp4",
      body: readStream,
    },
    fields: "id,name",
  });

  return { id: res.data.id!, name: res.data.name! };
}

export async function renameDriveFile(fileId: string, name: string): Promise<string> {
  const auth = getAuth();
  const drive = google.drive({ version: "v3", auth });
  const res = await drive.files.update({ fileId, requestBody: { name }, fields: "id,name" });
  return res.data.name!;
}

export async function deleteDriveFile(fileId: string): Promise<void> {
  const auth = getAuth();
  const drive = google.drive({ version: "v3", auth });
  await drive.files.delete({ fileId });
}

export async function listDriveFiles(): Promise<DriveFile[]> {
  const auth = getAuth();
  const drive = google.drive({ version: "v3", auth });

  const res = await drive.files.list({
    q: `'${getFolderId()}' in parents and trashed = false`,
    fields: "files(id,name,size,mimeType,createdTime,thumbnailLink)",
    orderBy: "createdTime desc",
    pageSize: 50,
  });

  return (res.data.files ?? []) as DriveFile[];
}

export interface StreamResult {
  stream: NodeJS.ReadableStream;
  contentType: string;
  status: 200 | 206;
  headers: Record<string, string>;
}

export async function streamDriveFile(
  fileId: string,
  rangeHeader?: string | null
): Promise<StreamResult> {
  const auth = getAuth();
  const drive = google.drive({ version: "v3", auth });

  const meta = await drive.files.get({ fileId, fields: "mimeType,size" });
  const contentType = meta.data.mimeType ?? "video/mp4";
  const totalSize = (meta.data as Record<string, unknown>)["size"] as string | undefined;

  const reqHeaders: Record<string, string> = {};
  if (rangeHeader) reqHeaders["Range"] = rangeHeader;

  const res = await drive.files.get(
    { fileId, alt: "media" },
    { responseType: "stream", headers: reqHeaders }
  );

  const stream = res.data as unknown as NodeJS.ReadableStream;
  const resHeaders: Record<string, string> = {
    "Content-Type": contentType,
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-store",
  };

  if (rangeHeader && totalSize) {
    const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
    if (match) {
      const start = parseInt(match[1], 10);
      const end = match[2] ? parseInt(match[2], 10) : parseInt(totalSize, 10) - 1;
      resHeaders["Content-Range"] = `bytes ${start}-${end}/${totalSize}`;
      resHeaders["Content-Length"] = String(end - start + 1);
      return { stream, contentType, status: 206, headers: resHeaders };
    }
  }

  if (totalSize) resHeaders["Content-Length"] = totalSize;
  return { stream, contentType, status: 200, headers: resHeaders };
}
