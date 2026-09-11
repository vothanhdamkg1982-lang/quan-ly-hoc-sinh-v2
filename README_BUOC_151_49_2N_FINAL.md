# BƯỚC 151.49.2N-FINAL

Bản hoàn thiện cuối sau đợt nâng cấp giao diện.

Chỉ bổ sung:
- window.closeStudentInlineEditor = closeStudentInlineEditor;
- window.goHome = goHome;

Mục đích:
- Đảm bảo inline onclick gọi được hai hàm khi script.js chạy dạng ES module.
- Không thay đổi giao diện, dữ liệu, Supabase, phân quyền hay logic nghiệp vụ.

Kiểm tra:
- node --check script.js: OK
- Hai hàm gốc vẫn tồn tại.
- Hai export ra window đã tồn tại.
