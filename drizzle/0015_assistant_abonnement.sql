CREATE TABLE "assistant_months" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"kind" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"credits" integer NOT NULL,
	"extra_credits" integer DEFAULT 0 NOT NULL,
	"used" integer DEFAULT 0 NOT NULL,
	"payment_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assistant_months_used_check" CHECK ("assistant_months"."used" >= 0 and "assistant_months"."used" <= "assistant_months"."credits" + "assistant_months"."extra_credits")
);
--> statement-breakpoint
CREATE TABLE "assistant_payments" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"kind" text NOT NULL,
	"months" integer DEFAULT 0 NOT NULL,
	"credits" integer DEFAULT 0 NOT NULL,
	"amount" integer NOT NULL,
	"method" text NOT NULL,
	"note" text,
	"recorded_by" text,
	"paid_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assistant_months" ADD CONSTRAINT "assistant_months_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_months" ADD CONSTRAINT "assistant_months_payment_id_assistant_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."assistant_payments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_payments" ADD CONSTRAINT "assistant_payments_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_payments" ADD CONSTRAINT "assistant_payments_recorded_by_user_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assistant_months_business_idx" ON "assistant_months" USING btree ("business_id","starts_at");--> statement-breakpoint
CREATE UNIQUE INDEX "assistant_months_essai_idx" ON "assistant_months" USING btree ("business_id") WHERE "assistant_months"."kind" = 'essai';--> statement-breakpoint
CREATE INDEX "assistant_payments_business_idx" ON "assistant_payments" USING btree ("business_id");