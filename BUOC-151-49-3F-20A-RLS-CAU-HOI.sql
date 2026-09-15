-- ============================================================
-- BƯỚC 151.49.3F.20A
-- BẢO VỆ NGÂN HÀNG CÂU HỎI AI LÀ TRIỆU PHÚ BẰNG RLS
-- Quy tắc:
--   * Admin đang hoạt động: đọc/thêm/sửa/xóa mọi câu tự thêm.
--   * Teacher đang hoạt động: đọc toàn bộ, chỉ thêm và sửa/xóa câu do chính mình tạo.
--   * Viewer đang hoạt động: chỉ đọc.
--   * anon / tài khoản không hoạt động / không có hồ sơ vai trò: không truy cập.
-- Không xóa dữ liệu hiện có.
-- ============================================================

begin;

alter table public.app3_millionaire_questions enable row level security;

-- Không cho khách chưa đăng nhập truy cập trực tiếp bảng câu hỏi.
revoke all on table public.app3_millionaire_questions from anon;

-- Các quyền bảng cần thiết; RLS bên dưới mới quyết định hàng nào được thao tác.
grant select, insert, update, delete on table public.app3_millionaire_questions to authenticated;

-- Helper kiểm tra tài khoản đang hoạt động.
create or replace function public.app3_millionaire_is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.app3_user_roles r
        where r.user_id = auth.uid()
          and r.active = true
          and r.role in ('admin', 'teacher', 'viewer')
    );
$$;

-- Helper kiểm tra quyền quản lý một câu hỏi.
-- Admin: mọi câu. Teacher: chỉ câu do chính mình tạo. Viewer: không ghi.
create or replace function public.app3_millionaire_can_manage(question_owner uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.app3_user_roles r
        where r.user_id = auth.uid()
          and r.active = true
          and (
              r.role = 'admin'
              or (r.role = 'teacher' and question_owner = auth.uid())
          )
    );
$$;

revoke all on function public.app3_millionaire_is_active_user() from public;
revoke all on function public.app3_millionaire_can_manage(uuid) from public;
grant execute on function public.app3_millionaire_is_active_user() to authenticated;
grant execute on function public.app3_millionaire_can_manage(uuid) to authenticated;

-- Gỡ đúng các policy cũ đang cho mọi authenticated ghi/xóa mọi câu.
drop policy if exists millionaire_questions_select on public.app3_millionaire_questions;
drop policy if exists millionaire_questions_insert on public.app3_millionaire_questions;
drop policy if exists millionaire_questions_update on public.app3_millionaire_questions;
drop policy if exists millionaire_questions_delete on public.app3_millionaire_questions;

-- ĐỌC: mọi tài khoản hợp lệ đang hoạt động.
create policy millionaire_questions_select
on public.app3_millionaire_questions
for select
to authenticated
using (public.app3_millionaire_is_active_user());

-- THÊM: Admin hoặc Teacher; created_by phải thuộc người có quyền quản lý.
-- Cột created_by hiện có default auth.uid(), nên code hiện tại không cần thay đổi.
create policy millionaire_questions_insert
on public.app3_millionaire_questions
for insert
to authenticated
with check (public.app3_millionaire_can_manage(created_by));

-- SỬA: Admin sửa mọi câu; Teacher chỉ câu mình tạo.
create policy millionaire_questions_update
on public.app3_millionaire_questions
for update
to authenticated
using (public.app3_millionaire_can_manage(created_by))
with check (public.app3_millionaire_can_manage(created_by));

-- XÓA: Admin xóa mọi câu; Teacher chỉ câu mình tạo.
create policy millionaire_questions_delete
on public.app3_millionaire_questions
for delete
to authenticated
using (public.app3_millionaire_can_manage(created_by));

commit;

-- KIỂM TRA SAU KHI CHẠY (chỉ đọc, không thay đổi dữ liệu):
select policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'app3_millionaire_questions'
order by policyname;
