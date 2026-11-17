# Bản đồ phong thuỷ

Ứng dụng nằm tại `/phong-thuy`, trong nhóm **Tiện ích mỗi ngày** của portal. Chạy ứng dụng như bình thường bằng `npm run dev`.

## Sử dụng

1. Nhập tên địa điểm hoặc địa chỉ (ví dụ **Chợ Bến Thành**, tên đường kèm phường/xã, tỉnh/thành phố), nhấn Enter hoặc nút tìm kiếm rồi chọn một kết quả. Cũng có thể nhập `vĩ độ, kinh độ`, di chuyển/phóng to bản đồ hoặc dùng **Vị trí của tôi**. Định vị cần quyền trình duyệt và HTTPS hoặc localhost. Kết quả đã chọn được đánh dấu bằng chấm đỏ và tên trên bản đồ. Thẻ **Khu vực tại tâm bản đồ** hiển thị địa danh gần tâm và cập nhật khi di chuyển; đây là địa điểm tham chiếu gần đó, không khẳng định địa chỉ chính xác của khu đất. Nền vệ tinh có thêm lớp tên đường và địa danh để đối chiếu vị trí.
2. Chọn **La bàn** và chạm bản đồ để đặt. Công cụ giữ hoạt động để đặt nhiều la bàn; nhấn **Xong** hoặc **Chọn / di chuyển** để kéo các la bàn. Mỗi la bàn có bán kính theo mét, độ rõ, hướng tham chiếu và tên riêng. Nhập góc tham chiếu để mũi tên tím thay đổi ngay khi đang gõ, gồm cả góc thập phân. Bật **Hiện mũi tên đối hướng (180°)** để thêm mũi tên màu cam quay ngược hướng tham chiếu; góc đối hướng bằng `(góc tham chiếu + 180) mod 360` và cập nhật cùng lúc. Lựa chọn này được lưu riêng cho từng la bàn. Vành hướng luôn theo Bắc địa lý; hướng tham chiếu không xoay các hướng địa lý.
3. Chọn **Nhà** để đặt nhà chữ nhật. Trong bảng bên cạnh, nhập chiều ngang, chiều sâu bằng mét và hướng mặt tiền. Nút **Theo hướng la bàn gần nhất** lấy hướng tham chiếu của la bàn gần tâm nhà nhất.
4. Chọn **Chữ nhật** để vẽ một hình chữ nhật bất kỳ: chạm góc đầu, chạm đầu còn lại của cạnh thứ nhất, rồi chạm về phía cần mở rộng để xác định độ sâu. Cạnh đầu có thể nằm ngang, dọc hoặc xéo; hình xem trước giữ các góc vuông khi di chuyển chuột. Điểm thứ ba được chiếu vuông góc với cạnh đầu. Chạm điểm thứ ba để hoàn tất. Trong thuộc tính, chọn **Ngang**, **Dọc**, **Xéo 45°** hoặc nhập **Góc xoay (°)** bất kỳ; hình xoay ngay khi gõ. 0° là cạnh ngang nằm ngang trên bản đồ, góc tăng theo chiều kim đồng hồ. Có thể nhập chiều ngang/chiều sâu theo mét và kéo tay nắm tâm để di chuyển cả hình. Hình và nét vẽ dở được tự lưu; hỗ trợ đổi tên, khoá, xoá, ẩn nhãn, hoàn tác và xuất/nhập như các đối tượng khác.
5. Hoặc chọn **Vẽ nhà**, chạm lần lượt các góc rồi **Hoàn tất**. Khi chọn nhà, kéo tay nắm tâm để dời cả nhà; với phác thảo tự do, kéo từng đỉnh để sửa hình. Các cạnh không được tự cắt nhau. Kích thước cạnh và diện tích được tính từ toạ độ, không phụ thuộc mức zoom.
6. Chọn **Cửa chính**: chạm vị trí cửa, sau đó chạm phía ngoài nhà để vẽ hướng từ cửa nhìn ra. Chọn **Bếp**: chạm vị trí bếp rồi chạm về phía lưng người đứng nấu, theo quy ước ghi trên giao diện. Có thể sửa góc bằng số hoặc kéo đầu mũi tên.
7. Chọn **Lối vào**, chạm theo thứ tự từ ngoài đường đến nhà rồi **Hoàn tất**. Bảng thuộc tính hiển thị độ dài tổng và hướng từng đoạn. Có thể kéo từng điểm hoặc dời toàn bộ tuyến.

Chọn đối tượng trên bản đồ hoặc trong **Các lớp bản vẽ** để đổi tên, chỉnh thuộc tính, tìm lại trên bản đồ, khoá hay xoá. Mục **Toạ độ & di chuyển chính xác** hỗ trợ nhập tâm hoặc từng đỉnh bằng bàn phím. Đối tượng khoá cần được mở khoá trước khi chỉnh hoặc xoá. **Hoàn tác / Làm lại** lưu tối đa 40 bước thao tác đối tượng; khi đang vẽ, Hoàn tác bỏ điểm cuối. Phím Escape huỷ nét đang vẽ.

## Lưu trữ

- Bản vẽ tự lưu ngay sau mỗi thay đổi vào `localStorage` với khoá `phong-thuy.plan.v1`, bao gồm các đối tượng, nét đang vẽ chưa hoàn tất, công cụ đang chọn, vị trí bản đồ, nền và lựa chọn ẩn/hiện nhãn. Đóng trang hoặc tải lại sẽ khôi phục cả nét đang vẽ. Dữ liệu không có hạn sử dụng và được giữ đến khi xoá dữ liệu trang hoặc dùng chức năng xoá trong ứng dụng. Trạng thái lưu hiển thị trên đầu trang; nếu trình duyệt chặn hoặc hết dung lượng, có thể tiếp tục và xuất tệp.
- Trong **Bản vẽ của bạn → Hiển thị nhãn**, bật/tắt riêng **Nhãn đường / địa danh (vệ tinh)** và **Nhãn đối tượng / kích thước**. Nhãn của nền đường phố OpenStreetMap là một phần của ảnh nền và vẫn hiện; tuỳ chọn nhãn địa danh điều khiển các lớp nhãn bổ sung trên nền vệ tinh và tên địa điểm đã chọn. Vành hướng của la bàn vẫn hiện để đọc hướng khi ẩn nhãn đối tượng.
- **Bộ nhớ trình duyệt → Xoá bộ nhớ bản vẽ** mở hộp xác nhận. Xác nhận sẽ xoá tất cả đối tượng, nét chưa hoàn tất, lịch sử hoàn tác và tuỳ chọn nhãn đã lưu của ứng dụng phong thuỷ trên thiết bị này. Không xoá dữ liệu ứng dụng khác. Bộ nhớ chỉ được tạo lại khi bạn bắt đầu chỉnh sửa tiếp; thao tác xoá này không thể hoàn tác.
- **Xuất bản vẽ** tạo tệp JSON. **Nhập tệp** kiểm tra phiên bản, toạ độ, kích thước và hình học, sau đó thêm đối tượng với ID mới vào bản vẽ hiện tại. Khi bản vẽ hiện tại trống, lấy tên và nền bản đồ của tệp. Không tự thay thế các đối tượng đang có.
- Tối đa 300 đối tượng, 100 điểm mỗi phác thảo/lối đi, tệp nhập tối đa 2 MB. Phạm vi vĩ độ từ −80 đến 80; kinh độ từ −180 đến 180.
- Bản lưu không đồng bộ lên máy chủ. Nên xuất tệp để chuyển thiết bị hoặc giữ bản sao. Nền bản đồ cần kết nối Internet.

## Hướng và tỉ lệ

0° là Bắc, 90° Đông, 180° Nam và 270° Tây, góc tăng theo chiều kim đồng hồ. Góc phương vị, khoảng cách và điểm đến dùng mô hình cầu bán kính trung bình 6.371.008,8 m; diện tích phác thảo dùng phép chiếu tiếp tuyến cục bộ. Đây là công cụ phác thảo bố trí ở quy mô khu đất/nhà, chưa luận cát hung theo tuổi/mệnh hoặc thực hiện đo đạc địa chính. Bắc địa lý có thể khác Bắc từ tính của la bàn cầm tay.

Không cần API key hoặc thư viện mới. Tận dụng Leaflet, React Leaflet, Lucide và Zod đã có. Bản đồ tải ở phía client để không truy cập DOM khi render server. Tìm tên địa điểm và nhận diện khu vực dùng Photon/OpenStreetMap qua `/api/phong-thuy/places`. Tìm kiếm chỉ gửi khi nhấn Enter/nút tìm; nhận diện tâm bản đồ đợi dừng di chuyển 1 giây và tái sử dụng kết quả khi tâm dịch dưới 40 m. Máy chủ giới hạn nhịp gửi lên dịch vụ, gộp yêu cầu trùng, lưu đệm 10 phút (tối đa 200 truy vấn), giới hạn hàng chờ và thời gian chờ 8 giây. Có thể cấu hình `PHONG_THUY_GEOCODER_URL` cho một máy chủ Photon riêng; dịch vụ công cộng phù hợp lưu lượng vừa phải, có thể giới hạn hoặc ngừng cung cấp. Khi lỗi, vẫn có thể điều hướng bằng toạ độ và chỉnh bản vẽ. Xem [Photon API và chính sách máy chủ công cộng](https://github.com/komoot/photon).

Nguồn và tài liệu: [Leaflet 1.9.4](https://leafletjs.com/reference-1.9.4.html), [chính sách tile OpenStreetMap](https://operations.osmfoundation.org/policies/tiles/), [Esri World Imagery](https://doc.arcgis.com/en/data-appliance/2025/maps/world-imagery.htm). Thông tin bản quyền luôn hiển thị trên bản đồ. Chỉ tải tile đang xem theo cơ chế bộ nhớ đệm của trình duyệt, không tải hàng loạt hoặc prefetch bản đồ.

## Kiểm tra

```sh
npm run test:phong-thuy -w @karaoke/frontend
npm run test:portal -w @karaoke/frontend
npm run typecheck
npm run build
```

Kiểm thử hình học bao gồm hướng và ranh giới cung Bắc, khoảng cách, cạnh/diện tích nhà ở nhiều vĩ độ, di chuyển giữ hình dạng, đa giác lõm và tự cắt, dữ liệu nhập không hợp lệ, ID trùng, toạ độ lỗi và vòng xuất/nhập JSON.
