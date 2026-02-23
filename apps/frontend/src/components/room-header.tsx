"use client";

import { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { env } from "../lib/env";

interface Props {
  roomCode: string;
}

export const RoomHeader = ({ roomCode }: Props) => {
  const [origin, setOrigin] = useState(env.appOrigin);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const joinUrl = useMemo(() => `${origin}/room/${roomCode}`, [origin, roomCode]);

  return (
    <section className="rounded-2xl border border-cyan-300/30 bg-brand.panel p-4 shadow-lg">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-cyan-200/80">Ma phong</p>
          <h2 className="text-3xl font-bold tracking-wider text-cyan-200">{roomCode}</h2>
          <p className="mt-2 text-sm text-slate-300">Chia se ma hoac QR de moi moi nguoi vao hat.</p>
        </div>
        <div className="rounded-xl bg-white p-2">
          <QRCodeSVG value={joinUrl} size={120} includeMargin />
        </div>
      </div>
    </section>
  );
};
