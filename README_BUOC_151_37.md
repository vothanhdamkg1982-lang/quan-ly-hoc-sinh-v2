# BƯỚC 151.37 – DÁN CÂU HỎI TRỰC TIẾP TỪ AI

PATCH nhẹ, chưa dùng Supabase.

## Chức năng mới
Trong `Quản lý câu hỏi` có vùng:
**Dán câu hỏi trực tiếp từ AI**

Hỗ trợ 3 dạng:
1. Bảng Markdown 10 cột.
2. Dữ liệu tab.
3. Khối văn bản có nhãn:
   - Khối:
   - Môn:
   - Chủ đề:
   - Mức độ:
   - Câu hỏi:
   - A:
   - B:
   - C:
   - D:
   - Đáp án đúng:

## Quy trình
1. Yêu cầu AI tạo câu hỏi theo một trong các mẫu trên.
2. Copy toàn bộ.
3. Dán vào vùng trống.
4. Bấm `Phân tích & nhập`.
5. Hệ thống báo:
   - Thêm mới
   - Trùng, bỏ qua
   - Lỗi, bỏ qua

## An toàn
- Câu trùng theo Khối + Môn + Nội dung bị bỏ qua.
- Dòng sai không làm hỏng các dòng đúng.
- Dữ liệu hợp lệ tiếp tục lưu `localStorage`.
- Không Supabase.
- Không SQL.
- Giữ nguyên cơ chế Excel và lưu trạng thái qua F5.
