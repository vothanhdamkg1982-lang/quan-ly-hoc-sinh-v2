-- BƯỚC 167.1
-- Nâng cấp ngân hàng câu hỏi dùng chung cho CTGDPT 2018.
-- An toàn với dữ liệu cũ: chỉ ADD COLUMN IF NOT EXISTS, không xóa/đổi cột hiện có.
-- Chạy 01 lần trong Supabase SQL Editor trước khi dùng app.js mới.

begin;

alter table public.app3_millionaire_questions
    add column if not exists curriculum_code text,
    add column if not exists week integer,
    add column if not exists ppct integer,
    add column if not exists subject_code text,
    add column if not exists lesson_name text,
    add column if not exists lesson_key text;

-- Dữ liệu cũ vẫn được giữ nguyên và được đánh dấu LEGACY.
update public.app3_millionaire_questions
set curriculum_code = 'LEGACY'
where curriculum_code is null or btrim(curriculum_code) = '';

create index if not exists idx_app3_mq_lesson_lookup
on public.app3_millionaire_questions
    (grade, subject, week, ppct, lesson_key)
where active = true;

create index if not exists idx_app3_mq_lesson_key
on public.app3_millionaire_questions (lesson_key)
where lesson_key is not null;

comment on column public.app3_millionaire_questions.curriculum_code is
'Chương trình câu hỏi: GDPT2018 cho dữ liệu chính thức; LEGACY cho dữ liệu cũ.';
comment on column public.app3_millionaire_questions.week is
'Tuần dạy học 1-35.';
comment on column public.app3_millionaire_questions.ppct is
'Số PPCT của bài/tiết theo kế hoạch dạy học.';
comment on column public.app3_millionaire_questions.subject_code is
'Mã môn ổn định để liên kết dữ liệu chương trình.';
comment on column public.app3_millionaire_questions.lesson_name is
'Tên bài học chính xác theo chương trình.';
comment on column public.app3_millionaire_questions.lesson_key is
'Khóa bài học ổn định dùng chung cho Ai là triệu phú, Trắc nghiệm hình ảnh và Gọi tên + Trả lời.';

commit;

-- KIỂM TRA SAU KHI CHẠY
select
    column_name,
    data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'app3_millionaire_questions'
  and column_name in (
      'curriculum_code','week','ppct','subject_code','lesson_name','lesson_key'
  )
order by ordinal_position;
