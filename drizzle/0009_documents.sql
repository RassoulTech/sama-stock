CREATE TABLE "document_items" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"product_id" text,
	"name" text NOT NULL,
	"unit" text NOT NULL,
	"quantity" numeric(14, 3) NOT NULL,
	"unit_price" integer NOT NULL,
	"line_total" integer NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"type" text NOT NULL,
	"number" text NOT NULL,
	"status" text NOT NULL,
	"sale_id" text,
	"customer_id" text,
	"customer" jsonb NOT NULL,
	"seller" jsonb NOT NULL,
	"vat_rate" integer DEFAULT 0 NOT NULL,
	"subtotal" integer DEFAULT 0 NOT NULL,
	"discount" integer DEFAULT 0 NOT NULL,
	"delivery_fee" integer DEFAULT 0 NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
	"valid_until" timestamp with time zone,
	"note" text,
	"footer" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cancelled_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "ninea" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "rccm" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "vat_rate" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "document_footer" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "quote_validity_days" integer DEFAULT 15 NOT NULL;--> statement-breakpoint
ALTER TABLE "document_items" ADD CONSTRAINT "document_items_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_items" ADD CONSTRAINT "document_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "document_items_document_idx" ON "document_items" USING btree ("document_id");--> statement-breakpoint
CREATE UNIQUE INDEX "documents_business_number_uq" ON "documents" USING btree ("business_id","number");--> statement-breakpoint
CREATE INDEX "documents_business_type_created_idx" ON "documents" USING btree ("business_id","type","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "documents_invoice_sale_uq" ON "documents" USING btree ("sale_id") WHERE "documents"."type" = 'facture' and "documents"."status" = 'emise';