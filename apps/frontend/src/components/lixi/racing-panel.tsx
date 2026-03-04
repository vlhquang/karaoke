import { useEffect, useRef, useState } from "react";
import Phaser from "phaser";
import type { LiXiActionProps } from "./types";

interface RacingPanelProps extends LiXiActionProps {
    gameState?: any;
    playerId?: string;
}

export function RacingPanel({ disabled, onEmit, gameState, playerId, room, onClose }: RacingPanelProps) {
    const gameRef = useRef<Phaser.Game | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [showQuestion, setShowQuestion] = useState(false);

    useEffect(() => {
        if (!containerRef.current) return;

        const config: Phaser.Types.Core.GameConfig = {
            type: Phaser.AUTO,
            parent: containerRef.current,
            width: containerRef.current.clientWidth,
            height: containerRef.current.clientHeight,
            transparent: true,
            scene: {
                preload: preload,
                create: create,
                update: update
            },
            physics: {
                default: 'arcade'
            }
        };

        const game = new Phaser.Game(config);
        gameRef.current = game;

        let cars: Record<string, Phaser.GameObjects.Container> = {};
        let obstacles: Phaser.GameObjects.Sprite[] = [];
        let road: Phaser.GameObjects.TileSprite;
        let markers: Phaser.GameObjects.Graphics;

        function preload(this: Phaser.Scene) {
            // Phaser basics
        }

        function create(this: Phaser.Scene) {
            const { width, height } = this.scale;

            // Road
            road = this.add.tileSprite(width / 2, height / 2, 300, height, "").setAlpha(0.2);

            // Lane markers
            markers = this.add.graphics();
            drawMarkers(markers, width, height);

            // Input
            this.input.keyboard?.on('keydown-LEFT', () => {
                onEmit("racing:lane_change", { direction: "left" });
            });
            this.input.keyboard?.on('keydown-RIGHT', () => {
                onEmit("racing:lane_change", { direction: "right" });
            });

            // Simple touch support
            this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
                if (pointer.x < width / 2) onEmit("racing:lane_change", { direction: "left" });
                else onEmit("racing:lane_change", { direction: "right" });
            });
        }

        function drawMarkers(graphics: Phaser.GameObjects.Graphics, width: number, height: number) {
            graphics.clear();
            graphics.lineStyle(2, 0xffffff, 0.3);
            const laneWidth = 100;
            const startX = (width - 300) / 2;
            for (let i = 0; i <= 3; i++) {
                graphics.lineBetween(startX + i * laneWidth, 0, startX + i * laneWidth, height);
            }
        }

        function update(this: Phaser.Scene) {
            if (!gameState) return;

            const { width, height } = this.scale;
            const laneWidth = 100;
            const startX = (width - 300) / 2;

            // Update Road Scroll
            if (gameState.phase === "RACING") {
                road.tilePositionY -= 5;
            }

            // Update Cars
            Object.entries(gameState.playerStates).forEach(([pid, ps]: [string, any]) => {
                if (!cars[pid]) {
                    const isMe = pid === playerId;
                    const container = this.add.container(startX + ps.lane * laneWidth + 50, height - 100);
                    const body = this.add.rectangle(0, 0, 40, 60, isMe ? 0x22d3ee : 0xf43f5e).setOrigin(0.5);
                    container.add(body);
                    cars[pid] = container;
                }

                const car = cars[pid];
                const targetX = startX + ps.lane * laneWidth + 50;
                car.x = Phaser.Math.Linear(car.x, targetX, 0.2);

                // Visual feedback based on status
                const body = car.list[0] as Phaser.GameObjects.Rectangle;
                if (ps.status === "spinning") car.angle += 10;
                else car.angle = 0;

                if (ps.status === "stopped" || ps.status === "penalized") body.setAlpha(0.5);
                else if (ps.status === "rewarded") body.setFillStyle(0xfcd34d);
                else body.setAlpha(1);
            });

            // Update Obstacles
            gameState.obstacles.forEach((obs: any, idx: number) => {
                // Simple logic: render obstacles relative to my car's distance
                const myPs = gameState.playerStates[playerId ?? ""];
                if (!myPs) return;

                const relDist = obs.distance - myPs.distance;
                if (relDist > -height && relDist < height) {
                    const y = height - 100 - relDist;
                    const x = startX + obs.lane * laneWidth + 50;

                    if (!obstacles[idx]) {
                        let color = 0x64748b;
                        if (obs.type === "oil") color = 0x000000;
                        if (obs.type === "question") color = 0x3b82f6;
                        obstacles[idx] = this.add.sprite(x, y, "").setDisplaySize(30, 30);
                        const rect = this.add.rectangle(0, 0, 30, 30, color);
                        (obstacles[idx] as any).rect = rect;
                    }

                    const obstacle = obstacles[idx];
                    obstacle.setPosition(x, y);
                    (obstacle as any).rect.setPosition(x, y);

                    // Collision Check (Client reports to server)
                    if (Math.abs(relDist) < 20 && obs.lane === myPs.lane && myPs.status === "normal") {
                        onEmit("racing:collision", { obstacleIndex: idx });
                    }
                } else if (obstacles[idx]) {
                    (obstacles[idx] as any).rect.destroy();
                    obstacles[idx].destroy();
                    delete obstacles[idx];
                }
            });
        }

        return () => {
            game.destroy(true);
            gameRef.current = null;
        };
    }, [gameState, playerId, onEmit]);

    useEffect(() => {
        if (gameState?.phase === "QUESTION" && !showQuestion) {
            setShowQuestion(true);
        } else if (gameState?.phase !== "QUESTION" && showQuestion) {
            setShowQuestion(false);
        }
    }, [gameState?.phase, showQuestion]);

    return (
        <div className="relative flex h-[min(85vh,750px)] w-full flex-col items-center justify-center overflow-hidden rounded-3xl bg-slate-950/40 border border-slate-800 shadow-2xl">
            {/* HUD Layer */}
            <div className="absolute top-4 left-4 right-4 z-50 flex justify-between items-start pointer-events-none">
                <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-cyan-400">Racing</span>
                    <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-black text-white px-2 py-1 rounded-lg bg-slate-900/80 border border-slate-800 backdrop-blur-sm">
                            {gameState?.phase === "COUNTDOWN" ? "CHỜ..." : "ĐUA XE"}
                        </span>
                    </div>
                </div>

                <div className="text-right flex flex-col items-end gap-2">
                    <div className="px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-800 backdrop-blur-sm">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block">Tiến độ</span>
                        <p className="font-mono text-sm font-bold text-white leading-tight">
                            {Math.round((gameState?.playerStates?.[playerId!]?.distance / gameState?.finishDistance) * 100) || 0}%
                        </p>
                    </div>
                </div>
            </div>

            {/* Game Container */}
            <div ref={containerRef} className="absolute inset-0 z-10" />

            {/* Countdown Overlay */}
            {gameState?.phase === "COUNTDOWN" && (
                <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm">
                    <div className="text-8xl font-black text-white italic animate-bounce">
                        {Math.ceil((gameState.phaseEndsAt - Date.now()) / 1000)}
                    </div>
                </div>
            )}

            {/* Question Overlay */}
            {showQuestion && gameState?.currentQuestion && (
                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-md p-6 animate-in fade-in zoom-in duration-300">
                    <div className="w-full max-w-sm space-y-6">
                        <div className="text-center space-y-2">
                            <span className="text-xs font-bold text-cyan-400 uppercase tracking-[0.2em]">Hộp câu hỏi</span>
                            <h3 className="text-3xl font-black text-white italic">{gameState.currentQuestion.question}</h3>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            {gameState.currentQuestion.answers.map((answer: string, idx: number) => {
                                const hasResponded = !!gameState.currentQuestion.responses[playerId!];
                                const myResponse = gameState.currentQuestion.responses[playerId!];
                                const isCorrect = idx === gameState.currentQuestion.correctIndex;

                                return (
                                    <button
                                        key={idx}
                                        disabled={disabled || hasResponded}
                                        onClick={() => onEmit("racing:answer", { answerIndex: idx })}
                                        className={`
                            relative py-4 px-2 rounded-2xl border-2 font-black transition-all active:scale-95
                            ${hasResponded
                                                ? (isCorrect ? "border-green-500 bg-green-500/20 text-green-200" : (myResponse.answerIndex === idx ? "border-red-500 bg-red-500/20 text-red-200" : "border-slate-800 bg-slate-900/50 text-slate-500"))
                                                : "border-slate-700 bg-slate-800/50 text-white hover:border-cyan-500 hover:bg-cyan-500/10"
                                            }
                          `}
                                    >
                                        {answer}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                            <div
                                className="absolute inset-y-0 left-0 bg-cyan-500 transition-all duration-100"
                                style={{ width: `${Math.max(0, (gameState.phaseEndsAt - Date.now()) / 10000) * 100}%` }}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Finish Overlay */}
            {gameState?.done && (
                <div className="absolute inset-0 z-[60] flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-md p-8 text-center animate-in fade-in duration-500">
                    <div className="mb-6 h-20 w-20 flex items-center justify-center rounded-3xl bg-amber-500 text-slate-950 shadow-2xl shadow-amber-500/20">
                        <span className="text-4xl">🏆</span>
                    </div>
                    <h2 className="text-3xl font-black text-white mb-2 uppercase tracking-tighter">
                        {gameState.winnerId === playerId ? "BẠN CHIẾN THẮNG!" : "HOÀN THÀNH!"}
                    </h2>
                    <p className="text-sm text-slate-400 max-w-[240px] leading-relaxed mb-8">
                        Cuộc đua đã kết thúc. Chờ host để quay lại phòng chờ.
                    </p>
                    <button
                        onClick={() => onClose?.()}
                        className="w-full max-w-xs rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 py-4 text-sm font-black text-slate-950 shadow-xl shadow-orange-500/20 transition-all hover:scale-[1.02] active:scale-95"
                    >
                        ĐÓNG
                    </button>
                </div>
            )}
        </div>
    );
}
