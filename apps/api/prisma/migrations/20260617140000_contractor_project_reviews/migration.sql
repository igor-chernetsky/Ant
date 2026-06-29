-- CreateTable
CREATE TABLE "contractor_project_reviews" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "contractor_id" TEXT NOT NULL,
    "bid_id" TEXT NOT NULL,
    "comment" TEXT,
    "ratings_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contractor_project_reviews_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "project_review_attachments" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "review_id" TEXT,
    "original_name" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "storage_key" TEXT NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'pending',
    "uploaded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_review_attachments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "contractor_project_reviews_project_id_key" ON "contractor_project_reviews"("project_id");
CREATE UNIQUE INDEX "contractor_project_reviews_bid_id_key" ON "contractor_project_reviews"("bid_id");
CREATE INDEX "contractor_project_reviews_contractor_id_idx" ON "contractor_project_reviews"("contractor_id");
CREATE INDEX "contractor_project_reviews_client_id_idx" ON "contractor_project_reviews"("client_id");
CREATE INDEX "project_review_attachments_project_id_idx" ON "project_review_attachments"("project_id");
CREATE INDEX "project_review_attachments_review_id_idx" ON "project_review_attachments"("review_id");

ALTER TABLE "contractor_project_reviews" ADD CONSTRAINT "contractor_project_reviews_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contractor_project_reviews" ADD CONSTRAINT "contractor_project_reviews_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contractor_project_reviews" ADD CONSTRAINT "contractor_project_reviews_contractor_id_fkey" FOREIGN KEY ("contractor_id") REFERENCES "contractor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contractor_project_reviews" ADD CONSTRAINT "contractor_project_reviews_bid_id_fkey" FOREIGN KEY ("bid_id") REFERENCES "bids"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_review_attachments" ADD CONSTRAINT "project_review_attachments_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_review_attachments" ADD CONSTRAINT "project_review_attachments_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_review_attachments" ADD CONSTRAINT "project_review_attachments_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "contractor_project_reviews"("id") ON DELETE SET NULL ON UPDATE CASCADE;
