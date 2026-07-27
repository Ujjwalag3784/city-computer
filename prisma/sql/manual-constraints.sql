-- City Computer — manual (raw-SQL) constraints and database objects.
--
-- WHY THIS FILE EXISTS
-- Prisma's schema DSL cannot express every constraint docs/06-DATA-MODEL.md
-- requires: CHECK constraints, partial/filtered unique indexes, generated
-- tsvector columns + triggers, ancestry-maintaining triggers, and REVOKE
-- statements for append-only tables. Every `// TODO(raw-sql): ...` comment
-- in prisma/schema/*.prisma has exactly one corresponding block below.
--
-- HOW TO RUN THIS
-- This file is NOT picked up automatically by `prisma migrate`. The first
-- time this project runs `pnpm db:migrate` against a real Postgres
-- instance, create a migration to carry it, e.g.:
--
--   pnpm db:migrate --name manual_constraints --create-only
--   # then paste (or `cat prisma/sql/manual-constraints.sql >>`) this
--   # file's contents into the generated
--   # prisma/migrations/<timestamp>_manual_constraints/migration.sql
--   pnpm db:migrate
--
-- This sandbox has no Postgres connection and no network access to
-- Prisma's engine-binary CDN, so none of this has been executed or
-- verified here — treat it as a careful first draft, not a proven script.
-- Every statement is written to be idempotent-safe to re-run
-- (`IF NOT EXISTS` / `DROP ... IF EXISTS` before `CREATE`) so it is safe to
-- replay against a partially-applied database.
--
-- Run this file's statements in the order given — later sections
-- (triggers) depend on earlier ones (extensions, columns).

-- ============================================================================
-- 1. EXTENSIONS (docs/06-DATA-MODEL.md §11)
-- ============================================================================
-- pgvector is explicitly deferred to v2 (semantic build recommendations) —
-- do not add it here.

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS btree_gin;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- 2. CHECK CONSTRAINTS (docs/06-DATA-MODEL.md §12)
-- ============================================================================

-- #7 — User has email or phone (auth.prisma User).
ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_email_or_phone_required,
  ADD CONSTRAINT users_email_or_phone_required
    CHECK (email IS NOT NULL OR phone IS NOT NULL);

-- #1 — Variant.pricePaisa > 0 (catalog.prisma Variant).
ALTER TABLE variants
  DROP CONSTRAINT IF EXISTS variants_price_positive,
  ADD CONSTRAINT variants_price_positive
    CHECK (price_paisa > 0);

-- #2 — compareAtPricePaisa IS NULL OR > pricePaisa (catalog.prisma Variant).
ALTER TABLE variants
  DROP CONSTRAINT IF EXISTS variants_compare_at_price_gt_price,
  ADD CONSTRAINT variants_compare_at_price_gt_price
    CHECK (compare_at_price_paisa IS NULL OR compare_at_price_paisa > price_paisa);

-- #3 — StockLevel.quantity >= 0 and reservedQuantity >= 0 (inventory.prisma StockLevel).
ALTER TABLE stock_levels
  DROP CONSTRAINT IF EXISTS stock_levels_quantity_non_negative,
  ADD CONSTRAINT stock_levels_quantity_non_negative
    CHECK (quantity >= 0);

ALTER TABLE stock_levels
  DROP CONSTRAINT IF EXISTS stock_levels_reserved_quantity_non_negative,
  ADD CONSTRAINT stock_levels_reserved_quantity_non_negative
    CHECK (reserved_quantity >= 0);

-- Note: rule #4 (reservedQuantity <= quantity unless allowBackorder) is
-- NOT enforced here — it depends on Variant.allow_backorder, a sibling
-- table, which a single-table CHECK cannot see. Enforced service-side
-- inside the same transaction that mutates stock_levels.

-- #5 — Order total arithmetic (commerce.prisma Order).
-- total = subtotal - discount + shipping + (tax if NOT tax_inclusive).
ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_total_arithmetic,
  ADD CONSTRAINT orders_total_arithmetic
    CHECK (
      total_paisa = subtotal_paisa - discount_paisa + shipping_paisa
        + (CASE WHEN NOT tax_inclusive THEN tax_paisa ELSE 0 END)
    );

-- Review.rating between 1 and 5 (catalog.prisma Review — not itemised with
-- a number in §12, but flagged inline in the schema).
ALTER TABLE reviews
  DROP CONSTRAINT IF EXISTS reviews_rating_range,
  ADD CONSTRAINT reviews_rating_range
    CHECK (rating BETWEEN 1 AND 5);

-- ============================================================================
-- 3. PARTIAL / FILTERED UNIQUE INDEXES
-- ============================================================================

-- #6 — Exactly one Variant.isDefault per product (catalog.prisma Variant).
DROP INDEX IF EXISTS variants_one_default_per_product;
CREATE UNIQUE INDEX variants_one_default_per_product
  ON variants (product_id)
  WHERE is_default;

-- ============================================================================
-- 4. PARTIAL INDEXES FOR KNOWN ACCESS PATHS (docs/06-DATA-MODEL.md §11)
-- ============================================================================

-- Low stock report.
DROP INDEX IF EXISTS stock_levels_low_stock_partial;
CREATE INDEX stock_levels_low_stock_partial
  ON stock_levels (branch_id, quantity)
  WHERE quantity <= 5;

-- Payment reconciliation sweep.
DROP INDEX IF EXISTS payments_reconciliation_sweep_partial;
CREATE INDEX payments_reconciliation_sweep_partial
  ON payments (status, created_at)
  WHERE status IN ('INITIATED', 'PENDING');

-- ============================================================================
-- 5. FULL-TEXT SEARCH — Product.searchVector (docs/06-DATA-MODEL.md §11)
-- ============================================================================
-- Modelled in Prisma as `Unsupported("tsvector")` on the `search_vector`
-- column, which Prisma leaves entirely alone. Weights:
--   A = display_title
--   B = brand.name + sku (via variants, first/default variant)
--   C = short_description + category path
--   D = filterable spec values (product_specs where is_filterable)
--
-- A trigger-based approach (rather than a GENERATED column) is used
-- because the weighted vector pulls from three other tables (brands,
-- categories, product_specs), which a single-table GENERATED ALWAYS AS
-- column cannot reference.

CREATE OR REPLACE FUNCTION products_search_vector_refresh() RETURNS trigger AS $$
DECLARE
  brand_name text;
  category_path text;
  primary_sku text;
  spec_text text;
BEGIN
  SELECT b.name INTO brand_name FROM brands b WHERE b.id = NEW.brand_id;
  SELECT c.path INTO category_path FROM categories c WHERE c.id = NEW.primary_category_id;
  SELECT v.sku INTO primary_sku FROM variants v
    WHERE v.product_id = NEW.id
    ORDER BY v.is_default DESC, v.position ASC
    LIMIT 1;
  SELECT string_agg(DISTINCT coalesce(ps.value_text, ps.value_number::text, ''), ' ')
    INTO spec_text
    FROM product_specs ps
    WHERE ps.product_id = NEW.id AND ps.is_filterable;

  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.display_title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(brand_name, '') || ' ' || coalesce(primary_sku, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.short_description, '') || ' ' || coalesce(category_path, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(spec_text, '')), 'D');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS products_search_vector_trigger ON products;
CREATE TRIGGER products_search_vector_trigger
  BEFORE INSERT OR UPDATE OF display_title, short_description, brand_id, primary_category_id
  ON products
  FOR EACH ROW
  EXECUTE FUNCTION products_search_vector_refresh();

-- product_specs changes don't fire the trigger above (it's on `products`),
-- so re-touch the parent row whenever a filterable spec changes. This
-- keeps weight-D content current without a second, duplicated trigger
-- function.
CREATE OR REPLACE FUNCTION product_specs_touch_product() RETURNS trigger AS $$
BEGIN
  UPDATE products SET updated_at = updated_at WHERE id = coalesce(NEW.product_id, OLD.product_id);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS product_specs_touch_product_trigger ON product_specs;
CREATE TRIGGER product_specs_touch_product_trigger
  AFTER INSERT OR UPDATE OR DELETE ON product_specs
  FOR EACH ROW
  EXECUTE FUNCTION product_specs_touch_product();

DROP INDEX IF EXISTS products_search_vector_gin;
CREATE INDEX products_search_vector_gin ON products USING GIN (search_vector);

-- pg_trgm fuzzy search / duplicate detection.
DROP INDEX IF EXISTS products_name_trgm_gin;
CREATE INDEX products_name_trgm_gin ON products USING GIN (name gin_trgm_ops);

DROP INDEX IF EXISTS variants_sku_trgm_gin;
CREATE INDEX variants_sku_trgm_gin ON variants USING GIN (sku gin_trgm_ops);

-- Post.searchVector — same pattern, simpler (no cross-table weights beyond
-- the post itself).
CREATE OR REPLACE FUNCTION posts_search_vector_refresh() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.excerpt, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS posts_search_vector_trigger ON posts;
CREATE TRIGGER posts_search_vector_trigger
  BEFORE INSERT OR UPDATE OF title, excerpt
  ON posts
  FOR EACH ROW
  EXECUTE FUNCTION posts_search_vector_refresh();

DROP INDEX IF EXISTS posts_search_vector_gin;
CREATE INDEX posts_search_vector_gin ON posts USING GIN (search_vector);

-- ============================================================================
-- 6. CATEGORY ANCESTRY TRIGGER (docs/06-DATA-MODEL.md §12 #8)
-- ============================================================================
-- Keeps `categories.path` consistent with the parent chain (materialised
-- path, e.g. `laptops/gaming`) whenever a category's slug or parent
-- changes. Also cascades the recomputation to descendants.

CREATE OR REPLACE FUNCTION categories_path_refresh() RETURNS trigger AS $$
DECLARE
  parent_path text;
  parent_depth int;
BEGIN
  IF NEW.parent_id IS NULL THEN
    NEW.path := NEW.slug;
    NEW.depth := 0;
  ELSE
    SELECT path, depth INTO parent_path, parent_depth FROM categories WHERE id = NEW.parent_id;
    IF parent_path IS NULL THEN
      RAISE EXCEPTION 'Category %.parent_id % does not exist', NEW.id, NEW.parent_id;
    END IF;
    NEW.path := parent_path || '/' || NEW.slug;
    NEW.depth := parent_depth + 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS categories_path_refresh_trigger ON categories;
CREATE TRIGGER categories_path_refresh_trigger
  BEFORE INSERT OR UPDATE OF slug, parent_id ON categories
  FOR EACH ROW
  EXECUTE FUNCTION categories_path_refresh();

-- Recompute every descendant's path/depth after an ancestor's path changes
-- (AFTER trigger so it can see the already-updated row, and re-fires the
-- BEFORE trigger above on each descendant via a plain UPDATE).
CREATE OR REPLACE FUNCTION categories_path_cascade() RETURNS trigger AS $$
BEGIN
  IF NEW.path IS DISTINCT FROM OLD.path THEN
    UPDATE categories SET slug = slug WHERE parent_id = NEW.id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS categories_path_cascade_trigger ON categories;
CREATE TRIGGER categories_path_cascade_trigger
  AFTER UPDATE OF path ON categories
  FOR EACH ROW
  EXECUTE FUNCTION categories_path_cascade();

-- ============================================================================
-- 7. APPEND-ONLY TABLES — REVOKE UPDATE/DELETE (docs/06-DATA-MODEL.md §12 #10)
-- ============================================================================
-- `app_user` is a PLACEHOLDER for whatever the application's runtime DB
-- role ends up being named (see docs/03-TECHNOLOGY-STACK.md for the actual
-- connection role). Rename every occurrence below to match before running.
-- If the role does not exist yet in the target environment, these REVOKE
-- statements are no-ops on a role that already has no such grant, but the
-- statement will still error if the role name itself doesn't exist — grant
-- statements to a real role name should replace `app_user` first.

REVOKE UPDATE, DELETE ON audit_logs FROM app_user;
REVOKE UPDATE, DELETE ON stock_movements FROM app_user;
REVOKE UPDATE, DELETE ON order_status_events FROM app_user;
REVOKE UPDATE, DELETE ON payment_events FROM app_user;
REVOKE UPDATE, DELETE ON build_revisions FROM app_user;

-- ============================================================================
-- 8. NOTES ON GENERATED-COLUMN ALTERNATIVE (not used, for the record)
-- ============================================================================
-- An earlier draft considered `GENERATED ALWAYS AS (...) STORED` tsvector
-- columns instead of triggers. Rejected because Product.searchVector needs
-- data from brands/categories/product_specs, which a same-row GENERATED
-- expression cannot read. Triggers are the correct tool here, not a
-- workaround.
