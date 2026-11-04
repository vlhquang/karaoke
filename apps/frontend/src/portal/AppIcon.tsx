import { Activity, BookOpen, Boxes, Camera, Car, ChartNoAxesCombined, Clapperboard, Code2, FileText, Film, Gamepad2, Gauge, Gift, Grid2X2, Heart, Landmark, Languages, MapPinned, Mic2, Orbit, PartyPopper, PencilRuler, Shield, Sparkles, Ticket, Wallet } from "lucide-react";

const ICONS = { mic: Mic2, pencil: PencilRuler, ticket: Ticket, gift: Gift, landmark: Landmark, party: PartyPopper, game: Gamepad2, activity: Activity, camera: Camera, shield: Shield, car: Car, chart: ChartNoAxesCombined, wallet: Wallet, gauge: Gauge, map: MapPinned, code: Code2, languages: Languages, file: FileText, orbit: Orbit, boxes: Boxes, clapperboard: Clapperboard, film: Film, grid: Grid2X2, heart: Heart, book: BookOpen, video: Clapperboard, sparkles: Sparkles };
export function AppIcon({ name, size = 24, className }: { name: string; size?: number; className?: string }) {
  const Icon = ICONS[name as keyof typeof ICONS] ?? Grid2X2;
  return <Icon size={size} strokeWidth={1.8} className={className} aria-hidden="true" />;
}
