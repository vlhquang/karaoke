# Vẽ vui cùng nhà

Mở `/ve-vui` hoặc chọn **Thư viện trò chơi → Vẽ vui cùng nhà** trên portal. Game dùng chung tiến trình Next.js và namespace Socket.IO `/ve-vui`, không cần cài thêm dependency.

## Chơi thử

1. Chạy `npm run dev` từ gốc repository.
2. Nhập tên, tạo phòng, sao chép liên kết mời hoặc bấm **Mời người chơi** / biểu tượng QR để mở cửa sổ chia sẻ. Có thể quét QR, **Sao chép link**, **Sao chép ảnh QR** hoặc **Tải mã QR** dạng PNG để gửi. Nếu trình duyệt không hỗ trợ sao chép ảnh hoặc không cấp quyền, vẫn tải ảnh được; liên kết cũng có thể chọn và sao chép thủ công. Nút mời dùng được trong phòng chờ, khi chơi và cuối trận. Trên các thiết bị khác, mở liên kết bằng cùng địa chỉ máy chủ có thể truy cập qua mạng; `localhost` chỉ dùng trên máy chạy server.
3. Tất cả bấm **Mình đã sẵn sàng**, chủ phòng bấm **Bắt đầu cuộc vui**.
4. Mỗi người được chuẩn bị 10 giây, đổi đề một lần nếu kho đề còn đủ, rồi vẽ trong thời gian đã chọn. Đề luôn chỉ gửi cho người đang vẽ.
5. Người vẽ duyệt các câu chưa khớp; hết giờ có tối đa 10 giây duyệt thêm. Màn kết quả lượt không đếm ngược và giữ nguyên đến khi chủ phòng bấm **Chuyển sang người tiếp theo** (hoặc **Xem kết quả trận** ở lượt cuối). Người vẽ có thể sửa quyết định trước khi chủ phòng chuyển lượt.
6. Cuối trận xem điểm, tải từng tranh PNG hoặc chơi tiếp với cùng thành viên và cài đặt.

Cấu hình khởi đầu: 2 vòng, 90 giây, đề dễ, tất cả chủ đề, chấm kết hợp, bật gợi ý. Hỗ trợ 2–8 người; người vào giữa trận xem và tham gia từ vòng kế tiếp. Khi chọn ít chủ đề và nhiều vòng, server yêu cầu đổi cài đặt nếu kho đề không đủ để tránh lặp đề.

## Chấm đáp án và AI

Luật khớp chạy trên server: không phân biệt dấu tiếng Việt/hoa thường/dấu câu/khoảng trắng; dùng từ đồng nghĩa và tên vùng miền đã khai báo; chỉ bỏ một từ loại `cái`, `chiếc`, `con` ở đầu câu đoán nếu phần còn lại khớp một đáp án/cách gọi đã biết. Không dùng phần trăm để tự cộng điểm.

Khi chưa cấu hình AI, người vẽ thấy **so sánh ký tự tại máy chủ; chưa đánh giá ngữ nghĩa**. Đây là hỗ trợ lỗi gõ đơn giản, không giả làm AI. Tất cả câu chưa khớp vẫn hiện ngay để duyệt thủ công.

Để dùng OpenAI trực tiếp, bật provider và cấu hình key ở server (không cần tạo dịch vụ trung gian):

```dotenv
DRAWING_AI_PROVIDER=openai
OPENAI_API_KEY=your-api-key
OPENAI_MODEL=gpt-4.1-mini
```

`DRAWING_AI_MODEL` có thể ghi đè model riêng cho game; nếu bỏ trống thì dùng model OpenAI hiện có của portal. Chỉ khi bật provider mới gọi AI. Tích hợp dùng Responses API với JSON Schema theo [tài liệu OpenAI chính thức](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses), tắt lưu response với `store: false`. Tích hợp được kiểm thử bằng response giả; chưa gọi model thật để hiệu chỉnh chất lượng đánh giá.

Hoặc dùng dịch vụ ngữ nghĩa riêng:

```dotenv
DRAWING_AI_PROVIDER=custom
DRAWING_AI_URL=https://your-private-service.example/similarity
DRAWING_AI_KEY=your-service-key
```

Server gửi `POST` với `Content-Type: application/json` và, nếu có key, `Authorization: Bearer <key>`:

```json
{"answer":"xe đạp","guess":"xe hai bánh","category":"Phương tiện","aliases":[]}
```

Dịch vụ trả về:

```json
{"percent":78,"explanation":"Đúng đặc điểm nhưng chưa xác định loại xe."}
```

Phần trăm được giới hạn 0–99 cho câu không khớp luật. Đó là mức tương đồng, không phải xác suất đúng. Timeout 4 giây, lỗi HTTP hay dữ liệu không hợp lệ đều giữ gợi ý ký tự và quyền duyệt thủ công. Kết quả đến sau quyết định duyệt, sau lượt hoặc sau trận không thay đổi kết quả. Key và đáp án không đưa vào bundle client hay snapshot của người đoán. Các kiểm thử dùng dịch vụ giả, không gọi dịch vụ tính phí.

## Đồng bộ và phục hồi

Giao diện điện thoại giữ bảng vẽ ở trên, phần đoán/duyệt ngay bên dưới và thứ tự vẽ sau đó. Khi đang đoán trên màn hình dọc, ô nhập và nút gửi ghim ở cuối màn hình, có bù phần bàn phím và vùng an toàn của thiết bị. Bảng màu có hai hàng, các nút công cụ đủ lớn để chạm. Trang game khóa phóng to bằng chụm hai ngón tay và chạm đúp; ô nhập dùng cỡ chữ tối thiểu 16px trên điện thoại để tránh tự phóng to khi nhập. Bảng vẽ chỉ nhận ngón tay chính, bỏ qua các ngón tay chạm thêm.

- Server giữ đồng hồ chính, điểm và quyền thao tác. Bonus tốc độ dựa trên thời gian chơi đã trôi qua lúc gửi câu được nhận, kể cả khi duyệt muộn hoặc có tạm dừng vì mất kết nối.
- Dữ liệu nét vẽ dùng tọa độ 1000×650; chunk tối đa 64 điểm; giới hạn độ dài nét, số điểm/nét và nhịp thao tác trên server. Bút, tẩy, hoàn tác và xóa bảng đồng bộ cho mọi người.
- Danh tính và token khôi phục lưu trong localStorage. Tải lại trang hoặc mạng chập chờn khôi phục điểm, tranh và vai trò trong cùng tiến trình server. Một phiên chỉ điều khiển bằng một cửa sổ tại một thời điểm; token khôi phục không công bố cho thành viên khác.
- Người vẽ mất kết nối: dừng đồng hồ tối đa 20 giây; quá hạn hủy lượt, không tính điểm. Chủ phòng mất kết nối: chuyển cho người kết nối sớm nhất còn lại. Chỉ còn một người đang tham gia vòng: tạm dừng.
- Chủ phòng có thể loại người lạ, yêu cầu nghỉ sau lượt và kết thúc trận có xác nhận ở giao diện. Người bị loại không thể dùng lại token cũ.
- Phòng không ai kết nối hết hạn sau 30 phút. Trạng thái nằm trong RAM, giống các game hiện tại: khởi động lại server sẽ mất phòng. Khi triển khai cần một instance luôn hoạt động; chưa có lưu trữ qua restart hoặc đồng bộ nhiều instance.

## Kiểm tra

```bash
npm run test:ve-vui -w @karaoke/frontend
npm run typecheck
npm run build
```

Kiểm thử gồm gameplay hết trận với thao tác chuyển lượt thủ công, kết quả không tự chuyển khi hết thời gian, quyền truy cập và che đáp án, dữ liệu nét vẽ, chống spam, điểm khi duyệt chậm, sửa kết quả, join giữa trận, mất mạng và khôi phục, rematch, cùng nhiều Socket.IO client thực chạy trên HTTP server tạm.
