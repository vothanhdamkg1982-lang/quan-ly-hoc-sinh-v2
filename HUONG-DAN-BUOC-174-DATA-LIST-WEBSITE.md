# Bước 174 – Vị trí hiển thị và DATA LIST của Quản lý Tin tức

## Điểm mới

Trong **Nội dung website công khai → Quản lý Tin tức**, ngay phía trên biểu mẫu có hai nút **Thêm / Sửa bài viết** và **DATA LIST · Vị trí bài viết**. Bấm DATA LIST để mở danh sách mà không cần cuộn qua biểu mẫu dài. Khi bấm **Sửa** ở một hàng, ứng dụng chuyển về biểu mẫu và điền nội dung bài đã chọn.

Các thành phần đã bổ sung:

- **Vị trí hiển thị trên website**: `Thông tin nổi bật · thẻ lớn`, `Tin tức – Sự kiện · danh sách tin` hoặc `Cả hai vị trí`.
- Bảng **DATA LIST · Danh sách bài viết**: Tiêu đề, Nhóm, Vị trí, Trạng thái (công khai/chưa công khai), nút Sửa, Xem, Xóa.
- Bộ lọc tìm kiếm bài viết, lọc vị trí và lọc trạng thái.
- Trường Nhóm/Chuyên mục có gợi ý nhập để tránh dùng từ khác nhau cho cùng một nhóm.

**Vị trí hiển thị** khác với **Nhóm**:
- Nhóm = cách phân loại bài viết (Hoạt động nhà trường, Góc học tập, ...).
- Vị trí = ô/thẻ xuất hiện trên trang chủ.
- Một bài `both` hiển thị ở cả thẻ tin lớn và danh sách tin nhỏ.

Trang chủ nạp tối đa 100 bài công khai mới nhất để tìm bài nổi bật; danh sách tin nhỏ hiển thị tối đa 12 bài theo bộ lọc đang chọn. Nếu vượt quá 100 bài, các bài cũ cần trang lưu trữ hoặc chức năng phân trang ở đợt nâng cấp sau.

Bài viết cũ được mặc định là `news` (danh sách tin), không bị xóa hay chuyển thành bài nổi bật. Bài viết chưa công khai **không xuất hiện trên website** dù chọn vị trí nào. Khi có nhiều bài nổi bật, chúng xuất hiện theo thời gian đăng (mới trước) ở cột thẻ lớn. Bản demo chỉ được đẩy lên thẻ lớn khi chưa có bài chính thức ở chuyên mục đang xem.

## Cách triển khai

1. Sao lưu dự án và Supabase.
2. Chạy `BUOC-174-VI-TRI-BAI-VIET.sql` trong Supabase SQL Editor **trên môi trường thử nghiệm trước**. Tệp này thêm cột `placement`, cập nhật VIEW đọc bài công khai và giữ nguyên chính sách RLS hiện tại.
3. Thay `index.html`, `script.js`, `style.css` của bản 173.0 bằng ba tệp mới.
4. Tải lại trang bằng `Ctrl+F5`; đăng nhập quản trị viên, mở **Nội dung website công khai → Quản lý Tin tức**.
5. Tạo một bài thử `featured`, một bài thử `news`, một bài thử `both`; đặt `Công khai trên website` và quan sát từng vị trí trên website.
6. Bỏ chọn `Công khai trên website` với một bài rồi kiểm tra bài không còn xuất hiện ngoài trang công khai nhưng vẫn hiện trong DATA LIST.

## Lưu ý

- **Không** sử dụng tệp SQL trước khi sao lưu. Không cần chạy lại SQL của bước 170/171.
- Bảng Quản lý Tài liệu, Ảnh & Video, Thông báo, Liên kết và các module quản lý học sinh không thay đổi.
- Các bộ lọc DATA LIST chỉ ảnh hưởng danh sách quản trị, không xóa hay thay đổi dữ liệu.
- Website công khai vẫn đọc từ `app3_public_posts_live` nên bản nháp không được hiển thị.
- Nếu xuất hiện lỗi cột `placement` khi bấm Lưu, kiểm tra đã chạy tệp SQL 174 ở đúng dự án Supabase hay chưa.
