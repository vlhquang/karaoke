# Portal Nhà mình — giao diện Liquid Glass sáng

## Phân tích và định hướng

Portal có 22 ứng dụng được mở từ trang chủ, 29 trang Next.js và 75 trang HTML đang phục vụ người dùng. Giao diện trước đây dùng nhiều hệ màu, cách điều hướng và kích thước điều khiển khác nhau: các trang Next.js chủ yếu tối, cờ tỷ phú và Vẽ vui có phong cách riêng, tài liệu Java và các trò chơi HTML dùng những bộ CSS độc lập. Việc chỉ đổi trang chủ không giải quyết được trải nghiệm khi người dùng đi vào từng ứng dụng.

Phong cách đã triển khai theo lựa chọn của người dùng: nền sáng xanh nhạt, tím và xanh bạc hà; bề mặt kính trắng, viền phản sáng mảnh, bóng mềm, điểm nhấn tím. Kính tập trung vào điều hướng và các bảng điều khiển. Nội dung dài, biểu mẫu và giấy vẽ có nền đủ đặc để đọc rõ. Cảnh 3D, video và đồng hồ HUD giữ bề mặt phù hợp với chức năng.

Ba nhóm giao diện được xử lý:

| Nhóm | Cách triển khai |
| --- | --- |
| Khám phá và trang mở đầu | Trang chủ mới; bố cục mới cho Karaoke, Lô tô và Học tập; thanh điều hướng chung và hộp tìm ứng dụng. |
| Biểu mẫu, danh sách và công cụ | Bề mặt, chữ, trạng thái, ô nhập và nút dùng token chung; thêm nhãn cho các biểu mẫu đăng nhập và Karaoke; thông tin kỹ thuật AI thu gọn trong mục có thể mở. |
| Trò chơi, bản đồ và tài liệu độc lập | Adapter CSS theo từng ứng dụng; bảo toàn bàn cờ, màu nét vẽ, canvas và cảnh chơi; 75 trang HTML nạp chung theme và điều hướng về portal. |

## Thay đổi trải nghiệm

- Trang chủ chia ứng dụng thành 5 nhóm; tìm kiếm không phân biệt dấu tiếng Việt; có trạng thái không tìm thấy và thao tác xóa từ khóa.
- Yêu thích và 6 ứng dụng mở gần nhất lưu trên thiết bị. Lịch sử chỉ chứa ID ứng dụng, không chứa mã phòng, mật khẩu hay vị trí.
- Nhóm đang chọn có địa chỉ `/?nhom=...`, giữ được khi tải lại trang.
- Tìm và mở ứng dụng bằng nút trên thanh điều hướng hoặc `Cmd/Ctrl + K`; đóng bằng Escape. Tìm kiếm trang chủ hỗ trợ phím `/` khi không nhập trong biểu mẫu.
- Các màn chơi toàn màn hình dùng thanh điều khiển riêng để dành không gian cho trò chơi.
- Lô tô giữ 6 lựa chọn màu; các theme Kim, Mộc, Thủy, Hỏa và Thổ có phiên bản sáng với nền kính và màu số rõ ràng.
- Điện thoại dùng nhóm ứng dụng cuộn ngang, lưới 2 cột; màn hình rất hẹp chuyển thẻ nổi bật thành 1 cột. Các thao tác chính và nút yêu thích có vùng chạm tối thiểu 44 px; ô nhập trên điện thoại dùng chữ 16 px.
- Java dùng cột nội dung co giãn, bảng và mã nguồn cuộn cục bộ; thanh điều hướng cuộn ngang. Biểu tượng Java Core dùng SVG cục bộ.
- Bảng khoa học dùng nút thật, trạng thái nhấn và nhãn cho các nút chỉ có biểu tượng. Bảng ẩn không nhận focus; dòng thời gian tránh đè lên bảng khám phá.
- Giảm chuyển động và giảm độ trong suốt theo thiết lập của thiết bị; có nền thay thế khi trình duyệt không hỗ trợ hiệu ứng kính.

Các thay đổi trước đó của Vẽ vui vẫn được giữ: kết quả lượt chờ chủ phòng nhấn chuyển tiếp; chia sẻ link/QR; ô đoán trên điện thoại; chặn phóng to trình duyệt bằng cảm ứng/double tap.

## Kiến trúc và phạm vi

- `apps/frontend/public/portal-tokens.css`: token ba lớp primitive → semantic → component; dùng chung cho Next.js và HTML.
- `apps/frontend/src/portal/catalog.ts`: danh mục ứng dụng, nhóm, tìm kiếm và đọc dữ liệu lưu trên thiết bị.
- `PortalFrame.tsx`: điều hướng chung, hộp tìm ứng dụng, ghi nhận truy cập gần đây.
- `PortalHome.tsx`, `SectionLanding.tsx`: giao diện khám phá và trang mở đầu.
- `portal.css`: bố cục và các thành phần mới.
- `portal-legacy.css`: chuyển giao diện các màn hình hiện có sang theme chung, có adapter riêng cho Vẽ vui, Cờ tỷ phú, Game Hub, HUD, mô phỏng và khoa học.
- `portal-ui.css`, `portal-ui.js`: theme và điều hướng cho 69 trang Java, 2 trang GPS, cổ phiếu HTML, lì xì HTML, thủ thành và đua xe.
- Cache GPS tăng phiên bản để thiết bị đã cài ứng dụng nhận theme mới; bỏ đường dẫn thư mục trả 404 khỏi danh sách precache.

Không thêm thư viện giao diện hay tài nguyên ảnh từ dịch vụ tạo ảnh. Các API nghiệp vụ, thuật toán giao dịch/thu chi và luật chơi không được thiết kế lại trong đợt thay đổi giao diện này.

## Kiểm tra và giới hạn

Lệnh kiểm tra:

```sh
npm run typecheck
npm run test:portal -w @karaoke/frontend
npm run test:ve-vui -w @karaoke/frontend
npm run build
```

Kiểm thử catalog bao gồm tìm tiếng Việt, tính hợp lệ của danh mục, định tuyến phòng và dữ liệu lưu bị hỏng/bị chặn. Kiểm tra trình duyệt gồm trang chủ, điều hướng, các trang mở đầu, biểu mẫu, các nhóm HTML và bảng điều khiển 3D ở desktop/điện thoại. Ảnh và báo cáo trình duyệt nằm trong thư mục `portal-glass` của phiên làm việc Codex.

Kết quả: typecheck và production build thành công; 4/4 kiểm thử portal và 19/19 kiểm thử Vẽ vui đạt. Kiểm tra trình duyệt xác nhận tìm kiếm tiếng Việt, yêu thích sau tải lại, bộ lọc qua URL, truy cập gần đây, focus/Escape và khôi phục cuộn khi đóng hộp tìm ứng dụng. Trang chủ được kiểm tra tại 320, 390, 768 và 1440 px. Các màn cổ phiếu và chi tiêu sau đăng nhập được kiểm tra tại 320, 390 và 1440 px; bộ lọc ngày trên điện thoại xếp dọc để đọc đầy đủ ngày tháng.

Vẽ vui đã chạy lại một trận hai người bằng thao tác cảm ứng: vẽ một ngón, chặn pinch/double tap của trình duyệt, nhập đáp án, bố cục ngang, chuyển lượt thủ công và bảng kết quả. Chia sẻ được kiểm tra sao chép link, đọc QR, sao chép PNG, tải PNG, vào phòng bằng lời mời và các phương án thay thế khi quyền clipboard bị chặn.

Bố cục sau đăng nhập của cổ phiếu và chi tiêu được kiểm tra bằng dữ liệu API mẫu trong trình duyệt; không gửi giao dịch đến tài khoản thật. GPS dùng tọa độ giả và bản Leaflet đã cài trong workspace để kiểm tra bố cục; không phát hành trình thật. Tile bản đồ từ nhà cung cấp ngoài vẫn phụ thuộc kết nối và quyền truy cập của nhà cung cấp. Các dịch vụ AI, YouTube, Drive, camera và định vị trên thiết bị thật cần kiểm tra tích hợp với cấu hình thực tế; kiểm tra giao diện không xác nhận các dịch vụ đó đã được cấu hình.

Phòng Karaoke và Lô tô được kiểm tra cả màn chủ phòng và người tham gia tại 320, 390 và 1440 px, không tràn ngang; 6 theme Lô tô được mở kiểm tra. Phiên kiểm tra dùng server cục bộ với thư viện Socket.IO đã cài trong workspace, tránh phụ thuộc CDN. Các tài nguyên cảnh 3D vẫn được tải từ nguồn ngoài như trước.

Kiểm tra Chrome mô phỏng kích thước và cảm ứng không thay thế được kiểm tra Safari trên iPhone thật. Đã giữ nền và chức năng scene 3D, không đổi bộ dựng hình của sản phẩm.

Khởi chạy tại workspace bằng `npm run dev`. Thay đổi hiện ở mã nguồn cục bộ, chưa triển khai lên môi trường công khai.
