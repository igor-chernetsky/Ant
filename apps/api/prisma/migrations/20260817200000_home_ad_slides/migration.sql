-- CreateTable
CREATE TABLE "home_ad_slides" (
    "id" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "href" TEXT NOT NULL,
    "image_url" TEXT NOT NULL,
    "title_en" TEXT NOT NULL,
    "title_ru" TEXT NOT NULL,
    "title_th" TEXT NOT NULL,
    "description_en" TEXT NOT NULL,
    "description_ru" TEXT NOT NULL,
    "description_th" TEXT NOT NULL,
    "cta_en" TEXT NOT NULL,
    "cta_ru" TEXT NOT NULL,
    "cta_th" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "home_ad_slides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "home_ad_slides_enabled_sort_order_idx" ON "home_ad_slides"("enabled", "sort_order");

-- Seed default slides
INSERT INTO "home_ad_slides" (
  "id",
  "sort_order",
  "enabled",
  "href",
  "image_url",
  "title_en",
  "title_ru",
  "title_th",
  "description_en",
  "description_ru",
  "description_th",
  "cta_en",
  "cta_ru",
  "cta_th",
  "updated_at"
) VALUES
(
  'a1b2c3d4-e5f6-7890-abcd-ef1234560001',
  0,
  true,
  '/materials',
  '/ads/materials.png',
  'Find materials for your build',
  'Материалы для вашего объекта',
  'หาวัสดุก่อสร้างสำหรับโปรเจกต์',
  'Compare marketplaces and source finishes, fixtures, and building supplies in one place.',
  'Сравнивайте площадки и подбирайте отделку, оборудование и стройматериалы в одном месте.',
  'เปรียบเทียบแพลตฟอร์มและจัดหาวัสดุตกแต่ง อุปกรณ์ และของก่อสร้างในที่เดียว',
  'Browse materials',
  'К материалам',
  'ดูวัสดุ',
  CURRENT_TIMESTAMP
),
(
  'a1b2c3d4-e5f6-7890-abcd-ef1234560002',
  1,
  true,
  '/contractor',
  '/ads/contractor.png',
  'Get project leads on BuilTHAI',
  'Заявки на проекты в BuilTHAI',
  'รับงานโครงการบน BuilTHAI',
  'Create a contractor profile, match tenders in your trades, and send commercial proposals.',
  'Создайте профиль подрядчика, получайте тендеры по своим работам и отправляйте коммерческие предложения.',
  'สร้างโปรไฟล์ผู้รับเหมา จับคู่เทนเดอร์ตามงานที่ถนัด และส่งข้อเสนอเชิงพาณิชย์',
  'Become a contractor',
  'Стать подрядчиком',
  'สมัครเป็นผู้รับเหมา',
  CURRENT_TIMESTAMP
);
