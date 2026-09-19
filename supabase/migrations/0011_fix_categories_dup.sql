-- 0011_fix_categories_dup.sql
-- 背景：categories 表被种子迁移重复写入两次（16 行仅 8 个唯一值），
--       导致全站分类 chip 重影（悬赏/跑腿/文档设计/问卷/数码/出行/书籍/日用 各出现 2 次），
--       影响：首页 tab、发布任务、二手列表、发布商品。
-- 处理：① 按 (kind, name) 去重，保留一行；② 加唯一约束，从根上防止再次重复播种（迁移幂等）。

-- ① 去重（保留每个 (kind,name) 中最先写入的那行）
DELETE FROM categories a
USING categories b
WHERE a.kind = b.kind
  AND a.name = b.name
  AND a.ctid > b.ctid;

-- ② 唯一约束：种子迁移请统一改写为 ON CONFLICT (kind,name) DO NOTHING
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'categories_kind_name_key'
  ) THEN
    ALTER TABLE categories ADD CONSTRAINT categories_kind_name_key UNIQUE (kind, name);
  END IF;
END $$;
