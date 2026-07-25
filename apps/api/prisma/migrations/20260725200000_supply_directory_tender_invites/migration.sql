-- CreateEnum
CREATE TYPE "SupplyDirectoryKind" AS ENUM ('contractor', 'designer', 'supplier');

-- CreateTable
CREATE TABLE "supply_directory_entries" (
    "id" TEXT NOT NULL,
    "kind" "SupplyDirectoryKind" NOT NULL,
    "company_name" TEXT NOT NULL,
    "contact_name" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "website" TEXT,
    "region_slug" TEXT,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supply_directory_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tender_invites" (
    "id" TEXT NOT NULL,
    "tender_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "directory_entry_id" TEXT,
    "invited_by_id" TEXT NOT NULL,
    "kind" "SupplyDirectoryKind" NOT NULL,
    "recipient_email" TEXT NOT NULL,
    "recipient_name" TEXT,
    "token_hash" TEXT NOT NULL,
    "sent_at" TIMESTAMP(3),
    "opened_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tender_invites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "supply_directory_entries_kind_is_active_sort_order_idx" ON "supply_directory_entries"("kind", "is_active", "sort_order");

-- CreateIndex
CREATE INDEX "supply_directory_entries_email_idx" ON "supply_directory_entries"("email");

-- CreateIndex
CREATE UNIQUE INDEX "tender_invites_token_hash_key" ON "tender_invites"("token_hash");

-- CreateIndex
CREATE INDEX "tender_invites_tender_id_idx" ON "tender_invites"("tender_id");

-- CreateIndex
CREATE INDEX "tender_invites_project_id_idx" ON "tender_invites"("project_id");

-- CreateIndex
CREATE INDEX "tender_invites_recipient_email_idx" ON "tender_invites"("recipient_email");

-- AddForeignKey
ALTER TABLE "tender_invites" ADD CONSTRAINT "tender_invites_tender_id_fkey" FOREIGN KEY ("tender_id") REFERENCES "tenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tender_invites" ADD CONSTRAINT "tender_invites_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tender_invites" ADD CONSTRAINT "tender_invites_directory_entry_id_fkey" FOREIGN KEY ("directory_entry_id") REFERENCES "supply_directory_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tender_invites" ADD CONSTRAINT "tender_invites_invited_by_id_fkey" FOREIGN KEY ("invited_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
