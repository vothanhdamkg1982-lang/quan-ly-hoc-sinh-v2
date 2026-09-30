-- BƯỚC 151.49.3E.3-R1
-- Cho website công khai đọc DUY NHẤT tổng lượt truy cập,
-- không cho anon đọc từng dòng/session_key trong app3_site_visits.

create or replace function public.app3_public_visit_total()
returns bigint
language sql
security definer
set search_path = public
stable
as $$
    select count(*)::bigint
    from public.app3_site_visits;
$$;

revoke all on function public.app3_public_visit_total() from public;
grant execute on function public.app3_public_visit_total() to anon, authenticated;
