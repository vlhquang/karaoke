export type TileKind =
  | "start"
  | "landmark"
  | "chance"
  | "fortune"
  | "transport"
  | "tax"
  | "rest"
  | "jail"
  | "goToJail";

export type DeckKind = "chance" | "fortune";
export type Region = "mien-bac" | "mien-trung" | "mien-nam";

export type CardEffect =
  | { type: "cash"; amount: number }
  | { type: "pay"; amount: number }
  | { type: "ownedIncome"; amountPerTile: number }
  | { type: "regionIncome"; region: Region; amountPerTile: number }
  | { type: "maintenance"; amountPerLevel: number }
  | { type: "goToJail" }
  | { type: "getOutOfJailFree" };

export interface Tile {
  id: string;
  name: string;
  shortName: string;
  kind: TileKind;
  color: string;
  description: string;
  region?: Region;
  price?: number;
  baseFee?: number;
  upgradeCost?: number;
}

export interface DrawCard {
  id: string;
  deck: DeckKind;
  number: number;
  title: string;
  description: string;
  effect: CardEffect;
}

type CardTemplate = Omit<DrawCard, "id" | "deck" | "number"> & {
  slug: string;
};

export const regionLabels: Record<Region, string> = {
  "mien-bac": "Miền Bắc",
  "mien-trung": "Miền Trung",
  "mien-nam": "Miền Nam",
};

export const startingCash = 1500;
export const startBonus = 200;
export const taxAmount = 120;
export const restBonus = 100;
export const maxUpgradeLevel = 3;
export const deckSize = 50;
export const jailFine = 150;
export const maxJailTurns = 3;
export const maxRoomPlayers = 6;

const colors = {
  north: "#2f7e79",
  central: "#f2a541",
  south: "#d84f3a",
  transport: "#4567b0",
  chance: "#1d9a8a",
  fortune: "#7b5ab6",
  tax: "#c23b49",
  rest: "#2d9a6d",
  jail: "#35424a",
  start: "#17343b",
};

export const tiles: Tile[] = [
  {
    id: "start",
    name: "Xuất phát",
    shortName: "Start",
    kind: "start",
    color: colors.start,
    description: "Nhận 200K khi đi qua hoặc dừng tại điểm xuất phát.",
  },
  {
    id: "ho-guom",
    name: "Hồ Gươm",
    shortName: "Hồ Gươm",
    kind: "landmark",
    region: "mien-bac",
    color: colors.north,
    price: 120,
    baseFee: 16,
    upgradeCost: 80,
    description: "Điểm dừng trung tâm Hà Nội với lượng khách ổn định.",
  },
  {
    id: "co-hoi-bac",
    name: "Cơ hội",
    shortName: "Cơ hội",
    kind: "chance",
    color: colors.chance,
    description: "Rút một thẻ Cơ hội từ bộ bài dùng chung của phòng.",
  },
  {
    id: "van-mieu",
    name: "Văn Miếu",
    shortName: "Văn Miếu",
    kind: "landmark",
    region: "mien-bac",
    color: colors.north,
    price: 140,
    baseFee: 18,
    upgradeCost: 90,
    description: "Di sản văn hóa có sức hút mạnh với du khách học đường.",
  },
  {
    id: "san-bay-noi-bai",
    name: "Sân bay Nội Bài",
    shortName: "Nội Bài",
    kind: "transport",
    color: colors.transport,
    price: 180,
    baseFee: 24,
    upgradeCost: 120,
    description: "Trạm trung chuyển giúp tạo dòng tiền đều trong suốt ván chơi.",
  },
  {
    id: "vinh-ha-long",
    name: "Vịnh Hạ Long",
    shortName: "Hạ Long",
    kind: "landmark",
    region: "mien-bac",
    color: colors.north,
    price: 260,
    baseFee: 32,
    upgradeCost: 150,
    description: "Địa danh biểu tượng của du lịch biển đảo miền Bắc.",
  },
  {
    id: "sa-pa",
    name: "Sa Pa",
    shortName: "Sa Pa",
    kind: "landmark",
    region: "mien-bac",
    color: colors.north,
    price: 280,
    baseFee: 34,
    upgradeCost: 160,
    description: "Điểm nghỉ dưỡng vùng cao có phí tham quan tăng nhanh khi nâng cấp.",
  },
  {
    id: "trang-an",
    name: "Tràng An",
    shortName: "Tràng An",
    kind: "landmark",
    region: "mien-bac",
    color: colors.north,
    price: 300,
    baseFee: 36,
    upgradeCost: 170,
    description: "Quần thể danh thắng phù hợp để đầu tư dịch vụ trải nghiệm.",
  },
  {
    id: "nha-tu",
    name: "Nhà tù",
    shortName: "Nhà tù",
    kind: "jail",
    color: colors.jail,
    description: "Dừng ở đây chỉ là thăm tù, trừ khi bạn bị chuyển vào tù từ ô hoặc thẻ phạt.",
  },
  {
    id: "phong-nha",
    name: "Phong Nha - Kẻ Bàng",
    shortName: "Phong Nha",
    kind: "landmark",
    region: "mien-trung",
    color: colors.central,
    price: 220,
    baseFee: 28,
    upgradeCost: 140,
    description: "Cửa ngõ khám phá hang động và tour mạo hiểm miền Trung.",
  },
  {
    id: "khi-van-trung",
    name: "Khí vận",
    shortName: "Khí vận",
    kind: "fortune",
    color: colors.fortune,
    description: "Rút một thẻ Khí vận từ bộ bài dùng chung của phòng.",
  },
  {
    id: "co-do-hue",
    name: "Cố đô Huế",
    shortName: "Huế",
    kind: "landmark",
    region: "mien-trung",
    color: colors.central,
    price: 240,
    baseFee: 30,
    upgradeCost: 145,
    description: "Cụm di sản triều Nguyễn có sức hút tốt trong mùa lễ hội.",
  },
  {
    id: "hoi-an",
    name: "Phố cổ Hội An",
    shortName: "Hội An",
    kind: "landmark",
    region: "mien-trung",
    color: colors.central,
    price: 300,
    baseFee: 38,
    upgradeCost: 175,
    description: "Điểm đến có giá trị cao nhờ lưu trú, ẩm thực và trải nghiệm đêm.",
  },
  {
    id: "cau-rong",
    name: "Cầu Rồng Đà Nẵng",
    shortName: "Cầu Rồng",
    kind: "landmark",
    region: "mien-trung",
    color: colors.central,
    price: 260,
    baseFee: 32,
    upgradeCost: 155,
    description: "Điểm check-in đô thị, mạnh khi kết hợp với các địa danh Đà Nẵng.",
  },
  {
    id: "ba-na-hills",
    name: "Bà Nà Hills",
    shortName: "Bà Nà",
    kind: "landmark",
    region: "mien-trung",
    color: colors.central,
    price: 340,
    baseFee: 42,
    upgradeCost: 190,
    description: "Khu du lịch cao cấp với phí tham quan lớn khi nâng cấp.",
  },
  {
    id: "ga-da-nang",
    name: "Ga Đà Nẵng",
    shortName: "Ga ĐN",
    kind: "transport",
    color: colors.transport,
    price: 180,
    baseFee: 24,
    upgradeCost: 120,
    description: "Trạm giao thông nối tuyến Bắc - Trung - Nam.",
  },
  {
    id: "co-hoi-trung",
    name: "Cơ hội",
    shortName: "Cơ hội",
    kind: "chance",
    color: colors.chance,
    description: "Rút một thẻ Cơ hội từ bộ bài dùng chung của phòng.",
  },
  {
    id: "my-son",
    name: "Thánh địa Mỹ Sơn",
    shortName: "Mỹ Sơn",
    kind: "landmark",
    region: "mien-trung",
    color: colors.central,
    price: 220,
    baseFee: 28,
    upgradeCost: 140,
    description: "Di sản văn hóa Chăm với chi phí đầu tư vừa phải.",
  },
  {
    id: "nha-trang",
    name: "Biển Nha Trang",
    shortName: "Nha Trang",
    kind: "landmark",
    region: "mien-trung",
    color: colors.central,
    price: 320,
    baseFee: 40,
    upgradeCost: 180,
    description: "Thành phố biển có dòng khách cao trong các mùa nghỉ lễ.",
  },
  {
    id: "nghi-duong",
    name: "Nghỉ dưỡng",
    shortName: "Nghỉ",
    kind: "rest",
    color: colors.rest,
    description: "Nhận 100K từ gói nghỉ dưỡng và phục hồi dòng tiền.",
  },
  {
    id: "mui-ne",
    name: "Mũi Né",
    shortName: "Mũi Né",
    kind: "landmark",
    region: "mien-nam",
    color: colors.south,
    price: 240,
    baseFee: 30,
    upgradeCost: 145,
    description: "Điểm đến biển và đồi cát, phù hợp chiến thuật nâng cấp sớm.",
  },
  {
    id: "cho-ben-thanh",
    name: "Chợ Bến Thành",
    shortName: "Bến Thành",
    kind: "landmark",
    region: "mien-nam",
    color: colors.south,
    price: 260,
    baseFee: 32,
    upgradeCost: 155,
    description: "Địa danh trung tâm thành phố, tạo phí tham quan ổn định.",
  },
  {
    id: "nha-tho-duc-ba",
    name: "Nhà thờ Đức Bà Sài Gòn",
    shortName: "Đức Bà",
    kind: "landmark",
    region: "mien-nam",
    color: colors.south,
    price: 280,
    baseFee: 34,
    upgradeCost: 165,
    description: "Điểm check-in biểu tượng với giá mua trung bình cao.",
  },
  {
    id: "vao-tu",
    name: "Vào tù",
    shortName: "Vào tù",
    kind: "goToJail",
    color: colors.tax,
    description: "Chuyển ngay đến Nhà tù và bị giữ tối đa 3 lượt.",
  },
  {
    id: "cu-chi",
    name: "Địa đạo Củ Chi",
    shortName: "Củ Chi",
    kind: "landmark",
    region: "mien-nam",
    color: colors.south,
    price: 220,
    baseFee: 28,
    upgradeCost: 140,
    description: "Tour lịch sử có chi phí đầu tư thấp và dễ hoàn vốn.",
  },
  {
    id: "ben-cai-rang",
    name: "Bến Cái Răng",
    shortName: "Bến CR",
    kind: "transport",
    color: colors.transport,
    price: 180,
    baseFee: 24,
    upgradeCost: 120,
    description: "Điểm trung chuyển đường thủy, mạnh khi sở hữu nhiều trạm.",
  },
  {
    id: "khi-van-nam",
    name: "Khí vận",
    shortName: "Khí vận",
    kind: "fortune",
    color: colors.fortune,
    description: "Rút một thẻ Khí vận từ bộ bài dùng chung của phòng.",
  },
  {
    id: "phu-quoc",
    name: "Phú Quốc",
    shortName: "Phú Quốc",
    kind: "landmark",
    region: "mien-nam",
    color: colors.south,
    price: 360,
    baseFee: 46,
    upgradeCost: 210,
    description: "Đảo nghỉ dưỡng cao cấp với mức phí tham quan lớn nhất miền Nam.",
  },
];

const chanceTemplates: CardTemplate[] = [
  {
    slug: "jail-free-a",
    title: "Vé ra tù miễn phí",
    description: "Giữ thẻ này. Dùng một lần để ra tù mà không phải trả phạt.",
    effect: { type: "getOutOfJailFree" },
  },
  {
    slug: "jail-free-b",
    title: "Bảo lãnh du lịch",
    description: "Giữ thẻ này. Khi vào tù, bạn có thể dùng để ra ngay.",
    effect: { type: "getOutOfJailFree" },
  },
  {
    slug: "viral-review",
    title: "Review viral",
    description: "Một video du lịch lên xu hướng. Nhận 180K.",
    effect: { type: "cash", amount: 180 },
  },
  {
    slug: "booking-surge",
    title: "Lượng đặt phòng tăng",
    description: "Nền tảng du lịch đề xuất địa danh của bạn. Nhận 140K.",
    effect: { type: "cash", amount: 140 },
  },
  {
    slug: "student-tour",
    title: "Tour học đường",
    description: "Mỗi địa danh bạn sở hữu tạo thêm 40K.",
    effect: { type: "ownedIncome", amountPerTile: 40 },
  },
  {
    slug: "heritage-week",
    title: "Tuần lễ di sản",
    description: "Mỗi địa danh Miền Trung bạn sở hữu tạo thêm 55K.",
    effect: { type: "regionIncome", region: "mien-trung", amountPerTile: 55 },
  },
  {
    slug: "north-route",
    title: "Tuyến Đông Bắc hút khách",
    description: "Mỗi địa danh Miền Bắc bạn sở hữu tạo thêm 55K.",
    effect: { type: "regionIncome", region: "mien-bac", amountPerTile: 55 },
  },
  {
    slug: "south-campaign",
    title: "Chiến dịch du lịch phía Nam",
    description: "Mỗi địa danh Miền Nam bạn sở hữu tạo thêm 55K.",
    effect: { type: "regionIncome", region: "mien-nam", amountPerTile: 55 },
  },
  {
    slug: "local-partner",
    title: "Đối tác địa phương",
    description: "Nhận 90K từ chương trình hợp tác mới.",
    effect: { type: "cash", amount: 90 },
  },
  {
    slug: "media-award",
    title: "Giải thưởng truyền thông",
    description: "Chiến dịch quảng bá thắng giải. Nhận 220K.",
    effect: { type: "cash", amount: 220 },
  },
  {
    slug: "souvenir-booth",
    title: "Quầy lưu niệm đông khách",
    description: "Nhận 30K cho mỗi địa danh đang sở hữu.",
    effect: { type: "ownedIncome", amountPerTile: 30 },
  },
  {
    slug: "tax-refund",
    title: "Hoàn phí xúc tiến",
    description: "Nhận lại 120K từ quỹ quảng bá du lịch.",
    effect: { type: "cash", amount: 120 },
  },
  {
    slug: "guide-training",
    title: "Đào tạo hướng dẫn viên",
    description: "Trả 20K cho mỗi cấp nâng cấp để chuẩn hóa dịch vụ.",
    effect: { type: "maintenance", amountPerLevel: 20 },
  },
  {
    slug: "regional-fair",
    title: "Hội chợ du lịch",
    description: "Mỗi địa danh bạn sở hữu tạo thêm 35K.",
    effect: { type: "ownedIncome", amountPerTile: 35 },
  },
  {
    slug: "airport-link",
    title: "Tuyến bay mới",
    description: "Khách quốc tế tăng. Nhận 160K.",
    effect: { type: "cash", amount: 160 },
  },
  {
    slug: "street-food",
    title: "Ẩm thực đường phố nổi bật",
    description: "Nhận 110K từ doanh thu trải nghiệm địa phương.",
    effect: { type: "cash", amount: 110 },
  },
];

const fortuneTemplates: CardTemplate[] = [
  {
    slug: "jail-free",
    title: "Thẻ ra tù miễn phí",
    description: "Giữ thẻ này. Dùng một lần để ra tù mà không phải trả phạt.",
    effect: { type: "getOutOfJailFree" },
  },
  {
    slug: "go-to-jail",
    title: "Thanh tra đột xuất",
    description: "Hồ sơ vận hành thiếu giấy tờ. Vào tù ngay.",
    effect: { type: "goToJail" },
  },
  {
    slug: "storm-warning",
    title: "Cảnh báo thời tiết",
    description: "Hủy một loạt tour trong ngày. Trả 120K.",
    effect: { type: "pay", amount: 120 },
  },
  {
    slug: "maintenance",
    title: "Bảo trì mùa cao điểm",
    description: "Trả 35K cho mỗi cấp nâng cấp đang sở hữu.",
    effect: { type: "maintenance", amountPerLevel: 35 },
  },
  {
    slug: "traffic-jam",
    title: "Kẹt xe liên tỉnh",
    description: "Chi phí hỗ trợ khách tăng. Trả 90K.",
    effect: { type: "pay", amount: 90 },
  },
  {
    slug: "price-drop",
    title: "Mùa thấp điểm",
    description: "Doanh thu giảm, trả 70K.",
    effect: { type: "pay", amount: 70 },
  },
  {
    slug: "heritage-fund",
    title: "Đóng quỹ bảo tồn",
    description: "Đóng 130K cho hoạt động bảo tồn di sản.",
    effect: { type: "pay", amount: 130 },
  },
  {
    slug: "rescue-team",
    title: "Hỗ trợ đoàn khách",
    description: "Chi phí xử lý sự cố là 150K.",
    effect: { type: "pay", amount: 150 },
  },
  {
    slug: "safety-audit",
    title: "Kiểm định an toàn",
    description: "Trả 25K cho mỗi cấp nâng cấp đang sở hữu.",
    effect: { type: "maintenance", amountPerLevel: 25 },
  },
  {
    slug: "lucky-season",
    title: "May mắn cuối mùa",
    description: "Dù khó khăn, bạn nhận được 100K hỗ trợ truyền thông.",
    effect: { type: "cash", amount: 100 },
  },
  {
    slug: "local-fee",
    title: "Phụ phí địa phương",
    description: "Trả 20K cho mỗi địa danh đang sở hữu.",
    effect: { type: "ownedIncome", amountPerTile: -20 },
  },
  {
    slug: "booking-cancel",
    title: "Hủy đặt phòng hàng loạt",
    description: "Trả 160K để hoàn tiền khách.",
    effect: { type: "pay", amount: 160 },
  },
  {
    slug: "market-shift",
    title: "Thị trường đổi hướng",
    description: "Các gói tour phải làm mới. Trả 110K.",
    effect: { type: "pay", amount: 110 },
  },
  {
    slug: "inspection-route",
    title: "Đoàn kiểm tra tuyến",
    description: "Vướng lỗi vận hành, vào tù ngay.",
    effect: { type: "goToJail" },
  },
  {
    slug: "small-grant",
    title: "Khoản hỗ trợ nhỏ",
    description: "Nhận 80K từ chương trình kích cầu.",
    effect: { type: "cash", amount: 80 },
  },
];

export const chanceCards = buildDeck("chance", chanceTemplates);
export const fortuneCards = buildDeck("fortune", fortuneTemplates);
export const allCards = [...chanceCards, ...fortuneCards];

function buildDeck(deck: DeckKind, templates: CardTemplate[]): DrawCard[] {
  const fixedCards = templates.filter((template) => template.effect.type === "getOutOfJailFree");
  const rotatingCards = templates.filter((template) => template.effect.type !== "getOutOfJailFree");

  return Array.from({ length: deckSize }, (_, index) => {
    const template =
      index < fixedCards.length
        ? fixedCards[index]
        : rotatingCards[(index - fixedCards.length) % rotatingCards.length];
    const number = index + 1;
    return {
      id: `${deck}-${template.slug}-${number}`,
      deck,
      number,
      title: template.title,
      description: template.description,
      effect: template.effect,
    };
  });
}
