# BƯỚC 151.18.2 – ĐẾM SỐ LẦN THỰC THI SUPABASE CLIENT

## Mục tiêu
Chẩn đoán chính xác `supabase.js` có thực sự được thực thi nhiều hơn một lần trên GitHub Pages hay không.

## Thay đổi
- `supabase.js`: thêm bộ đếm tạm thời trên `globalThis` và log `[151.18.2][SUPABASE MODULE RUN]`.
- `script.js`: đổi import thành `./supabase.js?v=151182` để tránh cache cũ.
- `index.html`: đổi version của `script.js` thành `v=151182` để tránh cache cũ.
- Không thay đổi `createClient()`, cấu hình Auth, đăng nhập, RLS, database hoặc các module nghiệp vụ.

## Cách kiểm tra
1. Đẩy bản này lên GitHub mới và chờ GitHub Pages deploy xong.
2. Mở website, F12 > Console.
3. Tìm dòng `[151.18.2][SUPABASE MODULE RUN]`.
4. Chụp màn hình Console gửi lại.

Nếu `count: 1` nhưng cảnh báo `Multiple GoTrueClient instances detected` vẫn tồn tại, client thứ hai không đến từ việc `supabase.js` của app được thực thi hai lần.

**Không có SQL ở bước này.**
