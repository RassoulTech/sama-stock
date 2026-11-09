CREATE TABLE "assistant_usage" (
	"business_id" text NOT NULL,
	"day" date NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "assistant_usage_business_id_day_pk" PRIMARY KEY("business_id","day")
);
--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "assistant_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "assistant_usage" ADD CONSTRAINT "assistant_usage_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;