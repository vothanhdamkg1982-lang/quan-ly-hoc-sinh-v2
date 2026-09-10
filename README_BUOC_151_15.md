# BƯỚC 151.15 – LOẠI BỎ GIT CŨ, CHUẨN BỊ GITHUB MỚI

## Mục tiêu
- Giữ nguyên toàn bộ mã nguồn/chức năng từ nền BƯỚC 151.14.
- Loại bỏ hoàn toàn repository Git cũ để tránh merge/conflict với kho GitHub trước.
- Chuẩn bị thư mục sạch để khởi tạo một repository Git mới.

## Đã thực hiện
- Xóa toàn bộ thư mục ẩn `.git` và lịch sử commit/remote/merge cũ.
- Xóa README của bước trước; chỉ giữ README bước hiện tại.
- Không kèm các file SQL lịch sử.
- Thêm `.gitignore` để tránh đưa file tạm, log, ZIP/RAR, `.env`, node_modules, venv... lên GitHub.
- Không chỉnh sửa `index.html`, `script.js`, `style.css`, `supabase.js` hay các asset chức năng.

## Cách đưa lên GitHub mới
1. Giải nén gói này vào một thư mục mới.
2. Tạo một repository rỗng trên GitHub. Nên KHÔNG chọn tạo sẵn README, .gitignore hoặc LICENSE để tránh phát sinh commit ban đầu không cần thiết.
3. Mở Git Bash/Terminal tại thư mục vừa giải nén và chạy:

```bash
git init
git add .
git commit -m "Khoi tao phien ban moi - Buoc 151.15"
git branch -M main
git remote add origin https://github.com/TEN_TAI_KHOAN/TEN_REPOSITORY_MOI.git
git push -u origin main
```

Thay `TEN_TAI_KHOAN` và `TEN_REPOSITORY_MOI` bằng thông tin GitHub thật của bạn.

## Kiểm tra trước khi commit
Có thể chạy:

```bash
git status
```

Ở lần đầu sau `git init`, các file sẽ hiện là untracked cho tới khi `git add .`. Không còn trạng thái MERGING hoặc conflict từ Git cũ.

## Lưu ý
- Bước này không cần chạy SQL trên Supabase.
- Không thay đổi dữ liệu Supabase.
- Repository GitHub cũ không bị xóa hay thay đổi; đây chỉ là một lịch sử Git hoàn toàn mới cho bản hiện tại.
