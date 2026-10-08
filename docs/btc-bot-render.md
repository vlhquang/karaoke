# Hướng dẫn triển khai BTC Monitor trên Render

## 1. Tổng quan

Bot đã được bổ sung vào server của ứng dụng karaoke tại **https://vlhquang.onrender.com**, không cần tạo service riêng. Trang **https://vlhquang.github.io/coin/** dùng để đăng nhập, chọn chiến lược, theo dõi và bật/tắt bot.

Khi triển khai và bật thành công, bot chạy trên server: đóng trang hoặc đăng xuất không dừng bot. Muốn dừng, dùng nút **Dừng chiến lược**.

Hiện tại chỉ có **giao dịch mô phỏng**, phí 0,1% mỗi lệnh; chưa kết nối tài khoản sàn hoặc giao dịch bằng tiền thật. Tính năng server mặc định tắt cho đến khi đặt `BTC_BOT_ENABLED=true` và cung cấp credential Firebase hợp lệ.

## 2. Chuẩn bị Firebase

1. Vào https://console.firebase.google.com, chọn dự án **btc-monitor-ee8e5**.
2. Trong **Authentication → Sign-in method**, bật **Google**.
3. Trong **Authentication → Settings → Authorized domains**, thêm `vlhquang.github.io` nếu chưa có.
4. Trong **Firestore Database**, tạo database mặc định nếu chưa có.
5. Mở tab **Rules**, thay nội dung bằng file `/Users/quangvlh/work/coin/firestore.rules`, rồi bấm **Publish**.

Các quy tắc cho phép mỗi tài khoản đọc dữ liệu của chính mình. Khi dữ liệu được server quản lý, trình duyệt không được ghi đè dữ liệu bot. Collection nội bộ `btcBotJobs` không được truy cập trực tiếp từ trình duyệt.

### Tạo credential cho server

1. Bấm bánh răng trong Firebase, chọn **Project settings**.
2. Mở **Service accounts**.
3. Chọn **Generate new private key**, tải file JSON.
4. Dùng toàn bộ nội dung JSON cho biến môi trường `BTC_FIREBASE_SERVICE_ACCOUNT` trên Render.

**Không đưa khóa JSON lên GitHub hoặc vào `firebase-config.js`.** Đây là khóa riêng của server; cấu hình web `firebaseConfig` đã dùng để đăng nhập không thay thế được khóa này.

## 3. Cấu hình Render

Vào https://dashboard.render.com, chọn service đang phục vụ `vlhquang.onrender.com`, mở **Environment** và thêm:

| Biến môi trường | Giá trị | Ý nghĩa |
| --- | --- | --- |
| `BTC_BOT_ENABLED` | `true` | Bật API và worker BTC |
| `BTC_FIREBASE_PROJECT_ID` | `btc-monitor-ee8e5` | Dự án Firebase của BTC Monitor |
| `BTC_FIREBASE_SERVICE_ACCOUNT` | Toàn bộ nội dung JSON khóa riêng | Cho server xác thực và lưu dữ liệu |
| `BTC_ALLOWED_ORIGIN` | `https://vlhquang.github.io` | Domain giao diện; không thêm `/coin/` |
| `BTC_ALLOWED_UIDS` | UID tài khoản Firebase của bạn | Giới hạn tài khoản được sử dụng bot |

Lấy UID tại **Firebase → Authentication → Users → User UID** sau khi tài khoản đã đăng nhập Google ít nhất một lần. Đăng nhập thành công nhưng trang chưa tải được bot vẫn có thể đã tạo tài khoản trong Authentication.

Nhiều UID được phân cách bằng dấu phẩy. Nếu để trống `BTC_ALLOWED_UIDS`, mọi tài khoản Google đăng nhập vào dự án đều có thể chạy bot riêng; dữ liệu vẫn tách theo tài khoản.

Lưu các biến mới, giữ các biến karaoke đang dùng.

### Để chạy 24/7

File `render.yaml` hiện khai báo gói **Free**. Gói này có thể ngủ sau 15 phút không có truy cập từ bên ngoài. Bộ hẹn giờ trong server và các cuộc gọi Binance không bảo đảm service luôn hoạt động.

Cần instance trả phí luôn chạy để hoạt động liên tục. Code bổ sung không tự đổi gói hoặc tự nâng cấp dịch vụ của bạn. Xem https://render.com/docs/free.

## 4. Triển khai repository karaoke

Repository nằm tại `/Users/quangvlh/work/karaoke-portal/karaoke`.

Các file chính đã bổ sung/cập nhật:

- `apps/frontend/src/lib/btc-bot-engine.ts`: chiến lược, mua/bán, phí, chốt lời và cắt lỗ.
- `apps/frontend/src/lib/btc-bot-service.ts`: API được xác thực và worker nền.
- `apps/frontend/server.ts`: đăng ký BTC vào server hiện có.
- `apps/frontend/package.json`, `package-lock.json`: thư viện và lệnh kiểm thử.
- `.env.example`, `render.yaml`: các biến cấu hình mới.

Commit và push thay đổi vào nhánh mà Render đang theo dõi. Chờ tự triển khai hoặc dùng **Manual Deploy → Deploy latest commit**.

Sau khi triển khai, mở **Logs**, kiểm tra dòng:

```text
[btc-bot] Paper trading worker registered
```

Nếu thấy `Missing Firebase configuration` hoặc `Invalid service account`, kiểm tra biến môi trường và nội dung JSON. Credential thiếu/sai chỉ vô hiệu hóa phần BTC.

Lệnh kiểm tra local, chạy tại thư mục repository karaoke:

```sh
npm run test:btc-bot -w @karaoke/frontend
npm run build:server -w @karaoke/frontend
```

## 5. Cập nhật trang GitHub Pages

File giao diện nằm tại `/Users/quangvlh/work/coin`. Cập nhật bản mới của `firebase-config.js`, `auth.js`, `app.js`, `style.css` và các file giao diện liên quan vào repository coin.

Trong `firebase-config.js`, địa chỉ server đã được đặt:

```js
window.BTC_SERVER_URL = "https://vlhquang.onrender.com";
```

Chờ GitHub Pages triển khai xong rồi mở https://vlhquang.github.io/coin/. Nếu trang còn bản cũ, tải lại và bỏ qua bộ nhớ đệm trình duyệt.

Nên triển khai server trước khi cập nhật giao diện. Nếu API server chưa sẵn sàng, giao diện sẽ báo không tải được trạng thái thay vì tự chạy bot trong trình duyệt.

## 6. Kiểm tra hoạt động

1. Đăng nhập Google bằng tài khoản được cho phép.
2. Chọn chiến lược, nhập vốn, chốt lời và cắt lỗ.
3. Bấm **Áp dụng và chạy**.
4. Kiểm tra trạng thái **Server đang chạy**, tổng thời gian và điều kiện tín hiệu.
5. Đóng trang vài phút rồi mở lại. Kiểm tra dữ liệu và trạng thái còn giữ. Chỉ có giao dịch mới khi điều kiện chiến lược thực sự đạt.
6. Bấm **Dừng chiến lược** để dừng mọi lệnh tự động. BTC hiện có được giữ lại; chốt lời/cắt lỗ cũng dừng.
7. Bấm **Chạy lại** để tiếp tục chiến lược đã áp dụng.

Bot không cho đổi chiến lược khi còn vị thế tự động. **Đặt lại ví mô phỏng** sẽ xóa vị thế/lịch sử và dừng bot, nhưng giữ tổng thời gian chạy.

Lần chuyển từ bot trình duyệt sang bot server cần áp dụng chiến lược để bắt đầu job server; trạng thái đang chạy của phiên cũ không tự tạo job trên server.

## 7. Dữ liệu và thời gian chạy

- `btcBotJobs/{uid}` ghi danh sách tài khoản bật bot.
- `users/{uid}/private/portfolio` lưu ví, lịch sử, chiến lược, vị thế và thời gian chạy.
- Sau khởi động lại hoặc triển khai lại, worker đọc các job đã bật và tiếp tục chạy.
- Trình duyệt chỉ điều khiển/đọc dữ liệu, không tự giao dịch trong chế độ server.
- API xác thực token Google Firebase và dùng UID trong token để xác định dữ liệu, không tin UID gửi trong nội dung yêu cầu.
- Tổng thời gian cộng giữa các lần cập nhật worker; khoảng mất cập nhật từ 30 giây trở lên không được cộng. Không xử lý bù lệnh trong thời gian server ngừng.

## 8. Các API

Mọi API yêu cầu `Authorization: Bearer <Firebase ID token>`. Trang web tự gửi token sau đăng nhập.

| API | Chức năng |
| --- | --- |
| `GET /api/btc-bot/state` | Đọc dữ liệu riêng và trạng thái worker |
| `POST /api/btc-bot/start` | Áp dụng cấu hình và chạy bot |
| `POST /api/btc-bot/stop` | Dừng mua/bán, giữ vị thế |
| `POST /api/btc-bot/resume` | Chạy lại chiến lược đã áp dụng |
| `POST /api/btc-bot/reset` | Dừng và đặt lại ví mô phỏng |

Ví dụ nội dung gửi đến API `start`:

```json
{
  "rule": {
    "mode": "trend",
    "amount": 100,
    "takeProfit": 2,
    "stopLoss": 1,
    "buy": 0,
    "sell": 0
  }
}
```

`mode` nhận `trend`, `breakout`, `reversion` hoặc `threshold`. `buy` và `sell` dùng cho chiến lược ngưỡng giá cố định. Mở API trực tiếp không có token sẽ bị từ chối, không có nghĩa bot lỗi.

## 9. Lỗi thường gặp

| Hiện tượng | Kiểm tra |
| --- | --- |
| Bot server chưa sẵn sàng | Đã deploy và bật `BTC_BOT_ENABLED=true` chưa |
| Không đăng nhập Google được | Google đã bật, domain đã thêm và popup không bị chặn |
| Không đọc dữ liệu hoặc mất đồng bộ | Firestore đã tạo và quy tắc mới đã Publish chưa |
| Đăng nhập được nhưng API từ chối | UID có được cho phép và Firebase project có đúng không |
| `Invalid service account` | JSON có đầy đủ và `project_id` có khớp không |
| Chờ server lâu | Kiểm tra Logs, instance ngủ/khởi động lại và kết nối Binance/Firebase |
| Job chạy nhưng chưa giao dịch | Xem các điều kiện tín hiệu; bot không nhất thiết mua ngay |
| Không đổi chiến lược được | Vị thế BTC tự động có còn mở không |

## 10. Giới hạn hiện tại

- Worker lấy giá mỗi 5 giây khi có bot bật và nến 15 phút mỗi 30 giây. Các tài khoản dùng chung nguồn dữ liệu thị trường.
- Giao dịch nguyên tử Firestore tránh xử lý trùng và kiểm tra lại trạng thái khi có lệnh dừng đồng thời.
- Lịch sử vẫn nằm trong một document. Worker không ghi trạng thái vượt 800 KB; cần tách hoặc lưu trữ lịch sử trước khi chạy lâu với nhiều lệnh.
- Một tài khoản chạy liên tục ghi khoảng **17.280 document/ngày**, cộng thêm lượt đọc và đồng bộ giao diện. Nhiều tài khoản có thể vượt hạn mức Firebase; theo dõi Usage và chi phí.
- Các chiến lược chưa được xác nhận lợi nhuận; hiện chưa hỗ trợ giao dịch thật.
- Đã kiểm thử code và biên dịch server. Đăng nhập, phân quyền và hoạt động thực tế cần kiểm tra lại sau khi thêm credential và triển khai.
