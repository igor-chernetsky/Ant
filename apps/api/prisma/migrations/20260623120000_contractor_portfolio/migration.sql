-- CreateTable
CREATE TABLE "contractor_portfolio_items" (
    "id" TEXT NOT NULL,
    "contractor_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "original_name" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "size_bytes" INTEGER,
    "storage_key" TEXT NOT NULL,
    "thumbnail_storage_key" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "status" "DocumentStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploaded_at" TIMESTAMP(3),

    CONSTRAINT "contractor_portfolio_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contractor_portfolio_items_storage_key_key" ON "contractor_portfolio_items"("storage_key");

-- CreateIndex
CREATE UNIQUE INDEX "contractor_portfolio_items_thumbnail_storage_key_key" ON "contractor_portfolio_items"("thumbnail_storage_key");

-- CreateIndex
CREATE INDEX "contractor_portfolio_items_contractor_id_sort_order_idx" ON "contractor_portfolio_items"("contractor_id", "sort_order");

-- AddForeignKey
ALTER TABLE "contractor_portfolio_items" ADD CONSTRAINT "contractor_portfolio_items_contractor_id_fkey" FOREIGN KEY ("contractor_id") REFERENCES "contractor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
