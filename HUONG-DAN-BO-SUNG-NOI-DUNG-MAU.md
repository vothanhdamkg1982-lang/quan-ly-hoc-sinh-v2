# Bản bổ sung mẫu website công khai – Bước 169.0

## Mục đích
Hoàn thiện những mục còn trống ở giao diện công khai, tận dụng ảnh sẵn có và thêm nội dung đọc được để kiểm tra bố cục. **Không chèn bản ghi vào Supabase** và không thay đổi dữ liệu học sinh.

## Thay đổi
- `script.js`: thêm 4 bài tin mẫu, 3 tài liệu hướng dẫn mẫu, ảnh thư viện dự phòng, thông báo dự phòng và thẻ gợi ý video khi chưa có video thực.
- `index.html`: thêm Góc học tập & gia đình, Câu hỏi thường gặp, liên kết menu desktop/mobile, sửa hai liên kết hỗ trợ ở chân trang.
- `style.css`: kiểu thẻ, nhãn mẫu và responsive; chỉ áp dụng ở `#publicSite`.
- `public-guides/`: ba trang HTML hướng dẫn thật có thể mở và chỉnh sửa độc lập.
- `backup-original/`: ba tệp HTML, CSS, JavaScript nguyên gốc trước khi bổ sung.

## Cơ chế dữ liệu
1. Website tiếp tục đọc 5 view `app3_public_*_live` như mã nguồn gốc và chỉ đọc bản ghi được công khai.
2. Tin tức: dưới 4 bài thật thì bù bài mẫu cho đủ 4; từ 4 bài thật trở lên không hiển thị bài mẫu.
3. Tài liệu: dưới 3 tài liệu thật thì bù tài liệu mẫu cho đủ 3; từ 3 tài liệu thật trở lên không bổ sung.
4. Thư viện ảnh: chỉ dùng ảnh mẫu khi chưa có ảnh thật. Video: hiển thị gợi ý không phát khi chưa có video thật.
5. Thông báo: chỉ dùng 3 thông báo mẫu khi bảng công khai trả danh sách rỗng. Liên kết vẫn dùng dữ liệu công khai hoặc nguồn dự phòng có sẵn trong mã cũ.
6. Nếu đọc dữ liệu công khai lỗi, website vẫn thể hiện trạng thái lỗi tương ứng để quản trị viên kiểm tra quyền đọc/cấu hình.
7. Bài viết/tài liệu mẫu có nhãn **MẪU**; nội dung tĩnh ở Góc học tập và FAQ là hướng dẫn tham khảo, không phải quyết định hay thông báo chính thức.

## Chỉnh sửa sau này
- Đổi `const PUBLIC_DEMO_ENABLED = true;` thành `false` trong `script.js` để ngừng bù dữ liệu mẫu.
- Hoặc dùng màn hình **Nội dung website** dành cho Admin để đăng đủ tin, tài liệu, ảnh, video và thông báo. Dữ liệu thật tự động thay dữ liệu mẫu theo từng mục.
- Sửa bài mẫu ở `PUBLIC_DEMO_POSTS`, tài liệu mẫu ở `PUBLIC_DEMO_DOCUMENTS`, ảnh mẫu ở `PUBLIC_DEMO_IMAGES` và thông báo mẫu ở `PUBLIC_DEMO_ANNOUNCEMENTS`.
- Chỉnh trang hướng dẫn bằng cách sửa các file HTML trong `public-guides/`.

## Triển khai
1. Sao lưu website đang chạy và cơ sở dữ liệu theo quy trình đang sử dụng.
2. Đưa nguyên thư mục dự án lên máy chủ/hosting theo quy trình trước đây. Phải đưa cả `public-guides/` và ảnh trong `assets/`.
3. Không chạy thêm SQL, không đổi Supabase URL/key, không đổi chính sách RLS.
4. Xóa cache/truy cập lại trang sau triển khai, xem các mục trên desktop và mobile rồi kiểm tra nút Đăng nhập bằng tài khoản thử nghiệm có sẵn.

**Lưu ý:** Đây là mẫu để kiểm tra bố cục, chưa phải nội dung được nhà trường duyệt. Kiểm tra quyền sử dụng hình ảnh học sinh trước khi công khai ở môi trường thật. Tệp `.git` của bản người dùng cung cấp không đóng gói lại để gói tải nhẹ hơn; bản ZIP gốc vẫn do người dùng giữ.
