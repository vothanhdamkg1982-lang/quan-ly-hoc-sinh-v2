# BƯỚC 170.0 — LIÊN KẾT NGÂN HÀNG CÂU HỎI → KẾT QUẢ → NHẬN XÉT

## Phạm vi thay đổi

- Cập nhật `script.js`, `style.css`, `index.html` (đổi version script để trình duyệt tải mã mới).
- Bổ sung SQL độc lập: `BUOC-170-LIEN-KET-KET-QUA-NHAN-XET.sql`.
- Thư mục `backup-before-170/` chứa tệp giao diện và mã nguồn của bản 169.0.
- **Không** xóa/sửa nội dung câu hỏi, bảng điểm hay nhận xét đã lưu. Không thay thế cấu trúc bảng `app3_learning_comments`.
- Không chứa mật khẩu hoặc `service_role` trong tệp phía trình duyệt; tiếp tục dùng cấu hình `supabase.js` hiện tại.

## 1. BẮT BUỘC thực hiện trước khi sử dụng tính năng lưu

1. Sao lưu dự án Supabase và bản ứng dụng đang hoạt động; thử trên một dự án/bản sao dữ liệu trước khi chạy với dữ liệu thật.
2. Mở **Supabase → SQL Editor**, kiểm tra rằng các bảng `app3_students`, `app3_classes`, `app3_subjects`, `app3_user_roles`, `app3_teacher_assignments`, `app3_learning_comments` có sẵn. Bản SQL giả định ID học sinh/lớp/nhận xét là UUID, mã môn là văn bản, và bảng phân công có cột `user_id`, `class_id`, `subject_id`, `active`. Nếu khác, phải điều chỉnh SQL theo thực tế trước khi chạy.
3. Chạy **toàn bộ** `BUOC-170-LIEN-KET-KET-QUA-NHAN-XET.sql` một lần. Tệp tạo `app3_game_results`, chỉ mục, các chính sách RLS, hàm kiểm tra quyền và hàm RPC `app3_create_game_comment`. Không chạy từng dòng rời rạc.
4. Cập nhật **đồng thời** `index.html`, `script.js`, `style.css` trên website. Đảm bảo tệp `supabase.js` vẫn dùng đúng cấu hình trước đó. Tải lại trình duyệt bằng Ctrl+F5.
5. Đăng nhập tài khoản giáo viên với lớp và môn được phân công. Tài khoản Viewer không được ghi hoặc đọc minh chứng cá nhân mới; Admin có thể xem các bản ghi đã lưu.

**Chưa chạy SQL:** website và các trò chơi cũ vẫn hoạt động. Nút `Lưu minh chứng` sẽ thông báo lỗi không tìm thấy bảng hoặc không đủ quyền. Không có dữ liệu nào được tự động tạo/đẩy lên Supabase trong quá trình nâng cấp mã nguồn.

## 2. Cách sử dụng — Gọi tên + Trả lời

1. Chọn khối, lớp, môn và bài học; chọn câu hỏi như trước.
2. Gọi tên học sinh, cho học sinh trả lời. Ứng dụng tiếp tục thống kê đúng, sai và hết giờ; mỗi kết quả đi kèm mã học sinh, ID câu hỏi, ảnh chụp nội dung câu hỏi và đáp án tại thời điểm chơi.
3. Bấm **Lưu kết quả hiện có** trong khi chơi, hoặc **Lưu minh chứng** ở màn hình hoàn thành. Ứng dụng yêu cầu xác nhận; không tự động tạo nhận xét và không ghi vào điểm số. Có thể bấm lưu lại sau khi có câu mới; câu đã lưu không được chèn trùng.
4. Mở **Nhận xét học tập → Minh chứng hoạt động tương tác**, bấm **Xem** để kiểm tra từng câu; bấm **Tạo nhận xét**, sửa nội dung đề xuất, chọn diễn biến và bấm xác nhận.
5. Nhận xét xuất hiện trong danh sách cũ; các câu hỏi của lượt học được liên kết bằng `linked_comment_id`.

## 3. Cách sử dụng — Trắc nghiệm hình ảnh

1. Chọn khối, môn và bài học như trước.
2. Muốn lưu theo cá nhân: **chọn Lớp + Học sinh trước khi bấm Bắt đầu**. Nếu không chọn, vẫn có thể tổ chức trò chơi chung cả lớp nhưng không được lưu kết quả vào hồ sơ của một học sinh.
3. Sau khi trả lời, bấm **Lưu kết quả hiện có**, hoặc chờ màn hình kết quả để bấm **Lưu minh chứng cho học sinh đã chọn**.
4. Mở phần minh chứng trong mục **Nhận xét học tập** để xem và duyệt nhận xét như trên.

**Lưu ý:** chế độ Trắc nghiệm hình ảnh dùng một học sinh cho một lượt. Nếu cả lớp cùng trả lời, không dùng một học sinh làm đại diện để lưu vào hồ sơ cá nhân.

## 4. Chính sách dữ liệu và tính an toàn

- Bảng mới tách kết quả hoạt động khỏi kết quả chấm điểm chính thức; *một câu sai hoặc hết giờ không tự động biến thành nhận xét tiêu cực*.
- Giáo viên phải xem minh chứng, chọn loại diễn biến và xác nhận nội dung trước khi tạo nhận xét.
- RPC tạo nhận xét và gắn minh chứng trong **một giao dịch**, nhằm tránh trường hợp tạo nhận xét thành công nhưng không liên kết được minh chứng.
- Bộ lọc và kiểm tra quyền tại giao diện được kết hợp với RLS tại Supabase. Quyền ghi yêu cầu tài khoản hoạt động và đúng lớp/môn khi tài khoản chỉ có phạm vi phân công.
- Lưu **ảnh chụp dữ liệu câu hỏi và đáp án** (không sao chép ảnh minh họa) để bằng chứng không bị sai khi ngân hàng câu hỏi được biên tập về sau. Dữ liệu còn có mã câu hỏi, mã phiên, mã học sinh, lớp, môn, tuần và PPCT (nếu câu hỏi có dữ liệu này).
- Khi xóa nhận xét, cơ sở dữ liệu gỡ liên kết `linked_comment_id` nhưng giữ kết quả hoạt động. Khi xóa học sinh, bảng minh chứng sử dụng `ON DELETE CASCADE`; cần tính đến chính sách lưu trữ và lưu trữ dự phòng thực tế của nhà trường.
- Hệ thống cảnh báo khi bỏ phiên hoặc tải lại trang mà chưa lưu; nếu trình duyệt/tài khoản bị đóng đột ngột, kết quả chưa gửi đến Supabase có thể mất. Không tự động cất kết quả học sinh trong localStorage.

## 5. Phạm vi chưa tích hợp trong bản 170.0

- **Ai là triệu phú** chưa ghi kết quả về học sinh: trò chơi hiện cho phép nhiều chế độ chơi/đổi câu, chưa có bước xác nhận người tham gia. Không suy đoán danh tính học sinh từ người bấm đáp án.
- Vòng quay và Gọi tên bằng hình ảnh chỉ chọn người tham gia, không có kết quả trả lời nên không tạo nhận xét tự động.
- Chưa đồng bộ dữ liệu kết quả sang các bảng điểm chính thức, chưa tạo nhận xét tự động bằng AI, chưa thống kê tiến bộ nhiều học kỳ và chưa có quy trình đồng ý của phụ huynh.
- Chưa chạy SQL trên Supabase đang hoạt động của thầy; cần triển khai thử và đối chiếu RLS hiện hữu trước khi áp dụng toàn trường.

## 6. Các ca kiểm tra chấp nhận khi triển khai thử

1. Giáo viên có phân công: trả lời 1 câu đúng, 1 câu sai hoặc hết giờ → lưu → tải lại trang → cả hai câu hiển thị trong Minh chứng.
2. Nhấn `Lưu` hai lần → bảng không có hàng trùng `(session_id,student_id,question_key)`.
3. Thử lưu thiếu học sinh ở Trắc nghiệm hình ảnh → có cảnh báo, không tạo hàng.
4. Giáo viên không được phân công lớp/môn → không được ghi bằng cách gửi yêu cầu trực tiếp qua API (kiểm tra RLS, không chỉ giao diện).
5. Tài khoản Viewer / chưa đăng nhập → không thể truy vấn `app3_game_results` bằng Supabase.
6. Chọn một lượt chơi, sửa nội dung nhận xét theo quan sát của giáo viên → tạo nhận xét → kiểm tra `linked_comment_id` khớp ID nhận xét thực tế.
7. Đóng modal nhận xét bằng Hủy → bảng nhận xét và `linked_comment_id` không đổi.
8. Trả lời xong rồi đổi bài hoặc bấm chơi lại khi chưa lưu → xuất hiện cảnh báo.
9. Các chức năng cũ (đăng nhập, quản lý HS, điểm, điểm danh, trò chơi, nội dung website) hoạt động như trước trên tài khoản thử.

## 7. Các truy vấn kiểm tra chỉ đọc

```sql
-- 10 minh chứng gần nhất (chạy bằng tài khoản có quyền trong Supabase SQL Editor)
select id, session_id,student_id,activity_type,question_key,status,recorded_at,linked_comment_id
from public.app3_game_results order by recorded_at desc limit 10;

-- Số câu và tỷ lệ đúng theo lượt/học sinh
select session_id,student_id,subject_name,lesson_name,count(*) as answered,
 count(*) filter (where status='correct') as correct,
 count(*) filter (where status='wrong') as wrong,
 count(*) filter (where status='timeout') as timeout
from public.app3_game_results
group by session_id,student_id,subject_name,lesson_name;
```

Khi kiểm thử, dùng học sinh/tài khoản giả hoặc dữ liệu thử do nhà trường phê duyệt, không tải mã định danh cá nhân học sinh lên các dịch vụ công khai.
