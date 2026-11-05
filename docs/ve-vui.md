# Vẽ vui cùng nhà

Mở `/ve-vui` hoặc chọn **Thư viện trò chơi → Vẽ vui cùng nhà** trên portal. Game dùng chung tiến trình Next.js và namespace Socket.IO `/ve-vui`, không cần cài thêm dependency.

## Chơi thử

1. Chạy `npm run dev` từ gốc repository.
2. Nhập tên, tạo phòng, sao chép liên kết mời hoặc bấm **Mời người chơi** / biểu tượng QR để mở cửa sổ chia sẻ. Có thể quét QR, **Sao chép link**, **Sao chép ảnh QR** hoặc **Tải mã QR** dạng PNG để gửi. Nếu trình duyệt không hỗ trợ sao chép ảnh hoặc không cấp quyền, vẫn tải ảnh được; liên kết cũng có thể chọn và sao chép thủ công. Nút mời dùng được trong phòng chờ, khi chơi và cuối trận. Trên các thiết bị khác, mở liên kết bằng cùng địa chỉ máy chủ có thể truy cập qua mạng; `localhost` chỉ dùng trên máy chạy server.
3. Tất cả bấm **Mình đã sẵn sàng**, chủ phòng bấm **Bắt đầu cuộc vui**.
4. Mỗi người được chuẩn bị theo cấu hình 0/3/5/10/15 giây (mặc định 5 giây), có thể bấm **Vẽ ngay** để bắt đầu sớm, đổi đề một lần nếu kho đề còn đủ, rồi vẽ trong thời gian đã chọn. Chọn 0 giây thì vào vẽ ngay và không có bước đổi đề. Đề luôn chỉ gửi cho người đang vẽ.
5. Người vẽ duyệt các câu chưa khớp; hết giờ có tối đa 10 giây duyệt thêm. Màn kết quả lượt không đếm ngược và giữ nguyên đến khi chủ phòng bấm **Chuyển sang người tiếp theo** (hoặc **Xem kết quả trận** ở lượt cuối). Người vẽ có thể sửa quyết định trước khi chủ phòng chuyển lượt.
6. Cuối trận xem điểm, tải từng tranh PNG hoặc chơi tiếp với cùng thành viên và cài đặt.

Cấu hình khởi đầu: 2 vòng, 90 giây, chuẩn bị 5 giây, đề dễ, tất cả chủ đề, chấm kết hợp, bật gợi ý, tắt trò chuyện bằng micro. Hỗ trợ 2–8 người; người vào giữa trận xem và tham gia từ vòng kế tiếp. Khi chọn ít chủ đề và nhiều vòng, server yêu cầu đổi cài đặt nếu kho đề không đủ để tránh lặp đề.

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
- Dữ liệu nét vẽ dùng tọa độ 1000×650; chunk tối đa 64 điểm; giới hạn độ dài nét, số điểm/nét và nhịp thao tác trên server. Bút, tẩy, tô vùng, hoàn tác và xóa bảng đồng bộ cho mọi người. Tô vùng lưu mặt nạ pixel theo các đoạn trên từng hàng (không truyền ảnh PNG và không tô lại độc lập trên mỗi máy), kiểm tra phiên bản bảng và lượt vẽ trước khi nhận. Nhờ vậy phần màu được giữ khi khôi phục, xem triển lãm và tải PNG.
- Danh tính và token khôi phục lưu trong localStorage. Tải lại trang hoặc mạng chập chờn khôi phục điểm, tranh và vai trò trong cùng tiến trình server. Một phiên chỉ điều khiển bằng một cửa sổ tại một thời điểm; token khôi phục không công bố cho thành viên khác.
- Người vẽ mất kết nối: dừng đồng hồ tối đa 20 giây; quá hạn hủy lượt, không tính điểm. Chủ phòng mất kết nối: chuyển cho người kết nối sớm nhất còn lại. Chỉ còn một người đang tham gia vòng: tạm dừng.
- Chủ phòng có thể loại người lạ, yêu cầu nghỉ sau lượt và kết thúc trận có xác nhận ở giao diện. Người bị loại không thể dùng lại token cũ.
- Phòng không ai kết nối hết hạn sau 30 phút. Trạng thái nằm trong RAM, giống các game hiện tại: khởi động lại server sẽ mất phòng. Khi triển khai cần một instance luôn hoạt động; chưa có lưu trữ qua restart hoặc đồng bộ nhiều instance.

## Nhiều lần đoán và thông báo

Mỗi người có thể gửi một đáp án khác nhau sau mỗi 2 giây, cho đến khi được chấp nhận. Điểm gốc vẫn là 100–150 tùy tốc độ gửi, sau đó nhân theo lần thử của câu được chấp nhận: 100%, 90%, 80%, 70%, 60%, từ lần thứ 6 còn 50%, làm tròn về số nguyên. Ví dụ điểm gốc 140, đúng ở lần 3 nhận 112. Duyệt muộn hoặc sửa quyết định vẫn dùng thời gian và thứ tự của câu đó, không dùng số câu gửi thêm sau đó. Câu trùng sau khi chuẩn hóa, yêu cầu không hợp lệ, lỗi kết nối và gửi trong thời gian chờ không tăng số lần thử. Điểm đã tích lũy ở lượt trước không bị trừ.

Người gửi nhận thông báo nổi khi gửi thành công, được chấp nhận hoặc bị từ chối. Chỉ thông báo thành công sau khi máy chủ đã nhận. Người vẽ nhận thông báo câu mới và nút nổi có số đáp án chờ duyệt; chạm để mở bảng duyệt dạng dialog mà không cuộn khỏi tranh. Người còn lại chỉ nhận thông báo có người đoán đúng, không thấy nội dung đáp án trong thông báo. Các lần đồng bộ lại và kết quả AI đến sau không phát lại thông báo cũ. Ô nhập cho người đoán ghim đáy màn hình dọc, có nhãn lần thử và tỷ lệ điểm tiếp theo. Lỗi gửi vẫn giữ lại nội dung ô nhập.

## Tô vùng

Chọn **Tô vùng màu**, chọn màu rồi chạm vùng muốn tô. Bộ tô dùng ngưỡng sai khác màu 32/255 để nhận cả mép nét có khử răng cưa. Vùng hở có thể làm màu tràn ra ngoài; bấm **Hoàn tác thao tác vừa làm** để bỏ riêng lần tô. Chọn cỡ nét để trở về bút. Tô màu và nét bút cùng nằm trong lịch sử thao tác; hoàn tác, xóa bảng, khôi phục kết nối và tải tranh xử lý cùng một lịch sử.

## Trò chuyện bằng micro

Chủ phòng bật **Trò chuyện bằng micro** trong cài đặt phòng chờ. Từng người bấm **Tham gia trò chuyện** để nghe; micro vẫn tắt cho đến khi tự bấm **Bật micro** và cấp quyền. Có nút tắt/bật mic, tắt/bật tiếng nghe, rời phòng thoại, chỉ báo đang nói và thao tác tắt mic cả phòng cho chủ phòng. Người chơi tự bật lại mic nếu muốn phát biểu. Chấm điểm chỉ dựa trên đáp án gửi trong game, không nhận đáp án bằng giọng nói.

Danh sách người tham gia hiển thị trạng thái **Đang kết nối / Đã kết nối / Đang nối lại / Mất kết nối** cho từng đường truyền từ thiết bị của bạn. Số người đã tham gia tách biệt với số kết nối WebRTC đã thiết lập. Trạng thái kết nối không thay thế kiểm tra âm lượng loa, quyền phát âm thanh hoặc trạng thái mic của người ở đầu kia. Trên điện thoại khi đang chơi, thanh thoại ghim ở đầu màn hình khi cuộn; nút mic vẫn có nhãn chữ và kích thước chạm ít nhất 44px.

Mất kết nối âm thanh thoáng qua có khoảng chờ 1,5 giây trước khi phục hồi. Mỗi kết nối thử tối đa 3 lần, với khoảng chờ 12 giây sau khi gửi yêu cầu phục hồi; ứng dụng làm mới thông tin STUN/TURN và tạo lại thương lượng ICE, giữ nguyên trạng thái mic đã được người dùng chọn. Yêu cầu đến server có timeout riêng 8 giây. Tín hiệu có mã thương lượng để bỏ qua câu trả lời cũ. Hết số lần thử sẽ hiện **Kết nối lại** để người chơi chủ động thử tiếp. Hai đầu phối hợp để chỉ một đầu tạo offer, kể cả khi phục hồi, tránh cùng khởi tạo. Trở lại tab hoặc có mạng trở lại sẽ đánh thức quá trình phục hồi còn đang chờ; sau khi phiên game đã mất kết nối thì vẫn cần chủ động tham gia lại thoại.

Nếu bỏ qua hộp xin quyền micro, có thể bấm **Hủy mở micro** để tiếp tục chỉ nghe. Quyền được cấp sau khi đã hủy hoặc rời phòng sẽ không bật mic; track trả về muộn được dừng ngay. Tắt mic giữ track ở chế độ im lặng để bật lại nhanh; rời thoại dừng track hoàn toàn. **Tắt micro cả phòng** là thao tác tắt một lần, mọi người có thể tự bật lại; không phải khóa quyền phát biểu.

Âm thanh dùng WebRTC, Socket.IO chỉ chuyển thông tin thiết lập kết nối giữa những người đang ở cùng phòng và cùng phiên thoại. Không ghi âm hoặc lưu âm thanh. Rời phòng, bị loại, mở phiên ở cửa sổ khác, tắt chức năng thoại hoặc mất kết nối sẽ đóng các kết nối và dừng các track micro. Khi vào lại phòng cần chủ động tham gia lại thoại; không tự thu âm trở lại.

Micro yêu cầu HTTPS trên thiết bị thật; `localhost` được trình duyệt xem là môi trường phát triển an toàn. Quyền bị chặn, thiết bị không hỗ trợ hoặc trình duyệt chặn phát âm thanh đều có thông báo/thao tác xử lý trong giao diện.

STUN mặc định giúp thiết lập kết nối trực tiếp. Để chơi qua nhiều mạng Wi-Fi/4G có NAT hoặc tường lửa, cấu hình TURN riêng trên server:

```dotenv
DRAWING_VOICE_STUN_URLS=stun:stun.l.google.com:19302
DRAWING_VOICE_TURN_URLS=turn:relay.example.com:3478?transport=udp,turns:relay.example.com:5349?transport=tcp
DRAWING_VOICE_TURN_SECRET=your-coturn-shared-secret
```

Với coturn có shared secret, server tạo thông tin truy cập hạn 1 giờ cho người chơi đã vào phòng. Nếu nhà cung cấp dùng tài khoản cố định, bỏ `DRAWING_VOICE_TURN_SECRET` và đặt `DRAWING_VOICE_TURN_USERNAME`, `DRAWING_VOICE_TURN_PASSWORD`. `DRAWING_VOICE_ICE_SERVERS` nhận JSON `RTCIceServer[]` để thay toàn bộ cấu hình trên khi cần. Các biến này không dùng tiền tố `NEXT_PUBLIC_`; không đưa shared secret vào client. Khai báo biến không tự tạo máy chủ TURN; cần một dịch vụ relay đã hoạt động. Nếu thoại quá lâu/kết nối thất bại, rời rồi tham gia lại để nhận thông tin truy cập mới.

Mục TURN trong JSON cũng phải có `username` và `credential`. Khi thử nối lại, server cấp lại cấu hình qua `voice:ice` cho đúng người và đúng phiên thoại; không cần tạo lại danh tính thoại. Chủ phòng thấy lưu ý về khả năng kết nối khác mạng nếu chưa có TURN được cấu hình. Kiểm tra cấu hình không chứng minh dịch vụ relay truy cập được: sau khi khai báo, cần mở game bằng HTTPS trên hai thiết bị dùng Wi-Fi và 4G khác nhau, xác nhận âm thanh hai chiều và thử đổi mạng. Có thể dùng trang `chrome://webrtc-internals` để xác nhận cặp ICE sử dụng candidate loại `relay`. Không công khai trang chẩn đoán có chứa thông tin kết nối/tài khoản.

Phòng tối đa 8 người dùng các kết nối âm thanh trực tiếp giữa thành viên. Cần kiểm tra băng thông/hiệu năng trên thiết bị thật khi cả 8 người bật mic. Hướng dẫn nền tảng: [WebRTC/TURN](https://webrtc.org/getting-started/turn-server), [quyền micro](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia).

## Kiểm tra

```bash
npm run test:ve-vui -w @karaoke/frontend
npm run typecheck
npm run build
```

Kiểm thử gồm gameplay hết trận với thao tác chuyển lượt thủ công, kết quả không tự chuyển khi hết thời gian, quyền truy cập và che đáp án, dữ liệu nét vẽ, chống spam, điểm khi duyệt chậm, sửa kết quả, join giữa trận, mất mạng và khôi phục, rematch, cùng nhiều Socket.IO client thực chạy trên HTTP server tạm.

Kiểm thử mở rộng gồm cấu hình chuẩn bị và bắt đầu sớm, thời gian bằng 0, điểm theo số lần đoán (kể cả duyệt muộn), tô vùng kín/hở, mask không hợp lệ, phiên bản bảng đã cũ, hoàn tác màu và khôi phục tranh. Phần thoại có kiểm thử Socket.IO thật cho quyền vào phòng, chặn chuyển tín hiệu sang phòng khác, phiên thoại cũ, tắt mic cả phòng, vô hiệu hóa thoại, khôi phục và loại người chơi.

Kiểm thử phục hồi thoại mô phỏng ngắt ngắn, ICE thất bại kéo dài, hết 3 lần thử, thử lại từ cả đầu offer/answer, làm mới tài khoản TURN, giữ track mic khi nối lại, tín hiệu thương lượng cũ, và rời phòng khi yêu cầu làm mới còn đang chờ. Socket.IO kiểm tra quyền làm mới cấu hình và chuyển tín hiệu restart, chặn gói kết hợp sai kiểu hoặc sai phiên.

Kiểm tra trình duyệt dùng Chrome với nguồn micro giả, không thu micro thật của máy: kết nối WebRTC hai và ba người, nhận gói có năng lượng âm thanh ở cả sáu chiều của phòng ba người, chỉ báo đang nói, tắt tiếng nghe, quyền micro bị chặn, tắt mic cả phòng và giải phóng thiết bị khi rời phòng. Một trận hai người kiểm tra thao tác tô màu, hoàn tác, tải lại trang, gallery, nhiều lần thử và bảng duyệt trên điện thoại. Các kiểm tra kích thước/cảm ứng mô phỏng không thay thế kiểm tra Safari/iPhone thật. Chưa xác nhận kết nối TURN qua Wi-Fi/4G thực tế khi chưa có máy chủ relay được cấu hình.

Kiểm tra phòng đủ 8 người dùng 8 browser context độc lập: 28 cặp WebRTC, cả 56 chiều nhận gói có năng lượng âm thanh, trạng thái kết nối từng người, tắt mic cả phòng, giải phóng mic khi rời thoại và không tràn ngang ở chiều rộng 320px. Đây là kiểm tra chức năng trên cùng máy, không phải đo pin/hiệu năng của 8 điện thoại thật.
