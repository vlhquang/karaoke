import { gameRegistry } from "./registry";
import type { GameDefinition, PlayableGameDefinition } from "./types";

const defaultKeyboardControls = [
  "P1: WASD để di chuyển, F dùng kỹ năng chính, G dùng kỹ năng phụ nếu game có.",
  "P2: phím mũi tên để di chuyển, K dùng kỹ năng chính, L dùng kỹ năng phụ nếu game có.",
  "Bấm tạm dừng hoặc mở hướng dẫn để pause trận đấu bất cứ lúc nào.",
];

function normalizeGameDefinition(game: GameDefinition): PlayableGameDefinition {
  const runtime = game.runtime ?? (game.id === "ghost-hunters-3d" ? "r3f-ghost" : "legacy-three");
  const supportedPlayers = game.supportedPlayers ?? (game.id === "ghost-hunters-3d" ? [1, 2] : [2]);
  const defaultPlayers = game.defaultPlayers ?? supportedPlayers[supportedPlayers.length - 1] ?? 1;

  return {
    ...game,
    runtime,
    supportedPlayers,
    defaultPlayers,
    requiresCamera: game.requiresCamera ?? false,
    supportedPlatforms: game.supportedPlatforms ?? ["desktop", "tv"],
    help: game.help ?? {
      goal: game.objective,
      controls: defaultKeyboardControls,
      tips: game.mechanics,
    },
  };
}

export const cameraDodgeGame: PlayableGameDefinition = {
  id: "camera-dodge",
  title: "Né Vật Rơi Bằng Camera",
  shortTitle: "Né Camera",
  subtitle: "Dùng cơ thể để điều khiển nhân vật né vật rơi và hứng đồ hồi năng lượng.",
  category: "party",
  modeLabel: "Camera motion 1 người",
  durationLabel: "Sinh tồn",
  difficulty: "Vừa",
  accent: "#a3e635",
  secondaryAccent: "#38bdf8",
  objective: "Đứng trước camera, nghiêng người qua trái/phải để né chướng ngại và hứng vật phẩm tốt.",
  mechanics: ["Camera pose", "Căn giữa cơ thể", "Né vật rơi", "Hứng hồi năng lượng"],
  kidTheme: "Sân chơi vận động bằng camera, màu sáng và không va chạm bạo lực.",
  runtime: "camera-dodge",
  supportedPlayers: [1],
  defaultPlayers: 1,
  requiresCamera: true,
  supportedPlatforms: ["desktop", "tv", "camera"],
  help: {
    goal: "Giữ năng lượng càng lâu càng tốt bằng cách né đá, bom, sét và hứng burger, nước, trái cây, tim hoặc khiên.",
    controls: [
      "Bật camera, đứng trong khung hình rồi bấm Căn giữa.",
      "Nghiêng hoặc bước nhẹ sang trái/phải để điều khiển nhân vật.",
      "Có thể ẩn preview camera sau khi đã đứng đúng khung điều khiển.",
    ],
    tips: [
      "Mở hướng dẫn sẽ pause game nhưng không tắt camera.",
      "Khi pose bị mất, hãy hiện lại camera preview để căn chỉnh.",
      "Khiên chặn sát thương trong vài giây và giúp giữ combo.",
    ],
  },
};

export const playableGameRegistry: PlayableGameDefinition[] = [
  ...gameRegistry.map(normalizeGameDefinition),
  cameraDodgeGame,
];

export function getPlayableGameDefinition(id: string) {
  return playableGameRegistry.find((game) => game.id === id) ?? playableGameRegistry[0];
}

export function isLegacyThreeGame(game: PlayableGameDefinition): game is PlayableGameDefinition & GameDefinition {
  return game.runtime === "legacy-three";
}
