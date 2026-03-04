import { NextResponse } from "next/server";

const wavHeader = (dataLength: number, sampleRate: number): Buffer => {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataLength, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // PCM chunk size
  header.writeUInt16LE(1, 20); // PCM format
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28); // byte rate (16-bit mono)
  header.writeUInt16LE(2, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample
  header.write("data", 36);
  header.writeUInt32LE(dataLength, 40);
  return header;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const durationMs = Math.max(200, Math.min(5000, Number(searchParams.get("durationMs") ?? "900")));
  const freq = Math.max(180, Math.min(1200, Number(searchParams.get("freq") ?? "440")));
  const sampleRate = 44_100;
  const sampleCount = Math.floor((sampleRate * durationMs) / 1000);
  const pcm = Buffer.alloc(sampleCount * 2);

  for (let i = 0; i < sampleCount; i += 1) {
    const t = i / sampleRate;
    const env = Math.min(1, i / (sampleRate * 0.04)) * Math.min(1, (sampleCount - i) / (sampleRate * 0.08));
    const v = Math.sin(2 * Math.PI * freq * t) * 0.38 * env;
    pcm.writeInt16LE(Math.floor(v * 32767), i * 2);
  }

  const wav = Buffer.concat([wavHeader(pcm.length, sampleRate), pcm]);
  return new NextResponse(wav, {
    headers: {
      "Content-Type": "audio/wav",
      "Cache-Control": "no-store"
    }
  });
}

