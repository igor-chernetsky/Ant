-- AlterTable
ALTER TABLE "projects" ADD COLUMN "estimate_refinement_qa_json" JSONB;

-- AlterTable
ALTER TABLE "estimates" ADD COLUMN "meta_json" JSONB;
