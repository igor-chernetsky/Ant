-- CreateTable
CREATE TABLE "estimates" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "type" TEXT NOT NULL DEFAULT 'ballpark',
    "currency" TEXT NOT NULL DEFAULT 'THB',
    "totals_json" JSONB NOT NULL,
    "lines_json" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "disclaimer" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "estimates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "estimates_project_id_idx" ON "estimates"("project_id");

-- AddForeignKey
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
