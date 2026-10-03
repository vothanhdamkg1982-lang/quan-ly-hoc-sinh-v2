# Bước 173.0 – Chuyển nhanh từ Vòng quay / Gọi tên bằng hình ảnh sang trò chơi

## Mục đích
Giáo viên không phải tìm học sinh lần thứ hai trong danh sách dài. Khi có kết quả ngẫu nhiên, hai nút **Ai là triệu phú** và **Trắc nghiệm hình ảnh** xuất hiện ngay bên dưới học sinh được chọn.

## Thao tác
1. Đăng nhập bằng tài khoản được phân công dạy lớp/môn; chọn lớp ở **Vòng quay** hoặc **Gọi tên bằng hình ảnh**.
2. Quay/gọi để chọn một học sinh. Đợi hiệu ứng chọn hoàn tất.
3. Bấm **Ai là triệu phú** hoặc **Trắc nghiệm hình ảnh**. Ứng dụng chuyển trang và tự gắn UUID của học sinh từ hồ sơ, không dùng mã học sinh hiển thị.
4. Xác nhận học sinh và khối trong khối **Học sinh đang được gọi**; chọn môn, bài học và câu hỏi. Trò chơi không tự bắt đầu khi chưa chọn học liệu.
5. Cho học sinh trả lời; bấm **Lưu minh chứng** theo chức năng có sẵn trong bước 170–171.
6. Để gọi em tiếp theo, hoàn tất/lưu rồi kết thúc phiên của trò chơi đích, quay lại Vòng quay hoặc Gọi tên bằng hình ảnh và chọn tiếp.

## An toàn dữ liệu
- Không chuyển sang học sinh khác khi trò chơi đích còn phiên hoặc kết quả của học sinh khác; cần lưu và kết thúc phiên đó trước.
- Kiểm tra quyền chỉnh sửa và ít nhất một môn thuộc lớp; chức năng ghi nhận cá nhân chỉ hỗ trợ khối 3, 4, 5 trong phiên bản này.
- Nếu giáo viên không chọn học sinh hợp lệ, nút sẽ không bắt đầu phiên ghi minh chứng.
- Trạng thái học sinh đang gọi chỉ dùng để điền người tham gia; kết quả chỉ được lưu khi giáo viên bấm lưu; nhận xét vẫn phải được duyệt theo bước 170–171.
- Bản 173.0 không yêu cầu thêm bảng hoặc chạy SQL mới; tiếp tục dùng cấu trúc Supabase từ bước 170–171.

## Cập nhật mã nguồn
- Tạo bản sao lưu của phiên bản đang dùng.
- Chỉ thay ba tệp: `index.html`, `script.js`, `style.css`.
- Bản ZIP đầy đủ được phát hành kèm bản ZIP chỉ chứa ba tệp thay đổi và tài liệu này.
- Nếu trình duyệt vẫn hiện giao diện cũ, nhấn Ctrl+F5 hoặc làm mới bộ nhớ đệm. Phiên bản query của `script.js` đã được đổi thành v17300.

## Giới hạn thử nghiệm
Đã kiểm tra cú pháp JavaScript và các tình huống điều hướng/gắn học sinh bằng dữ liệu giả lập. Chưa kết nối đến Supabase đang vận hành; thử trên bản sao cơ sở dữ liệu hoặc tài khoản thử trước khi triển khai cho lớp học thật.
