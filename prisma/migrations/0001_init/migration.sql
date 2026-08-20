-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "invoice" (
    "id" TEXT NOT NULL,
    "document_type" TEXT NOT NULL,
    "series" TEXT NOT NULL,
    "correlative" INTEGER NOT NULL,
    "issue_date" TIMESTAMP(3) NOT NULL,
    "currency" TEXT NOT NULL,
    "issuer_ruc" TEXT NOT NULL,
    "issuer_business_name" TEXT NOT NULL,
    "issuer_trade_name" TEXT,
    "issuer_ubigeo" TEXT,
    "issuer_department" TEXT,
    "issuer_province" TEXT,
    "issuer_district" TEXT,
    "issuer_address_line" TEXT,
    "customer_ruc" TEXT NOT NULL,
    "customer_business_name" TEXT NOT NULL,
    "taxable_amount" DECIMAL(12,2) NOT NULL,
    "igv" DECIMAL(12,2) NOT NULL,
    "sale_value" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "status" TEXT NOT NULL,
    "sunat_file_name" TEXT,
    "cdr_response_code" TEXT,
    "cdr_description" TEXT,
    "cdr_notes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "cdr_zip_base64" TEXT,
    "signed_xml" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_item" (
    "id" TEXT NOT NULL,
    "id_invoice" TEXT NOT NULL,
    "line_number" INTEGER NOT NULL,
    "code" TEXT,
    "description" TEXT NOT NULL,
    "unit_code" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unit_value" DECIMAL(12,2) NOT NULL,
    "taxable_amount" DECIMAL(12,2) NOT NULL,
    "igv" DECIMAL(12,2) NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "invoice_item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "invoice_issuer_ruc_idx" ON "invoice"("issuer_ruc");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_issuer_ruc_document_type_series_correlative_key" ON "invoice"("issuer_ruc", "document_type", "series", "correlative");

-- CreateIndex
CREATE INDEX "invoice_item_id_invoice_idx" ON "invoice_item"("id_invoice");

-- AddForeignKey
ALTER TABLE "invoice_item" ADD CONSTRAINT "invoice_item_id_invoice_fkey" FOREIGN KEY ("id_invoice") REFERENCES "invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

