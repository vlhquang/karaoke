# Chức năng Tải & Xem Phim (`/xem-phim`)

## Tổng quan

Cho phép nhập link video từ Bilibili.tv, YouTube và các nguồn được yt-dlp hỗ trợ → tải xuống → upload lên Google Drive cá nhân → xem online trực tiếp qua trình duyệt.

---

## Kiến trúc

```
Browser (SSE)
    ↕
Next.js App Router (API Routes)
    ↕                    ↕
yt-dlp (download)    Google Drive API (upload / stream)
    ↓
  /tmp/movies/         Google Drive Folder
```

- **Download**: `yt-dlp-wrap` tự tải binary yt-dlp, không cần cài hệ thống
- **Upload**: Google OAuth2 + refresh token (Drive cá nhân — không dùng service account vì không có quota)
- **Progress**: Server-Sent Events (SSE) realtime
- **In-memory state**: `globalThis.__movieJobStore` + `globalThis.__movieEmitter` để giữ state qua hot reload
- **Video seeking**: Proxy Range request → Drive API → 206 Partial Content

---

## Cài đặt

### 1. Biến môi trường

Thêm vào `.env`:

```env
GOOGLE_OAUTH_CLIENT_ID=your_client_id
GOOGLE_OAUTH_CLIENT_SECRET=your_client_secret
GOOGLE_REFRESH_TOKEN=your_refresh_token
GOOGLE_DRIVE_FOLDER_ID=your_folder_id
```

### 2. Lấy refresh token

```bash
node scripts/get-refresh-token.mjs
```

Script sẽ:
1. In ra URL để đăng nhập Google
2. Khởi động HTTP server trên port 4321 để nhận callback
3. In refresh token ra terminal sau khi xác thực

### 3. Google Cloud Console

- Tạo OAuth 2.0 Client (Desktop app)
- Thêm redirect URI: `http://localhost:4321/callback`
- Bật Google Drive API
- (Optional) Thêm test user nếu app ở chế độ Testing

---

## Cấu trúc file

```
apps/frontend/src/
├── app/
│   ├── xem-phim/
│   │   └── page.tsx              # UI chính
│   └── api/movies/
│       ├── queue/route.ts        # POST - thêm job tải
│       ├── jobs/route.ts         # GET - lấy danh sách jobs
│       ├── jobs/[id]/route.ts    # DELETE - xoá job khỏi history
│       ├── jobs/[id]/control/    # POST - pause/resume/cancel
│       │   └── route.ts
│       ├── progress/route.ts     # GET SSE - realtime progress
│       ├── formats/route.ts      # GET - lấy danh sách resolution
│       └── drive/
│           ├── files/route.ts    # GET - danh sách file Drive
│           ├── delete/[fileId]/  # DELETE - xoá file Drive
│           ├── rename/[fileId]/  # PATCH - đổi tên file Drive
│           └── stream/[fileId]/  # GET - stream video (Range support)
└── lib/movie/
    ├── job-store.ts              # In-memory job store + EventEmitter
    ├── download-service.ts       # Pipeline tải + upload
    ├── drive-service.ts          # Google Drive API wrapper
    └── yt-dlp-manager.ts         # Singleton yt-dlp binary
```

---

## API Routes

### `POST /api/movies/queue`
Thêm video vào hàng đợi tải.

```json
// Request
{ "url": "https://...", "name": "Tên phim tuỳ chọn", "resolution": 720 }

// Response
{ "ok": true, "jobId": "uuid" }
```

### `GET /api/movies/progress`
SSE stream. Gửi snapshot khi kết nối, sau đó push `job_update` event theo realtime.

```
event: message
data: {"type":"snapshot","jobs":[...]}

data: {"type":"job_update","job":{...}}
```

### `GET /api/movies/formats?url=...`
Lấy danh sách resolution có sẵn của video.

```json
// Response
{
  "ok": true,
  "title": "Tên video",
  "resolutions": [
    { "height": 1080, "label": "1080p", "formatId": "...", "filesize": 1234567 }
  ]
}
```

### `POST /api/movies/jobs/:id/control`
Điều khiển job đang chạy.

```json
// Request
{ "action": "pause" }   // tạm ngừng (chỉ khi đang download)
{ "action": "resume" }  // tiếp tục (chỉ khi đang paused)
{ "action": "cancel" }  // huỷ hoàn toàn
```

### `GET /api/movies/drive/stream/:fileId`
Stream video từ Drive với Range request support (cho phép tua video).

---

## Lifecycle của một Job

```
pending
  → downloading  (yt-dlp đang tải)
      ↓ pause       → paused → resume → downloading
      ↓ cancel      → cancelled
      ↓ done        
  → uploading    (upload lên Drive)
      ↓ cancel      → cancelled
      ↓ done
  → done
  → error        (có thể retry)
```

### Stage & màu sắc UI

| Stage | Nhãn | Màu |
|---|---|---|
| `pending` | Chờ xử lý | Xám |
| `downloading` | Đang tải phim | Cyan |
| `uploading` | Đang upload Drive | Tím |
| `done` | Hoàn thành | Xanh lá |
| `error` | Lỗi | Đỏ |
| `paused` | Tạm ngừng | Vàng amber |
| `cancelled` | Đã huỷ | Xám mờ |

---

## Tính năng UI

### Tải phim
- Nhập URL → **Lấy chất lượng** để xem các resolution có sẵn + dung lượng ước tính
- Chọn resolution (Tốt nhất / 1080p / 720p / ...) hoặc để auto
- Đặt tên phim tuỳ chọn (nếu để trống sẽ dùng tên gốc từ yt-dlp)
- Nhấn **Tải phim** → job được thêm vào hàng đợi

### Theo dõi tiến trình
- Section "Đang xử lý": hiển thị jobs đang chạy và paused
- Thanh progress riêng cho giai đoạn download và upload
- Hiển thị tốc độ tải và thời gian còn lại (ETA)

### Điều khiển tải
- ⏸ **Tạm ngừng**: chỉ khả dụng khi đang `downloading` — yt-dlp bị kill, file `.part` được giữ lại
- ▶ **Tiếp tục**: chỉ khả dụng khi `paused` — yt-dlp restart với flag `--continue`
- ⏹ **Huỷ**: khả dụng khi `downloading`, `uploading`, `paused` — xoá file tạm, không thể hoàn tác

### Lịch sử
- Hiển thị 10 dòng mỗi trang, lỗi hiện lên đầu
- **Thử lại**: gửi lại request với cùng URL + resolution
- **Xoá**: xoá khỏi history (không ảnh hưởng file Drive)

### Thư viện Drive
- **Dạng lưới**: thumbnail card, hover để thấy nút action
- **Dạng danh sách**: bảng với cột Tên, Dung lượng, Ngày upload; click tiêu đề cột để sắp xếp ↑↓
- **Tìm kiếm**: lọc theo tên phim (real-time)
- **Nhóm theo chất lượng**: các file cùng tên khác resolution được gộp thành 1 card (badge `720p`, `1080p`, ...)
- **Đổi tên inline**: click icon bút chì → input tên mới → Enter hoặc ✓
- **Xoá**: xác nhận trước khi xoá, hiển thị overlay loading

### Player
- Click card → mở video modal full width
- Chọn chất lượng: **Auto** (tự động theo tốc độ mạng), hoặc chọn thủ công
- Auto detect: `4g` → cao nhất, `3g` → ≤480p, `2g/slow-2g` → thấp nhất
- Giữ vị trí playback khi đổi chất lượng
- Hỗ trợ tua (Range request → Google Drive)

---

## Đặt tên file trên Drive

```
{Tên phim} [720p].mp4
{Tên phim} [1080p].mp4
{Tên phim}.mp4           ← khi không chọn resolution
```

UI parse pattern `[NNNp]` để nhóm file và hiển thị badge chất lượng.

---

## Ghi chú triển khai (Render free tier)

- Filesystem là **ephemeral** → file tải về chỉ tồn tại trong `/tmp` trong lúc upload
- Sau khi upload Drive xong, file tạm được xoá tự động
- `yt-dlp` binary tự tải về `apps/frontend/bin/yt-dlp` nếu chưa có
- Phải set 4 biến môi trường Google OAuth trên Render Dashboard

---

## Lưu ý kỹ thuật

### Tại sao OAuth2 thay vì Service Account?
Service Account không có storage quota trên Google Drive. Upload sẽ thất bại ở ~99% với lỗi _"Service Accounts do not have storage quota"_. OAuth2 với tài khoản cá nhân sử dụng quota Drive của người dùng (15GB free).

### Tại sao in-memory store thay vì database?
Render free tier không có persistent storage. In-memory phù hợp cho job tracking ngắn hạn. Sử dụng `globalThis` để tránh mất state khi Next.js hot reload.

### Tại sao pause hoạt động được?
yt-dlp lưu tiến trình download vào file `.part`. Khi pause (SIGTERM), file `.part` được giữ lại. Khi resume, yt-dlp restart với flag `--continue` và tìm file `.part` cùng tên để tiếp tục.

### TypeScript narrowing workaround
`cancelMode` dùng pattern `{ current: "none" | "pause" | "cancel" }` thay vì `let` variable vì TypeScript CFA (control flow analysis) narrow `let` variable thành `"none"` sau khi pass qua các `if-return` chains, mặc dù closure có thể thay đổi giá trị.
