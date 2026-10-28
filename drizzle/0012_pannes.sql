CREATE TABLE "app_errors" (
	"id" text PRIMARY KEY NOT NULL,
	"fingerprint" text NOT NULL,
	"source" text NOT NULL,
	"route" text NOT NULL,
	"message" text NOT NULL,
	"digest" text,
	"count" integer DEFAULT 1 NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"alerted_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "app_errors_fingerprint_unique" UNIQUE("fingerprint")
);
--> statement-breakpoint
CREATE INDEX "app_errors_last_seen_idx" ON "app_errors" USING btree ("last_seen_at");