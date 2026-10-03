# BƯỚC 171 — NHẬN XÉT GIỮA HỌC KỲ I, GIỮA HỌC KỲ II

## Mục tiêu

- Ngân hàng gợi ý nhận xét Tin học và Công nghệ theo khối 3, 4, 5.
- Thu thập các câu trả lời **đã bấm Lưu minh chứng** từ Gọi tên + Trả lời, Trắc nghiệm hình ảnh, và Ai là triệu phú (chỉ khi chọn đúng một học sinh).
- Lọc theo học sinh, lớp, môn, năm học, giữa HK I/GK II và khoảng ngày.
- Một nút **Tổng hợp và gợi ý nhận xét**, sau đó giáo viên kiểm tra, chỉnh sửa và chọn mức đánh giá chính thức trước khi **Duyệt và lưu**.
- Ghi bản nhận xét chính thức vào `app3_learning_comments` và bảng lưu dấu vết riêng `app3_period_reviews` bằng một giao dịch tại Supabase. Chống lưu hai lần cùng học sinh/môn/năm học/kỳ.

## Triển khai an toàn

1. **Sao lưu** dự án và cơ sở dữ liệu đang dùng. Dùng một Supabase thử nghiệm với tài khoản giáo viên và học sinh **giả lập** để kiểm tra trước.
2. Bản 171 xây dựng từ 170.0. SQL 170 đã được sửa cú pháp và điều kiện liên kết trong bộ ZIP để thuận tiện khi triển khai mới. **Không chạy lại SQL 170 nếu dự án thật đã được khắc phục trong các bước trước**, vì nó tạo lại chính sách.
3. Chạy file `BUOC-171-NHAN-XET-GIUA-KY.sql` trong Supabase SQL Editor trên bản thử. Tệp này mở rộng `activity_type` để thêm `millionaire`, tạo bảng `app3_period_reviews`, chính sách RLS và RPC `app3_save_period_review`.
4. Đưa `script.js`, `style.css`, `index.html` và `periodic-remark-bank.js` vào **cùng thư mục gốc** của ứng dụng. Làm mới trình duyệt (Ctrl+F5). Không phải sửa `supabase.js` hay khóa truy cập.
5. Thử chơi `Gọi tên + Trả lời` / `Trắc nghiệm hình ảnh` hoặc `Ai là triệu phú`. Trong Ai là triệu phú, chọn Khối + môn Tin học/Công nghệ, chọn **ngân hàng câu hỏi đã thêm**, chọn Lớp và Học sinh, chơi và **bấm Lưu minh chứng**. Nếu không chọn học sinh, đây chỉ là chơi thử và không có kết quả cá nhân.
6. Mở `Nhận xét học tập` → `Nhận xét giữa kỳ từ quá trình học tập`. Chọn năm học, giữa HK I hoặc giữa HK II, lớp, môn, học sinh, khoảng ngày và bấm **Tổng hợp và gợi ý nhận xét**. Kiểm tra số câu, số lượt, ngày tham gia và bản nhận xét dự thảo.
7. Chọn mức **Hoàn thành tốt / Hoàn thành / Chưa hoàn thành** dựa trên *toàn bộ* minh chứng dạy học, có thể nhập nhận xét quan sát hoặc sản phẩm thực hành. Bấm **Duyệt và lưu nhận xét giữa kỳ**. Chương trình sẽ tạo bản ở danh sách Nhận xét học tập hiện hành và bảng báo cáo riêng.

## Phân biệt ý nghĩa

- Tỷ lệ đúng từ các trò chơi là **chỉ báo tham khảo**, không tự động quy đổi thành mức đạt được, điểm hay kết quả chính thức. Chơi lại và quyền trợ giúp trong Ai là triệu phú khiến tỷ lệ đúng không tương đương với bài kiểm tra độc lập.
- Phần mềm chỉ tạo gợi ý diễn đạt về phạm vi câu hỏi đã trả lời; không tự khẳng định học sinh thành thạo kỹ năng thực hành, an toàn thiết bị hay năng lực khác nếu chưa có bằng chứng quan sát.
- Khuyến nghị ít nhất 5 câu ở 2 phiên và 2 ngày. Nếu dưới mức này chương trình chỉ gợi ý nhận xét “chưa đủ minh chứng” và yêu cầu giáo viên cân nhắc các nguồn minh chứng khác. Đây là **ngưỡng kỹ thuật khuyến nghị**, không phải mức do Bộ GD&ĐT quy định.
- Kết quả được lọc theo `recorded_at` (thời điểm **lưu minh chứng**), không phải thời gian bắt đầu trả lời câu hỏi. Khi chơi xong, hãy lưu ngay. Kỳ II có mốc bắt đầu mặc định 01/01; thầy cần sửa theo kế hoạch năm học thực tế của đơn vị.
- Số liệu là những bản ghi giáo viên hiện tại được phép đọc theo chính sách RLS của bước 170; kết quả của giáo viên khác có thể không xuất hiện nếu họ là người tạo và không có quyền chia sẻ theo thiết kế hiện tại.
- Không tạo nhận xét từ nội dung mẫu của Ai là triệu phú. Chỉ ngân hàng câu hỏi đã thêm và có thông tin Khối/Môn hợp lệ mới được dùng làm minh chứng.
- Ngân hàng câu nhận xét nằm trong `periodic-remark-bank.js`; chỉnh sửa câu chữ theo sách, chương trình và mạch bài học thực tế. Hiện có 36 câu mẫu theo 6 tổ hợp Khối/Môn, 3 tín hiệu học tập, mỗi tín hiệu 2 biến thể tương ứng GK I/GK II; giáo viên có thể thay đổi hoặc mở rộng tùy ý.

## Giới hạn và kiểm thử phải làm trước khi triển khai thật

- Chưa chạy SQL trên Supabase của thầy. Đã có RLS nhưng **chỉ kiểm tra thực tế với tài khoản giáo viên** mới xác nhận được quyền tạo, đọc và lưu báo cáo.
- Tính năng hiện tạo nhận xét **từng học sinh**. Chưa có nút tự tạo/duyệt hàng loạt cả lớp hoặc đồng bộ trực tiếp với bảng tổng hợp đánh giá trên vnEdu.
- Để sửa bản nhận xét đã duyệt, cần quy trình hiệu đính có lưu lịch sử. Phiên bản 171 chủ động không cho tạo một bản chính thức thứ hai cho cùng kỳ/môn/học sinh nhằm chống ghi trùng.
- Học sinh không chọn môn hợp lệ hoặc chưa đủ minh chứng vẫn cần giáo viên kiểm tra và quyết định.

## Các truy vấn kiểm tra

```sql
select activity_type, count(*)
from public.app3_game_results
group by activity_type;

select school_year, period, subject_name, grade,
       final_level, evidence_count, correct_count, session_count, comment_id
from public.app3_period_reviews
order by created_at desc
limit 20;

select r.student_id,r.subject_id,r.period,r.school_year,
       r.comment_id,c.id as comment_exists
from public.app3_period_reviews r
left join public.app3_learning_comments c on c.id=r.comment_id
limit 20;
```

Theo Thông tư 27/2020/TT-BGDĐT, tổng hợp đánh giá giữa học kỳ căn cứ đánh giá thường xuyên và yêu cầu cần đạt; kết quả trò chơi chỉ là một phần thông tin. Giáo viên chịu trách nhiệm đánh giá chính thức.

## Khóa dữ liệu sau khi duyệt

Nhận xét giữa kỳ đã duyệt được đánh dấu **Đã duyệt** trên bảng nhận xét; không hiển thị nút sửa/xóa ở giao diện. SQL bước 171 còn tạo trigger `app3_protect_period_comment_trg` để chặn sửa/xóa trực tiếp đối với nhận xét đã liên kết báo cáo, giữ cho `app3_period_reviews` và `app3_learning_comments` nhất quán. Nếu cần thay đổi nhận xét đã duyệt, phải xây dựng thêm quy trình hiệu đính có lưu lịch sử; không xóa hoặc sửa trực tiếp bằng SQL trong dữ liệu thật.
