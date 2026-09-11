# BƯỚC 151.22 – SỬA GIAO DIỆN VÒNG QUAY TRÊN MOBILE

Phạm vi thay đổi chỉ ở giao diện/responsive của Vòng quay.

- Tiêu đề `Vòng quay may mắn` trên mobile không còn vỡ thành nhiều dòng.
- Topbar được thu gọn để tên người dùng và các nút không ép tiêu đề.
- Khu vực chọn lớp/thống kê/tùy chọn tự xuống hàng gọn trên màn hình hẹp.
- Vòng quay co theo chiều rộng thiết bị, tránh tràn ngang.
- Với lớp đông hơn 12 học sinh trên mobile, ẩn tên trên từng lát để tránh chữ xoay/chồng chéo; tên người trúng vẫn hiển thị đầy đủ trong khung `CHÚC MỪNG`.
- Giữ nguyên thuật toán quay, chống trùng, danh sách tham gia, ảnh người trúng và chế độ trình chiếu.
- Không cần SQL.
- Cache `script.js` nâng lên `v=151220`.

Kiểm tra đề nghị: iPhone/Android ở chiều dọc, lớp khoảng 19 học sinh trở lên; thử quay vài lượt và kiểm tra khung kết quả.
