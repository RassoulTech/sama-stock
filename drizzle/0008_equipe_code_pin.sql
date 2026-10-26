CREATE TABLE "shop_devices" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"name" text NOT NULL,
	"token_hash" text NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "shop_devices_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "pin_hash" text;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "pin_failures" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "pin_locked_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "pin_set_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "shop_devices" ADD CONSTRAINT "shop_devices_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_devices" ADD CONSTRAINT "shop_devices_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "shop_devices_business_idx" ON "shop_devices" USING btree ("business_id");