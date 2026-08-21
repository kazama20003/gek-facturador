
-- CreateTable
CREATE TABLE "sunat_submission" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "ticket" TEXT NOT NULL,
    "status_code" TEXT NOT NULL,
    "cdr_response_code" TEXT,
    "cdr_description" TEXT,
    "cdr_notes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "cdr_zip_base64" TEXT,
    "signed_xml" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sunat_submission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sunat_submission_kind_document_id_idx" ON "sunat_submission"("kind", "document_id");
