-- BƯỚC 171: Chạy trên bản sao Supabase trước khi đưa vào hoạt động.
-- Không chạy lại SQL bước 170 cũ (chứa chính sách từng được sửa thủ công).
-- Yêu cầu: app3_game_can_record, app3_game_is_admin, app3_learning_comments,
-- app3_game_results đã hoạt động và phân quyền đúng như bước 170 đã sửa.
begin;
-- Bước 170 chỉ chấp nhận hai loại: bổ sung Ai là triệu phú, không thay bảng cũ.
alter table public.app3_game_results drop constraint if exists app3_game_results_activity_type_check;
alter table public.app3_game_results add constraint app3_game_results_activity_type_check
 check(activity_type in ('call-answer','image-quiz','millionaire'));
create table if not exists public.app3_period_reviews (
 id uuid primary key default gen_random_uuid(),
 student_id uuid not null references public.app3_students(id),
 class_id uuid not null references public.app3_classes(id),
 subject_id text not null,
 subject_name text not null,
 grade text not null check(grade in ('3','4','5')),
 school_year text not null check(school_year ~ '^20[0-9]{2}-20[0-9]{2}$'),
 period text not null check(period in ('GK1','GK2')),
 range_start date not null,
 range_end date not null,
 evidence_count integer not null default 0 check(evidence_count>=0),
 session_count integer not null default 0 check(session_count>=0),
 correct_count integer not null default 0 check(correct_count>=0),
 activity_breakdown jsonb not null default '{}'::jsonb,
 final_level text not null check(final_level in ('Hoàn thành tốt','Hoàn thành','Chưa hoàn thành')),
 content text not null check(length(btrim(content)) between 1 and 3000),
 teacher_name text,
 created_by uuid not null default auth.uid(),
 created_at timestamptz not null default now(),
 comment_id uuid not null references public.app3_learning_comments(id),
 constraint app3_period_reviews_one_per_period unique(student_id,subject_id,school_year,period),
 constraint app3_period_reviews_date_order check(range_start<=range_end)
);
create index if not exists app3_period_reviews_student_idx on public.app3_period_reviews(student_id,school_year,period);
alter table public.app3_period_reviews enable row level security;
revoke all on public.app3_period_reviews from anon;
grant select,insert on public.app3_period_reviews to authenticated;

drop policy if exists app3_period_reviews_select on public.app3_period_reviews;
create policy app3_period_reviews_select on public.app3_period_reviews
 for select to authenticated using (
  (created_by=auth.uid() or public.app3_game_is_admin())
  and public.app3_game_can_record(class_id,subject_id,student_id)
 );
drop policy if exists app3_period_reviews_insert on public.app3_period_reviews;
create policy app3_period_reviews_insert on public.app3_period_reviews
 for insert to authenticated with check (
  created_by=auth.uid()
  and public.app3_game_can_record(class_id,subject_id,student_id)
 );

-- Atomic: xác thực quyền -> tính lại thống kê tại máy chủ -> tạo nhận xét
-- trong app3_learning_comments -> lưu báo cáo; lỗi ở bước nào cũng rollback.
create or replace function public.app3_save_period_review(
 p_student_id uuid,p_class_id uuid,p_subject_id text,p_subject_name text,
 p_grade text,p_school_year text,p_period text,p_start date,p_end date,
 p_final_level text,p_content text,p_teacher_name text default null
) returns uuid language plpgsql security invoker set search_path = public as $$
declare
 v_report uuid;v_comment uuid;v_count integer;v_correct integer;v_sessions integer;v_breakdown jsonb;
 v_from timestamptz;v_to timestamptz;v_school_start integer;
begin
 if not public.app3_game_can_record(p_class_id,p_subject_id,p_student_id) then
  raise exception 'Tài khoản không được phân công cho học sinh, lớp và môn này';
 end if;
 if p_grade not in ('3','4','5') or p_period not in ('GK1','GK2') or
   p_final_level not in ('Hoàn thành tốt','Hoàn thành','Chưa hoàn thành') or
   p_school_year !~ '^20[0-9]{2}-20[0-9]{2}$' or
   length(btrim(coalesce(p_content,''))) not between 1 and 3000 or
   p_start is null or p_end is null or p_start > p_end or p_end > current_date then
  raise exception 'Thông tin hoặc thời gian đánh giá không hợp lệ';
 end if;
 v_school_start=substring(p_school_year from 1 for 4)::integer;
 if substring(p_school_year from 6 for 4)::integer <> v_school_start + 1 then
  raise exception 'Năm học không hợp lệ';
 end if;
 if (p_period='GK1' and (p_start<make_date(v_school_start,8,1) or p_end>=make_date(v_school_start+1,1,1)))
    or (p_period='GK2' and (p_start<make_date(v_school_start+1,1,1) or p_end>=make_date(v_school_start+1,8,1))) then
  raise exception 'Khoảng thời gian không khớp giữa học kỳ và năm học';
 end if;
 if exists(select 1 from public.app3_period_reviews where student_id=p_student_id
   and subject_id=p_subject_id and school_year=p_school_year and period=p_period) then
  raise exception 'Đã có nhận xét giữa kỳ cho học sinh và môn này; không tạo bản trùng';
 end if;
 v_from=(p_start::text || ' 00:00:00+07')::timestamptz;
 v_to=((p_end+1)::text || ' 00:00:00+07')::timestamptz;
 select count(*)::integer,
        count(*) filter(where status='correct')::integer,
        count(distinct session_id)::integer
 into v_count,v_correct,v_sessions
 from public.app3_game_results
 where student_id=p_student_id and class_id=p_class_id and subject_id=p_subject_id
 and recorded_at>=v_from and recorded_at<v_to and grade=p_grade;
 select coalesce(jsonb_object_agg(activity_type,rows_count),'{}'::jsonb)
 into v_breakdown from (
   select activity_type,count(*)::integer as rows_count from public.app3_game_results
   where student_id=p_student_id and class_id=p_class_id and subject_id=p_subject_id
   and recorded_at>=v_from and recorded_at<v_to and grade=p_grade
   group by activity_type
 ) x;
 insert into public.app3_learning_comments
   (student_id,class_id,subject_id,comment_datetime,subject,comment_type,content,teacher_name)
 values (p_student_id,p_class_id,p_subject_id,now(),p_subject_name,'Nhận xét khác',
   (case when p_period='GK1' then 'Giữa học kỳ I' else 'Giữa học kỳ II' end)
   ||' ('||p_school_year||') – '||p_final_level||': '||btrim(p_content),
   nullif(btrim(coalesce(p_teacher_name,'')),'')) returning id into v_comment;
 insert into public.app3_period_reviews
 (student_id,class_id,subject_id,subject_name,grade,school_year,period,range_start,range_end,
 evidence_count,session_count,correct_count,activity_breakdown,final_level,content,teacher_name,comment_id)
 values(p_student_id,p_class_id,p_subject_id,p_subject_name,p_grade,p_school_year,p_period,p_start,p_end,
 v_count,v_sessions,v_correct,coalesce(v_breakdown,'{}'::jsonb),p_final_level,btrim(p_content),
 nullif(btrim(coalesce(p_teacher_name,'')),''),v_comment)
 returning id into v_report;
 return v_report;
end;$$;
revoke all on function public.app3_save_period_review(uuid,uuid,text,text,text,text,text,date,date,text,text,text) from public;
grant execute on function public.app3_save_period_review(uuid,uuid,text,text,text,text,text,date,date,text,text,text) to authenticated;
-- Chặn sửa/xóa nội dung đã duyệt mà không đồng bộ báo cáo gốc.
-- Không ảnh hưởng nhận xét thường xuyên hay thao tác INSERT mới.
create or replace function public.app3_protect_period_comment()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if exists(select 1 from public.app3_period_reviews where comment_id=old.id) then
    raise exception 'Nhận xét giữa kỳ đã duyệt được khóa; cần quy trình hiệu đính có lịch sử';
 end if;
 if TG_OP='UPDATE' then return new; end if;
 return old;
end;$$;
drop trigger if exists app3_protect_period_comment_trg on public.app3_learning_comments;
create trigger app3_protect_period_comment_trg
 before update or delete on public.app3_learning_comments
 for each row execute function public.app3_protect_period_comment();
revoke all on function public.app3_protect_period_comment() from public;
commit;
notify pgrst, 'reload schema';
