"use client";

import dynamic from "next/dynamic";

const SimulationWorkbench = dynamic(
  () => import("./components/SimulationWorkbench"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-screen w-full items-center justify-center bg-zinc-950 text-sm text-zinc-200">
        Đang tải bàn mô phỏng...
      </div>
    ),
  },
);

export default function SimulationPage() {
  return <SimulationWorkbench />;
}
