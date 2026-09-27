-- ============================================================
-- BƯỚC 166.3.2 - CHO PHÉP KHÁCH CHƯA ĐĂNG NHẬP ĐỌC NỘI DUNG CÔNG KHAI
-- Chỉ mở SELECT cho các bản ghi is_published = true.
-- Không cấp INSERT / UPDATE / DELETE cho anon.
-- Chạy 01 lần trong Supabase SQL Editor.
-- ============================================================

GRANT USAGE ON SCHEMA public TO anon;

GRANT SELECT ON TABLE public.app3_public_posts TO anon;
GRANT SELECT ON TABLE public.app3_public_documents TO anon;
GRANT SELECT ON TABLE public.app3_public_media TO anon;
GRANT SELECT ON TABLE public.app3_public_announcements TO anon;
GRANT SELECT ON TABLE public.app3_public_links TO anon;

DROP POLICY IF EXISTS "anon_read_published_posts" ON public.app3_public_posts;
CREATE POLICY "anon_read_published_posts"
ON public.app3_public_posts
FOR SELECT
TO anon
USING (is_published = true);

DROP POLICY IF EXISTS "anon_read_published_documents" ON public.app3_public_documents;
CREATE POLICY "anon_read_published_documents"
ON public.app3_public_documents
FOR SELECT
TO anon
USING (is_published = true);

DROP POLICY IF EXISTS "anon_read_published_media" ON public.app3_public_media;
CREATE POLICY "anon_read_published_media"
ON public.app3_public_media
FOR SELECT
TO anon
USING (is_published = true);

DROP POLICY IF EXISTS "anon_read_published_announcements" ON public.app3_public_announcements;
CREATE POLICY "anon_read_published_announcements"
ON public.app3_public_announcements
FOR SELECT
TO anon
USING (is_published = true);

DROP POLICY IF EXISTS "anon_read_published_links" ON public.app3_public_links;
CREATE POLICY "anon_read_published_links"
ON public.app3_public_links
FOR SELECT
TO anon
USING (is_published = true);
