# BƯỚC 151.18.3 – THÁO BỘ ĐẾM CHẨN ĐOÁN SUPABASE

## Mục tiêu
Gỡ phần chẩn đoán tạm thời đã dùng ở Bước 151.18.2 sau khi xác nhận `supabase.js` chỉ thực thi 1 lần trên GitHub Pages.

## Thay đổi
- Xóa biến đếm `globalThis.__QLHS_SUPABASE_MODULE_RUNS__`.
- Xóa log `[151.18.2][SUPABASE MODULE RUN]`.
- Giữ nguyên duy nhất một `createClient()` trong `supabase.js`.
- Đổi cache version `script.js` và `supabase.js` từ `151182` sang `151183` để GitHub Pages tải bản sạch mới.

## Không thay đổi
- Không thay đổi cấu hình Supabase URL/key.
- Không thay đổi đăng nhập, phân quyền, RLS hoặc database.
- Không thay đổi Backup/Restore, VNEDU, Học sinh, Điểm, Vòng quay hay website công khai.
- Không cần chạy SQL.

## Kiểm tra sau khi deploy
Mở website, nhấn Ctrl+F5 và kiểm tra Console:
- Không còn log `[151.18.2][SUPABASE MODULE RUN]`.
- Không còn cảnh báo `Multiple GoTrueClient instances detected`.
- App vẫn tải dữ liệu và đăng nhập bình thường.
