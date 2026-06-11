CREATE TABLE "app_users" (
  "id" TEXT NOT NULL,
  "clerk_id" TEXT NOT NULL,
  "email" TEXT,
  "name" TEXT,
  "image_url" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "app_users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "reports" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "company_name" TEXT NOT NULL,
  "website" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "logo_url" TEXT,
  "competitors" JSONB NOT NULL DEFAULT '[]',
  "prompts" JSONB NOT NULL DEFAULT '[]',
  "analysis" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "app_users_clerk_id_key" ON "app_users"("clerk_id");
CREATE INDEX "reports_user_id_created_at_idx" ON "reports"("user_id", "created_at");

ALTER TABLE "reports"
  ADD CONSTRAINT "reports_user_id_fkey"
  FOREIGN KEY ("user_id")
  REFERENCES "app_users"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;
