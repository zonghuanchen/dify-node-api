CREATE TABLE "accounts" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"password" varchar(255),
	"password_salt" varchar(255),
	"avatar" varchar(255),
	"interface_language" varchar(255),
	"interface_theme" varchar(255),
	"timezone" varchar(255),
	"last_login_at" timestamp,
	"last_login_ip" varchar(255),
	"last_active_at" timestamp DEFAULT now() NOT NULL,
	"status" varchar(16) DEFAULT 'active' NOT NULL,
	"initialized_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_account_joins" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(36) NOT NULL,
	"account_id" varchar(36) NOT NULL,
	"current" boolean DEFAULT false NOT NULL,
	"role" varchar(16) DEFAULT 'normal' NOT NULL,
	"invited_by" varchar(36),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"last_opened_at" timestamp,
	CONSTRAINT "unique_tenant_account_join" UNIQUE("tenant_id","account_id")
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"encrypt_public_key" text,
	"plan" varchar(255) DEFAULT 'basic' NOT NULL,
	"status" varchar(255) DEFAULT 'normal' NOT NULL,
	"custom_config" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "account_email_idx" ON "accounts" USING btree ("email");--> statement-breakpoint
CREATE INDEX "tenant_account_join_account_id_idx" ON "tenant_account_joins" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "tenant_account_join_tenant_id_idx" ON "tenant_account_joins" USING btree ("tenant_id");