-- CreateEnum
CREATE TYPE "ProjectType" AS ENUM ('renovation', 'new_build', 'extension', 'commercial_fitout', 'repair', 'other');
CREATE TYPE "PropertyType" AS ENUM ('apartment', 'house', 'commercial', 'land', 'other');
CREATE TYPE "TagSource" AS ENUM ('client', 'ai');

-- CreateTable
CREATE TABLE "tag_groups" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "tag_groups_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "group_id" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "project_tags" (
    "project_id" TEXT NOT NULL,
    "tag_id" TEXT NOT NULL,
    "source" "TagSource" NOT NULL DEFAULT 'client',
    CONSTRAINT "project_tags_pkey" PRIMARY KEY ("project_id","tag_id")
);

-- AlterTable
ALTER TABLE "projects" ADD COLUMN "project_type" "ProjectType" NOT NULL DEFAULT 'other';
ALTER TABLE "projects" ADD COLUMN "property_type" "PropertyType";
ALTER TABLE "projects" ADD COLUMN "district" TEXT;
ALTER TABLE "projects" ADD COLUMN "readiness_score" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "tag_groups_slug_key" ON "tag_groups"("slug");
CREATE UNIQUE INDEX "tags_slug_key" ON "tags"("slug");
CREATE INDEX "tags_group_id_idx" ON "tags"("group_id");
CREATE INDEX "project_tags_tag_id_idx" ON "project_tags"("tag_id");
CREATE INDEX "projects_project_type_idx" ON "projects"("project_type");

-- AddForeignKey
ALTER TABLE "tags" ADD CONSTRAINT "tags_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "tag_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "project_tags" ADD CONSTRAINT "project_tags_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_tags" ADD CONSTRAINT "project_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed tag groups
INSERT INTO "tag_groups" ("id", "slug", "label", "sort_order") VALUES
  ('00000000-0000-4000-8000-000000000001', 'trade', 'Trade & scope', 1),
  ('00000000-0000-4000-8000-000000000002', 'phase', 'Project phase', 2);

-- Seed system tags
INSERT INTO "tags" ("id", "slug", "label", "group_id", "is_system") VALUES
  ('10000000-0000-4000-8000-000000000001', 'electrical', 'Electrical', '00000000-0000-4000-8000-000000000001', true),
  ('10000000-0000-4000-8000-000000000002', 'plumbing', 'Plumbing', '00000000-0000-4000-8000-000000000001', true),
  ('10000000-0000-4000-8000-000000000003', 'roofing', 'Roofing', '00000000-0000-4000-8000-000000000001', true),
  ('10000000-0000-4000-8000-000000000004', 'finishing', 'Finishing', '00000000-0000-4000-8000-000000000001', true),
  ('10000000-0000-4000-8000-000000000005', 'demolition', 'Demolition', '00000000-0000-4000-8000-000000000001', true),
  ('10000000-0000-4000-8000-000000000006', 'structural', 'Structural', '00000000-0000-4000-8000-000000000001', true),
  ('10000000-0000-4000-8000-000000000007', 'hvac', 'HVAC', '00000000-0000-4000-8000-000000000001', true),
  ('10000000-0000-4000-8000-000000000008', 'painting', 'Painting', '00000000-0000-4000-8000-000000000001', true),
  ('10000000-0000-4000-8000-000000000009', 'flooring', 'Flooring', '00000000-0000-4000-8000-000000000001', true),
  ('10000000-0000-4000-8000-000000000010', 'tiling', 'Tiling', '00000000-0000-4000-8000-000000000001', true),
  ('10000000-0000-4000-8000-000000000011', 'carpentry', 'Carpentry', '00000000-0000-4000-8000-000000000001', true),
  ('10000000-0000-4000-8000-000000000012', 'landscaping', 'Landscaping', '00000000-0000-4000-8000-000000000001', true),
  ('10000000-0000-4000-8000-000000000013', 'insulation', 'Insulation', '00000000-0000-4000-8000-000000000001', true),
  ('10000000-0000-4000-8000-000000000014', 'windows-doors', 'Windows & doors', '00000000-0000-4000-8000-000000000001', true),
  ('10000000-0000-4000-8000-000000000015', 'concrete', 'Concrete', '00000000-0000-4000-8000-000000000001', true),
  ('10000000-0000-4000-8000-000000000016', 'masonry', 'Masonry', '00000000-0000-4000-8000-000000000001', true),
  ('10000000-0000-4000-8000-000000000017', 'design', 'Design & planning', '00000000-0000-4000-8000-000000000002', true),
  ('10000000-0000-4000-8000-000000000018', 'permits', 'Permits & compliance', '00000000-0000-4000-8000-000000000002', true);
