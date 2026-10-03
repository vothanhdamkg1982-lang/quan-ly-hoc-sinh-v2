-- BƯỚC 170: Kho minh chứng câu hỏi và kết quả học tập theo từng học sinh.
-- CHẠY MỘT LẦN TRONG SUPABASE SQL EDITOR (kiểm thử ở dự án thử trước).
-- Không thay đổi bảng điểm, câu hỏi, hồ sơ học sinh hay nhận xét hiện có.
begin;
create table if not exists public.app3_game_results (
 id uuid primary key default gen_random_uuid(),
 session_id uuid not null,
 activity_type text not null check (activity_type in ('call-answer','image-quiz')),
 student_id uuid not null references public.app3_students(id) on delete cascade,
 class_id uuid not null references public.app3_classes(id),
 subject_id text not null,
 subject_name text not null,
 grade text,
 lesson_name text,
 question_id text,
 question_key text not null,
 question_text text not null,
 answer_options jsonb not null default '[]'::jsonb,
 curriculum_code text,
 week integer,
 ppct integer,
 lesson_key text,
 selected_index smallint check (selected_index is null or selected_index between 0 and 3),
 correct_index smallint not null check (correct_index between 0 and 3),
 status text not null check (status in ('correct','wrong','timeout')),
 created_by uuid not null default auth.uid(),
 recorded_at timestamptz not null default now(),
 linked_comment_id uuid references public.app3_learning_comments(id) on delete set null,
 unique(session_id,student_id,question_key)
);
create index if not exists app3_game_results_student_date_idx on public.app3_game_results(student_id,recorded_at desc);
create index if not exists app3_game_results_session_idx on public.app3_game_results(session_id,student_id);
alter table public.app3_game_results enable row level security;
revoke all on public.app3_game_results from anon;
grant select,insert to authenticated on public.app3_game_results;
grant update(linked_comment_id) on public.app3_game_results to authenticated;

create or replace function public.app3_game_is_admin() returns boolean
language sql stable security definer set search_path = public as $$
 select exists(select 1 from public.app3_user_roles r where r.user_id=auth.uid() and r.active=true and r.role='admin');
$$;
create or replace function public.app3_game_can_record(p_class uuid,p_subject text,p_student uuid) returns boolean
language sql stable security definer set search_path = public as $$
 select exists (
  select 1 from public.app3_user_roles r
  join public.app3_students s on s.id=p_student and s.class_id=p_class
  where r.user_id=auth.uid() and r.active=true and r.role in ('admin','teacher')
    and (r.role='admin' or coalesce(r.access_scope,'all') <> 'assigned'
      or exists(select 1 from public.app3_teacher_assignments a where a.user_id=auth.uid()
         and a.active=true and a.class_id=p_class and a.subject_id::text=p_subject))
 );
$$;
revoke all on function public.app3_game_is_admin() from public;
revoke all on function public.app3_game_can_record(uuid,text,uuid) from public;
grant execute on function public.app3_game_is_admin() to authenticated;
grant execute on function public.app3_game_can_record(uuid,text,uuid) to authenticated;

drop policy if exists app3_game_results_read on public.app3_game_results;
create policy app3_game_results_read on public.app3_game_results for select to authenticated
using ((created_by=auth.uid() or public.app3_game_is_admin())
 and exists(select 1 from public.app3_user_roles r where r.user_id=auth.uid() and r.active=true and r.role in ('admin','teacher')));
drop policy if exists app3_game_results_insert on public.app3_game_results;
create policy app3_game_results_insert on public.app3_game_results for insert to authenticated
with check (created_by=auth.uid() and linked_comment_id is null
 and public.app3_game_can_record(class_id,subject_id,student_id));
drop policy if exists app3_game_results_link on public.app3_game_results;
create policy app3_game_results_link on public.app3_game_results for update to authenticated
using ((created_by=auth.uid() or public.app3_game_is_admin())
 and public.app3_game_can_record(class_id,subject_id,student_id))
with check ((created_by=auth.uid() or public.app3_game_is_admin())
 and public.app3_game_can_record(class_id,subject_id,student_id)
 and (linked_comment_id is null or exists(
  select 1 from public.app3_learning_comments c where c.id=linked_comment_id
   and c.student_id=student_id and c.class_id=class_id and c.subject_id::text=subject_id)));

-- Tạo nhận xét và nối minh chứng trong MỘT giao dịch: nếu bước nào lỗi đều rollback.
create or replace function public.app3_create_game_comment(
 p_session_id uuid,p_student_id uuid,p_comment_type text,p_content text,p_teacher_name text default null
) returns uuid language plpgsql security invoker set search_path = public as $$
declare v_result public.app3_game_results%rowtype; v_comment uuid;
begin
 if trim(coalesce(p_content,''))='' or length(p_content)>3000 then
   raise exception 'Nội dung nhận xét phải từ 1 đến 3000 ký tự';
 end if;
 if p_comment_type not in ('Tiến bộ','Cần cố gắng','Học tập sa sút','Nhận xét khác') then
   raise exception 'Loại nhận xét không hợp lệ';
 end if;
 select * into v_result from public.app3_game_results
  where session_id=p_session_id and student_id=p_student_id
  order by recorded_at,id limit 1 for update;
 if not found then raise exception 'Không tìm thấy minh chứng hoặc không có quyền truy cập'; end if;
 if not public.app3_game_can_record(v_result.class_id,v_result.subject_id,p_student_id) then
   raise exception 'Không có quyền nhận xét học sinh này';
 end if;
 if exists(select 1 from public.app3_game_results
  where session_id=p_session_id and student_id=p_student_id and linked_comment_id is not null) then
   raise exception 'Lượt học này đã được liên kết nhận xét';
 end if;
 insert into public.app3_learning_comments
  (student_id,class_id,subject_id,comment_datetime,subject,comment_type,content,teacher_name)
 values (p_student_id,v_result.class_id,v_result.subject_id,now(),v_result.subject_name,
         p_comment_type,trim(p_content),nullif(trim(coalesce(p_teacher_name,'')),''))
 returning id into v_comment;
 update public.app3_game_results set linked_comment_id=v_comment
  where session_id=p_session_id and student_id=p_student_id and linked_comment_id is null;
 return v_comment;
end;$$;
revoke all on function public.app3_create_game_comment(uuid,uuid,text,text,text) from public;
grant execute on function public.app3_create_game_comment(uuid,uuid,text,text,text) to authenticated;
commit;
notify pgrst, 'reload schema';
