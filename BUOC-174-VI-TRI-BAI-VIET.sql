-- BƯỚC 174 – VỊ TRÍ HIỂN THỊ BÀI VIẾT TRÊN WEBSITE
-- Chỉ chạy trên môi trường thử nghiệm sau khi đã sao lưu dữ liệu.
-- Không xóa bảng, không xóa bài viết, không thay đổi vai trò / chính sách RLS.
-- placement: featured = thẻ tin lớn, news = danh sách tin, both = cả hai.

BEGIN;

ALTER TABLE public.app3_public_posts
ADD COLUMN IF NOT EXISTS placement text NOT NULL DEFAULT 'news';

-- Bài viết cũ mặc định ở Danh sách tin; an toàn khi chạy lại.
UPDATE public.app3_public_posts
SET placement = 'news'
WHERE placement IS NULL OR placement NOT IN ('featured', 'news', 'both');

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'app3_public_posts_placement_check'
          AND conrelid = 'public.app3_public_posts'::regclass
    ) THEN
        ALTER TABLE public.app3_public_posts
        ADD CONSTRAINT app3_public_posts_placement_check
        CHECK (placement IN ('featured', 'news', 'both'));
    END IF;
END $$;

-- VIEW đang có của bước 166.3.3 chỉ trả về các bài đã công khai.
-- Thêm cột mới vào cuối danh sách cột VIEW để không thay đổi các cột cũ.
CREATE OR REPLACE VIEW public.app3_public_posts_live
WITH (security_barrier=true)
AS SELECT * FROM public.app3_public_posts WHERE is_published IS TRUE;

GRANT SELECT ON public.app3_public_posts_live TO anon, authenticated;
REVOKE SELECT ON public.app3_public_posts FROM anon;

COMMIT;

-- KIỂM TRA (chỉ đọc):
SELECT placement, is_published, count(*) AS so_bai
FROM public.app3_public_posts
GROUP BY placement, is_published
ORDER BY placement, is_published DESC;
