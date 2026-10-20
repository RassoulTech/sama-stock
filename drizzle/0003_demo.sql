ALTER TABLE "businesses" ADD COLUMN "is_demo" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "demo_reset_at" timestamp with time zone;