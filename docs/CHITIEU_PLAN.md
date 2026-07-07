# Kế hoạch: Ứng dụng Quản lý Chi tiêu (tích hợp vào portal-karaoke)

> Mục tiêu: tích hợp mini-app quản lý thu/chi vào monorepo Next.js hiện tại, lưu dữ liệu vào một Google Sheet có sẵn (dùng Google Apps Script Web App, cùng pattern với `co-phieu`).

---

## 1. Tổng quan & mục tiêu

Tính năng quản lý chi tiêu cá nhân với luồng:

1. Nhập số tiền → hệ thống gợi ý nhanh các mức (vd nhập `1` → `1.000, 10.000, 100.000`; nhập `15` → `1.500, 15.000, 150.000`).
2. Chọn giao dịch **Thu** hoặc **Chi**.
3. Chọn **mục lục** (category) cho loại đó:
   - Gõ sẽ hiện gợi nhớ (autocomplete) từ các mục đã có để chọn nhanh.
   - Nếu nhập mục chưa tồn tại → **tự thêm mới** vào Sheet.
   - Mỗi mục lục được **tự phân bổ màu** (đồng bộ giữa các thiết bị).
4. Giao diện **tổng hợp thu/chi**:
   - Chọn từ ngày đến ngày.
   - Nhanh: "Tháng này", "Tháng trước".
   - Hoặc cấu hình chu kỳ theo ngày nhận lương (vd ngày 5 hàng tháng).

---

## 2. Quy ước tích hợp (bám sát repo)

- **Kiến trúc (giống `co-phieu`)**:

```
Google Sheet (có sẵn)
   └─ Apps Script Web App  ──>  CHITIEU_APPS_SCRIPT_URL
                                        │
                            apps/frontend/src/app/api/chi-tieu/route.ts  (proxy)
                                        │
                            apps/frontend/src/app/chi-tieu/page.tsx  (UI + cache localStorage)
```

- Không thêm DB/service account. Next.js chỉ làm proxy đến Apps Script (`process.env.CHITIEU_APPS_SCRIPT_URL`), y hệt `apps/frontend/src/app/api/stocks/route.ts` (đọc `STOCK_APPS_SCRIPT_URL`).
- UI: Next.js App Router, client component `"use client"`, Tailwind (đã có). State client dùng **Zustand** (`zustand ^5.0.2` đã có) làm cache + draft + accessCode.
- Route mới: `apps/frontend/src/app/chi-tieu/page.tsx`. Thêm mục menu `/chi-tieu` vào `apps/frontend/src/app/page.tsx`.

---

## 3. Cấu trúc Google Sheet (3 tab trong sheet có sẵn)

Apps Script tự tạo tab nếu chưa có (`ensureSheets()`), nên sheet "có sẵn" chỉ cần được mở bằng Apps Script.

- **transactions**: `id | loai | category | soTien | note | createdAt`
  - `loai`: `"thu"` | `"chi"`
  - `category`: tên mục lục (vd "Ăn uống", "Lương")
  - `soTien`: số (VNĐ)
  - `createdAt`: ISO string
- **categories**: `ten | loai | mau`  ← lưu mục lục + màu để đồng bộ đa thiết bị
- **config**: `key | value` (có `ACCESS_CODE`, `SALARY_DAY`)

---

## 4. API actions (trong `docs/CHITIEU_APPS_SCRIPT.gs`)

Copy mẫu `docs/STOCK_APPS_SCRIPT.gs`, đổi tên sheet + action:

- `login` – kiểm tra `accessCode` (đọc từ `config!ACCESS_CODE`)
- `add` – thêm transaction; nếu `category` chưa có trong `categories` → **tự tạo mới** + gán `mau` (hash tên → palette tối)
- `upsert_category` – đảm bảo mục lục tồn tại (dùng khi gõ tay)
- `list` – trả transactions (mới nhất trước)
- `list_categories` – trả danh sách mục lục (phục vụ gợi nhớ/autocomplete)
- `update` / `delete` – sửa/xoá transaction
- `get_config` / `save_config` – lưu `SALARY_DAY` (ngày nhận lương)

Pattern xác thực: `isValidAccessCode(payload.accessCode)` như trong STOCK script; `doPost` trả `jsonResponse({ ok, data/message })`.

---

## 5. Mô hình dữ liệu (client `store.ts`)

```ts
type Loai = "thu" | "chi";

interface Category { ten: string; loai: Loai; mau: string; } // mau = hex tự sinh bên Apps Script

interface Transaction {
  id: number;
  loai: Loai;
  category: string;
  soTien: number;
  note?: string;
  createdAt: string; // ISO
}

interface Settings { salaryDay: number; } // 1-28

interface ChiTieuState {
  accessCode: string;
  transactions: Transaction[];
  categories: Category[];
  settings: Settings;
  // actions gọi API + cập nhật cache
  loadAll(): Promise<void>;
  addTransaction(input): Promise<void>;
  upsertCategory(ten, loai): Promise<void>;
  setSettings(s): Promise<void>;
}
```

- `accessCode` và cache lưu `localStorage` (key `chitieu_access_code`, `chitieu_cache_v1`).
- Source of truth là Sheet; client cache để hiển thị nhanh + offline mượt.

---

## 6. Logic gợi ý số tiền (`lib/suggest.ts`)

Quy tắc suy ra từ ví dụ: **ghép chuỗi số vừa gõ với 3, 4, 5 chữ số 0**.

- `"1"` + `"000"/"0000"/"00000"` → `1.000, 10.000, 100.000` ✓
- `"15"` + `"000"/"0000"/"00000"` → `1.500, 15.000, 150.000` ✓

```ts
function suggestAmounts(raw: string): number[] {
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return [];
  return [3, 4, 5].map((z) => Number(digits + "0".repeat(z)));
}
```

`AmountInput` hiển thị 3 chip gợi ý; bấm vào đổ giá trị vào ô.

---

## 7. Luồng nhập giao dịch (`TransactionForm`)

1. Nhập số tiền → hiện 3 chip gợi ý (mục 6).
2. Chọn **Thu** / **Chi** (2 nút lớn, style giống chọn vai trò trong `li-xi-nang-cao`).
3. Chọn/nhập **mục lục** (category) cho loại đó → xem mục 8.
4. (Tuỳ chọn) ghi chú → bấm "Lưu" → gọi API `add` (tự upsert category nếu mới).

---

## 8. Mục lục + gợi nhớ + màu tự động (`CategorySelect`)

- Ô nhập có **autocomplete**: khi gõ, lọc `categories` theo `loai` đang chọn và hiện gợi ý nhanh (gợi nhớ) để chọn mục đã có.
- Nếu nhập tên chưa tồn tại → **tự tạo mới** (`upsert_category`/`add`): gán `loai`, và **tự phân bổ màu** qua Apps Script (hash tên → palette tối thân thiện, ổn định giữa thiết bị).
- Mỗi chip/mục lục hiển thị với màu nền riêng (đọc từ `mau`) để phân biệt Thu/Chi và từng mục.

---

## 9. Tổng hợp thu/chi (`SummaryReport` + `DateRangePicker`)

- Bộ lọc ngày: **chọn từ–đến** (input type=date) + nút nhanh **"Tháng này"**, **"Tháng trước"**.
- **Cấu hình chu kỳ lương** (`Settings.salaryDay`) trong tab Cài đặt:
  - Nút "Kỳ lương này" lọc từ `salaryDay` tháng trước → `salaryDay - 1` tháng này.
  - Xử lý sang tháng, ngày 29-31 clamp về cuối tháng.
- Hiển thị: tổng Thu, tổng Chi, chênh lệch; bảng/nhóm theo mục lục (màu theo category); danh sách giao dịch đã lọc.
- Có thể thêm thanh tỷ lệ Thu/Chi đơn giản bằng Tailwind.

---

## 10. Cấu trúc file đề xuất

```
docs/CHITIEU_APPS_SCRIPT.gs                       # code Apps Script (mới)
docs/CHITIEU_PLAN.md                              # file kế hoạch này
.env.example (root)                               # thêm CHITIEU_APPS_SCRIPT_URL=, CHITIEU_ACCESS_CODE=
apps/frontend/src/app/api/chi-tieu/route.ts       # proxy (copy api/stocks/route.ts)
apps/frontend/src/app/chi-tieu/page.tsx           # Tab: Nhập / Tổng hợp / Cài đặt
apps/frontend/src/chi-tieu/store.ts               # Zustand store + localStorage cache
apps/frontend/src/chi-tieu/lib/suggest.ts         # gợi ý số tiền
apps/frontend/src/chi-tieu/lib/format.ts          # định dạng tiền/ngày (vi-VN)
apps/frontend/src/chi-tieu/lib/color.ts           # helper palette (dự phòng client)
apps/frontend/src/chi-tieu/components/AmountInput.tsx
apps/frontend/src/chi-tieu/components/CategorySelect.tsx
apps/frontend/src/chi-tieu/components/TransactionForm.tsx
apps/frontend/src/chi-tieu/components/SummaryReport.tsx
apps/frontend/src/chi-tieu/components/DateRangePicker.tsx
apps/frontend/src/app/page.tsx                    # thêm menu "/chi-tieu"
```

---

## 11. Thứ tự triển khai

1. Viết `docs/CHITIEU_APPS_SCRIPT.gs` (ensureSheets + actions).
2. Tạo `apps/frontend/src/app/api/chi-tieu/route.ts` + thêm env `.env.example`.
3. `store.ts` + `lib/*` + components nhập (AmountInput / CategorySelect / TransactionForm).
4. `SummaryReport` + `DateRangePicker` + tab Tổng hợp / Cài đặt.
5. Thêm menu `page.tsx`, chạy `npm run lint` & `npm run typecheck`.

---

## 12. Điểm cần xác nhận (open questions)

- **Sheet có sẵn**: mở sheet đó → Extensions → Apps Script → dán code → Deploy "Anyone" → đưa URL vào `CHITIEU_APPS_SCRIPT_URL`? (khuyên dùng 1 script riêng, không dùng chung với STOCK).
- **Mã truy cập**: dùng `CHITIEU_ACCESS_CODE` riêng (vd `"1234"`) ghi vào `config!ACCESS_CODE`, client nhập 1 lần rồi lưu `localStorage`?
- **Đơn vị**: VNĐ, định dạng `1.000` (dấu chấm) – đúng không?

---

## 13. Tham khảo (file hiện có)

- Mẫu Apps Script: `docs/STOCK_APPS_SCRIPT.gs`
- Proxy route: `apps/frontend/src/app/api/stocks/route.ts`
- Client mẫu dùng Sheet: `apps/frontend/src/app/co-phieu/page.tsx`
- Env mẫu: `.env.example` (root) — `STOCK_APPS_SCRIPT_URL`, `STOCK_ACCESS_CODE`
- Hướng dẫn deploy: `docs/STOCK_DEPLOY_GUIDE.md`
