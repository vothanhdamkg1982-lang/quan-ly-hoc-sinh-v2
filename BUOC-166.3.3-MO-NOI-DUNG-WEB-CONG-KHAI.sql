-- ============================================================
-- BƯỚC 166.3.3 - MỞ NỘI DUNG WEBSITE CÔNG KHAI AN TOÀN
-- Mục tiêu:
--   * Khách chưa đăng nhập xem được nội dung đã công khai.
--   * Không cho khách đọc bản nháp / bản đang ẩn.
--   * Không phụ thuộc các policy RLS cũ của bảng quản trị.
--   * Mỗi VIEW chỉ chứa is_published = true.
--
-- Chạy 01 lần trong Supabase > SQL Editor.
-- ============================================================

GRANT USAGE ON SCHEMA public TO anon;

-- 1) TIN TỨC
DO $$
BEGIN
  IF to_regclass('public.app3_public_posts') IS NOT NULL THEN
    EXECUTE 'CREATE OR REPLACE VIEW public.app3_public_posts_live WITH (security_barrier=true) AS SELECT * FROM public.app3_public_posts WHERE is_published IS TRUE';
    EXECUTE 'GRANT SELECT ON public.app3_public_posts_live TO anon, authenticated';
    -- Không cần cho anon đọc bảng gốc. Khách chỉ đọc VIEW đã lọc công khai.
    EXECUTE 'REVOKE SELECT ON public.app3_public_posts FROM anon';
  END IF;
END $$;

-- 2) TÀI LIỆU
DO $$
BEGIN
  IF to_regclass('public.app3_public_documents') IS NOT NULL THEN
    EXECUTE 'CREATE OR REPLACE VIEW public.app3_public_documents_live WITH (security_barrier=true) AS SELECT * FROM public.app3_public_documents WHERE is_published IS TRUE';
    EXECUTE 'GRANT SELECT ON public.app3_public_documents_live TO anon, authenticated';
    EXECUTE 'REVOKE SELECT ON public.app3_public_documents FROM anon';
  END IF;
END $$;

-- 3) HÌNH ẢNH / VIDEO
DO $$
BEGIN
  IF to_regclass('public.app3_public_media') IS NOT NULL THEN
    EXECUTE 'CREATE OR REPLACE VIEW public.app3_public_media_live WITH (security_barrier=true) AS SELECT * FROM public.app3_public_media WHERE is_published IS TRUE';
    EXECUTE 'GRANT SELECT ON public.app3_public_media_live TO anon, authenticated';
    EXECUTE 'REVOKE SELECT ON public.app3_public_media FROM anon';
  END IF;
END $$;

-- 4) THÔNG BÁO
DO $$
BEGIN
  IF to_regclass('public.app3_public_announcements') IS NOT NULL THEN
    EXECUTE 'CREATE OR REPLACE VIEW public.app3_public_announcements_live WITH (security_barrier=true) AS SELECT * FROM public.app3_public_announcements WHERE is_published IS TRUE';
    EXECUTE 'GRANT SELECT ON public.app3_public_announcements_live TO anon, authenticated';
    EXECUTE 'REVOKE SELECT ON public.app3_public_announcements FROM anon';
  END IF;
END $$;

-- 5) LIÊN KẾT WEBSITE
DO $$
BEGIN
  IF to_regclass('public.app3_public_links') IS NOT NULL THEN
    EXECUTE 'CREATE OR REPLACE VIEW public.app3_public_links_live WITH (security_barrier=true) AS SELECT * FROM public.app3_public_links WHERE is_published IS TRUE';
    EXECUTE 'GRANT SELECT ON public.app3_public_links_live TO anon, authenticated';
    EXECUTE 'REVOKE SELECT ON public.app3_public_links FROM anon';
  END IF;
END $$;

-- ============================================================
-- KIỂM TRA SAU KHI CHẠY
-- Kết quả mong đợi: có 5 dòng *_live bên dưới.
-- Nếu thiếu dòng nào thì bảng nguồn tương ứng chưa tồn tại trong Supabase.
-- ============================================================
SELECT
  table_name AS view_name
FROM information_schema.views
WHERE table_schema = 'public'
  AND table_name IN (
    'app3_public_posts_live',
    'app3_public_documents_live',
    'app3_public_media_live',
    'app3_public_announcements_live',
    'app3_public_links_live'
  )
ORDER BY table_name;
