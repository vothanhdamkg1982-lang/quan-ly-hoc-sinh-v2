# BƯỚC 175.0 — Tích hợp mô-đun học tập thích ứng AI

**Ngày:** 03/10/2026 · **Hạn sáng kiến:** 29/10/2026 · **Trạng thái:** Bản tích hợp thử nghiệm, chưa triển khai chính thức.

## 1. Thay đổi so với ZIP gốc

- Thêm menu **Học tập → Học tập thích ứng AI** trong `index.html`.
- Thêm luồng hiển thị trong `script.js` bằng một mô-đun riêng, không sửa logic trò chơi, nhận xét, điểm hoặc đăng nhập.
- Bổ sung `adaptive-learning.js` và `adaptive-bank.js`; thêm khối CSS riêng cuối `style.css`.
- Không chạy SQL, không thêm bảng/cột, không ghi lại dữ liệu Supabase. Các tệp SQL và Edge Function cũ được giữ nguyên.
- Giữ toàn bộ nội dung dự án gốc, ngoại trừ thư mục `.git` không đưa vào bản phát hành; các thư mục sao lưu cũ vẫn được giữ lại.

## 2. Cách dùng cho giáo viên

1. **Sao lưu ZIP và dữ liệu** của ứng dụng đang vận hành; chỉ kiểm thử bản mới trên một bản sao trước.
2. Giải nén toàn bộ bản phát hành, chạy trên máy chủ HTTP/HTTPS giống ứng dụng đang sử dụng. Mở trang, đăng nhập bằng tài khoản giáo viên hoặc quản trị viên như trước.
3. Chọn **Học tập → Học tập thích ứng AI**. Chọn lớp 4 và học sinh đã có trong hệ thống.
4. **Đối chiếu bộ câu hỏi mẫu trong `adaptive-bank.js` với SGK/SGV, kế hoạch bài dạy và PPCT tại trường**; sau khi kiểm tra, nhấn **Xác nhận đã kiểm duyệt ngân hàng**. Không bấm xác nhận nếu chưa kiểm duyệt.
5. Cho học sinh làm **6 câu đánh giá đầu vào**; phần mềm xác định hai kỹ năng ưu tiên, sau đó giao **4 câu luyện tập**. Sau khi luyện tập, học sinh làm **6 câu đánh giá lại** bằng bộ câu hỏi khác với đầu vào.
6. Giáo viên quan sát học sinh thực hành trên máy tính, nhập nhận xét ngắn, xuất CSV/JSON sau mỗi buổi và lưu ở nơi có phân quyền.
7. Trong ô **Trợ lý soạn học liệu bằng AI**, chọn kỹ năng, tạo lời nhắc, sao chép vào công cụ AI do đơn vị cho phép. Giáo viên kiểm tra kết quả trước khi sử dụng. Tuyệt đối không chèn tên, mã học sinh hoặc dữ liệu riêng tư vào lời nhắc.

**Lưu ý:** Số điểm trắc nghiệm là kết quả câu hỏi; không tự động xem đó là điểm đánh giá năng lực thực hành. Sử dụng bảng tiêu chí quan sát và sản phẩm thực tế để nhận xét.

## 3. Phạm vi, cơ chế dữ liệu và giới hạn

- **Chỉ có bài mẫu lớp 4** về định dạng văn bản trên trang chiếu. `adaptive-bank.js` chứa 18 câu (6 đầu vào + 6 luyện tập + 6 đánh giá lại). Mỗi lượt luyện tập được chọn 4 câu theo hai kỹ năng cần hỗ trợ.
- Dữ liệu thí điểm lưu **localStorage theo ID tài khoản đăng nhập trên một trình duyệt**, không đồng bộ với các thiết bị khác. Đổi trình duyệt/máy hoặc xóa dữ liệu trình duyệt có thể làm mất kết quả nếu chưa sao lưu.
- Chức năng xuất CSV dùng **mã học sinh**, không xuất họ tên. Tệp kết quả và nhận xét vẫn là dữ liệu giáo dục cần giữ kín.
- Danh sách lớp và học sinh lấy từ `APP_STATE` đang phân quyền. Tài khoản Viewer chỉ xem, không chỉnh sửa kết quả thí điểm.
- Không có API AI tích hợp trực tiếp, chưa có AI chấm sản phẩm thực hành, chưa liên kết với `app3_learning_comments` hoặc `app3_scores`, chưa đồng bộ kết quả vào Supabase.
- Trình duyệt có thể tiếp tục dùng bài đã tải khi mất mạng nếu các tệp cần thiết vẫn sẵn có, nhưng **đăng nhập và khởi chạy toàn bộ Web App vẫn có thể cần Internet** do hệ thống gốc sử dụng CDN và Supabase. Không coi bản này là ứng dụng ngoại tuyến hoàn chỉnh.
- Không đưa dữ liệu học sinh thật vào bản demo công khai, tài khoản dùng chung hoặc công cụ AI bên ngoài.

## 4. Kiểm thử và chuyển sang dùng chính thức

Chạy `node --check script.js`, `node --check adaptive-learning.js`, `node --check adaptive-bank.js` và `node tests/test_adaptive.mjs` (Node 22). Bộ kiểm thử dùng dữ liệu giả, không kết nối tài khoản thật. Trước khi thay website đang chạy, cần tự kiểm tra đăng nhập Supabase, phân quyền từng vai trò, các trò chơi cũ, nhận xét học tập, xuất tệp và giao diện trên máy/điện thoại thật.

**Chưa có kết quả thực nghiệm thật.** Số liệu, ảnh minh chứng, mức tiến bộ và kết luận hiệu quả phải được bổ sung sau khi tiến hành thực nghiệm tại trường. Ngày 29/10 là hạn hoàn thành nội bộ, không phải kết quả đã được xác nhận.
