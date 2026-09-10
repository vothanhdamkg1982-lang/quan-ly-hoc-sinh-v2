# BƯỚC 151.19 – SỬA MODULE FILE: INVALID KEY

## Mục tiêu
Sửa lỗi Supabase Storage `Invalid key: documents/...xlsx` khi tên file người dùng chứa tiếng Việt có dấu/ký tự đặc biệt.

## Thay đổi
- Chỉ sửa luồng upload của module **File** trong `script.js`.
- Không còn dùng trực tiếp tên file gốc để tạo Storage object key.
- Storage key mới có dạng an toàn: `documents/<timestamp>_<uuid>.<ext>`.
- Tên file gốc vẫn được giữ nguyên trong `app3_files.file_name`, nên giao diện vẫn hiển thị đúng tên tiếng Việt.
- Đổi cache `script.js` trong `index.html` sang `v=151190` để GitHub Pages tải bản mới.

## Không thay đổi
- Không sửa Supabase Auth/RLS/database.
- Không sửa Học sinh, Điểm, VNEDU, Backup/Restore, Vòng quay, website công khai.
- Không cần chạy SQL.

## Kiểm tra
1. Tải thử file có tên tiếng Việt, ví dụ `THỜI KHÓA BIỂU VÕ THANH ĐẬM - ĐÃ KIỂM TRA LẠI.xlsx`.
2. Xác nhận file xuất hiện trong danh sách và tải xuống được.
3. Console không còn lỗi `Invalid key` đối với lần upload mới.
