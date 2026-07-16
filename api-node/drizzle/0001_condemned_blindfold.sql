CREATE TABLE "api_tokens" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"app_id" varchar(36),
	"tenant_id" varchar(36),
	"type" varchar(16) NOT NULL,
	"token" varchar(255) NOT NULL,
	"last_used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_model_configs" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"app_id" varchar(36) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_stars" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(36) NOT NULL,
	"app_id" varchar(36) NOT NULL,
	"account_id" varchar(36) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "unique_app_star_tenant_account_app" UNIQUE("tenant_id","account_id","app_id")
);
--> statement-breakpoint
CREATE TABLE "app_triggers" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(36) NOT NULL,
	"app_id" varchar(36) NOT NULL,
	"node_id" varchar(64),
	"trigger_type" varchar(50) NOT NULL,
	"title" varchar(255) NOT NULL,
	"provider_name" varchar(255),
	"status" varchar(50) DEFAULT 'enabled' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "apps" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(36) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"mode" varchar(255) NOT NULL,
	"icon_type" varchar(255),
	"icon" varchar(255),
	"icon_background" varchar(255),
	"use_icon_as_answer_icon" boolean DEFAULT false NOT NULL,
	"app_model_config_id" varchar(36),
	"workflow_id" varchar(36),
	"status" varchar(255) DEFAULT 'normal' NOT NULL,
	"enable_site" boolean NOT NULL,
	"enable_api" boolean NOT NULL,
	"api_rpm" integer DEFAULT 0 NOT NULL,
	"api_rph" integer DEFAULT 0 NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"is_universal" boolean DEFAULT false NOT NULL,
	"tracing" text,
	"max_active_requests" integer,
	"created_by" varchar(36),
	"maintainer" varchar(36),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" varchar(36),
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dify_setups" (
	"version" varchar(255) PRIMARY KEY NOT NULL,
	"setup_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "end_users" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(36) NOT NULL,
	"app_id" varchar(36),
	"type" varchar(255) NOT NULL,
	"external_user_id" varchar(255),
	"name" varchar(255),
	"is_anonymous" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "installed_apps" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(36) NOT NULL,
	"app_id" varchar(36) NOT NULL,
	"app_owner_tenant_id" varchar(36) NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"last_used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "unique_tenant_app" UNIQUE("tenant_id","app_id")
);
--> statement-breakpoint
CREATE TABLE "provider_credentials" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(36) NOT NULL,
	"provider_name" varchar(255) NOT NULL,
	"credential_name" varchar(255) NOT NULL,
	"encrypted_config" text NOT NULL,
	"user_id" varchar(36),
	"visibility" varchar(40) DEFAULT 'all_team_members' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_model_credentials" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(36) NOT NULL,
	"provider_name" varchar(255) NOT NULL,
	"model_name" varchar(255) NOT NULL,
	"model_type" varchar(40) NOT NULL,
	"credential_name" varchar(255) NOT NULL,
	"encrypted_config" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_model_settings" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(36) NOT NULL,
	"provider_name" varchar(255) NOT NULL,
	"model_name" varchar(255) NOT NULL,
	"model_type" varchar(40) NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"load_balancing_enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_models" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(36) NOT NULL,
	"provider_name" varchar(255) NOT NULL,
	"model_name" varchar(255) NOT NULL,
	"model_type" varchar(40) NOT NULL,
	"credential_id" varchar(36),
	"is_valid" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "unique_provider_model_name" UNIQUE("tenant_id","provider_name","model_name","model_type")
);
--> statement-breakpoint
CREATE TABLE "providers" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(36) NOT NULL,
	"provider_name" varchar(255) NOT NULL,
	"provider_type" varchar(40) DEFAULT 'custom' NOT NULL,
	"is_valid" boolean DEFAULT false NOT NULL,
	"last_used" timestamp,
	"credential_id" varchar(36),
	"quota_type" varchar(40) DEFAULT '',
	"quota_limit" integer,
	"quota_used" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "unique_provider_name_type_quota" UNIQUE("tenant_id","provider_name","provider_type","quota_type")
);
--> statement-breakpoint
CREATE TABLE "recommended_apps" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"app_id" varchar(36) NOT NULL,
	"description" json NOT NULL,
	"copyright" varchar(255) NOT NULL,
	"privacy_policy" varchar(255) NOT NULL,
	"category" varchar(255) NOT NULL,
	"categories" json,
	"custom_disclaimer" text DEFAULT '',
	"position" integer DEFAULT 0 NOT NULL,
	"is_listed" boolean DEFAULT true NOT NULL,
	"is_learn_dify" boolean DEFAULT false NOT NULL,
	"is_cloud_only" boolean DEFAULT false NOT NULL,
	"install_count" integer DEFAULT 0 NOT NULL,
	"language" varchar(255) DEFAULT 'en-US' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sites" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"app_id" varchar(36) NOT NULL,
	"title" varchar(255) DEFAULT '' NOT NULL,
	"icon_type" varchar(255),
	"icon" varchar(255),
	"icon_background" varchar(255),
	"description" text,
	"default_language" varchar(255) DEFAULT 'en-US' NOT NULL,
	"chat_color_theme" varchar(255),
	"chat_color_theme_inverted" boolean DEFAULT false NOT NULL,
	"copyright" varchar(255),
	"privacy_policy" varchar(255),
	"input_placeholder" varchar(255),
	"show_workflow_steps" boolean DEFAULT true NOT NULL,
	"use_icon_as_answer_icon" boolean DEFAULT false NOT NULL,
	"custom_disclaimer" text DEFAULT '',
	"customize_domain" varchar(255),
	"customize_token_strategy" varchar(255) DEFAULT 'must-use' NOT NULL,
	"prompt_public" boolean DEFAULT false NOT NULL,
	"status" varchar(255) DEFAULT 'normal' NOT NULL,
	"code" varchar(255),
	"created_by" varchar(36),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" varchar(36),
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tag_bindings" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(36),
	"tag_id" varchar(36),
	"target_id" varchar(36),
	"created_by" varchar(36) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(36),
	"type" varchar(16) NOT NULL,
	"name" varchar(255) NOT NULL,
	"created_by" varchar(36) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_preferred_model_providers" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(36) NOT NULL,
	"provider_name" varchar(255) NOT NULL,
	"preferred_provider_type" varchar(40) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trial_apps" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"app_id" varchar(36) NOT NULL,
	"tenant_id" varchar(36) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "upload_files" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(36) NOT NULL,
	"storage_type" varchar(255) NOT NULL,
	"key" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"size" integer NOT NULL,
	"extension" varchar(255) NOT NULL,
	"mime_type" varchar(255),
	"created_by_role" varchar(255) DEFAULT 'account' NOT NULL,
	"created_by" varchar(36) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"used" boolean DEFAULT false NOT NULL,
	"used_by" varchar(36),
	"used_at" timestamp,
	"hash" varchar(255),
	"source_url" text DEFAULT ''
);
--> statement-breakpoint
CREATE TABLE "workflow_comment_mentions" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"comment_id" varchar(36) NOT NULL,
	"mentioned_user_id" varchar(36) NOT NULL,
	"reply_id" varchar(36)
);
--> statement-breakpoint
CREATE TABLE "workflow_comment_replies" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"comment_id" varchar(36) NOT NULL,
	"content" text NOT NULL,
	"created_by" varchar(36) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_comments" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(36) NOT NULL,
	"app_id" varchar(36) NOT NULL,
	"position_x" double precision NOT NULL,
	"position_y" double precision NOT NULL,
	"content" text NOT NULL,
	"created_by" varchar(36) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"resolved" boolean DEFAULT false NOT NULL,
	"resolved_at" timestamp,
	"resolved_by" varchar(36)
);
--> statement-breakpoint
CREATE TABLE "workflow_draft_variables" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"app_id" varchar(36) NOT NULL,
	"user_id" varchar(36),
	"last_edited_at" timestamp,
	"node_id" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" varchar(255) DEFAULT '' NOT NULL,
	"selector" varchar(255) NOT NULL,
	"value_type" varchar(20) NOT NULL,
	"value" text NOT NULL,
	"visible" boolean DEFAULT true NOT NULL,
	"editable" boolean DEFAULT false NOT NULL,
	"node_execution_id" varchar(36),
	"file_id" varchar(36),
	"is_default_value" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_runs" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(36) NOT NULL,
	"app_id" varchar(36) NOT NULL,
	"workflow_id" varchar(36) NOT NULL,
	"type" varchar(255) NOT NULL,
	"triggered_from" varchar(255) NOT NULL,
	"version" varchar(255) NOT NULL,
	"graph" text,
	"inputs" text,
	"status" varchar(255) NOT NULL,
	"outputs" text DEFAULT '{}',
	"error" text,
	"elapsed_time" double precision DEFAULT 0 NOT NULL,
	"total_tokens" integer DEFAULT 0 NOT NULL,
	"total_steps" integer DEFAULT 0,
	"created_by_role" varchar(255) NOT NULL,
	"created_by" varchar(36) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp,
	"exceptions_count" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "workflows" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(36) NOT NULL,
	"app_id" varchar(36) NOT NULL,
	"type" varchar(255),
	"kind" varchar(255),
	"version" varchar(255),
	"marked_name" varchar(255) DEFAULT '',
	"marked_comment" varchar(255) DEFAULT '',
	"graph" text,
	"features" text,
	"created_by" varchar(36),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" varchar(36),
	"updated_at" timestamp,
	"environment_variables" text DEFAULT '{}',
	"conversation_variables" text DEFAULT '{}',
	"rag_pipeline_variables" text DEFAULT '{}'
);
--> statement-breakpoint
CREATE INDEX "api_token_app_id_type_idx" ON "api_tokens" USING btree ("app_id","type");--> statement-breakpoint
CREATE INDEX "api_token_token_idx" ON "api_tokens" USING btree ("token","type");--> statement-breakpoint
CREATE INDEX "api_token_tenant_idx" ON "api_tokens" USING btree ("tenant_id","type");--> statement-breakpoint
CREATE INDEX "app_app_id_idx" ON "app_model_configs" USING btree ("app_id");--> statement-breakpoint
CREATE INDEX "app_star_tenant_id_idx" ON "app_stars" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "app_star_app_id_idx" ON "app_stars" USING btree ("app_id");--> statement-breakpoint
CREATE INDEX "app_star_account_id_idx" ON "app_stars" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "app_trigger_tenant_app_idx" ON "app_triggers" USING btree ("tenant_id","app_id");--> statement-breakpoint
CREATE INDEX "app_tenant_id_idx" ON "apps" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "end_user_session_id_idx" ON "end_users" USING btree ("tenant_id","type");--> statement-breakpoint
CREATE INDEX "installed_app_tenant_id_idx" ON "installed_apps" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "installed_app_app_id_idx" ON "installed_apps" USING btree ("app_id");--> statement-breakpoint
CREATE INDEX "provider_credential_tenant_provider_idx" ON "provider_credentials" USING btree ("tenant_id","provider_name");--> statement-breakpoint
CREATE INDEX "provider_model_credential_tenant_provider_model_idx" ON "provider_model_credentials" USING btree ("tenant_id","provider_name","model_name","model_type");--> statement-breakpoint
CREATE INDEX "provider_model_setting_tenant_provider_model_idx" ON "provider_model_settings" USING btree ("tenant_id","provider_name","model_type");--> statement-breakpoint
CREATE INDEX "provider_model_tenant_id_provider_idx" ON "provider_models" USING btree ("tenant_id","provider_name");--> statement-breakpoint
CREATE INDEX "provider_tenant_id_provider_idx" ON "providers" USING btree ("tenant_id","provider_name");--> statement-breakpoint
CREATE INDEX "recommended_app_app_id_idx" ON "recommended_apps" USING btree ("app_id");--> statement-breakpoint
CREATE INDEX "recommended_app_is_listed_idx" ON "recommended_apps" USING btree ("is_listed","language");--> statement-breakpoint
CREATE INDEX "site_app_id_idx" ON "sites" USING btree ("app_id");--> statement-breakpoint
CREATE INDEX "tag_bind_target_id_idx" ON "tag_bindings" USING btree ("target_id");--> statement-breakpoint
CREATE INDEX "tag_bind_tag_id_idx" ON "tag_bindings" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "tag_type_idx" ON "tags" USING btree ("type");--> statement-breakpoint
CREATE INDEX "tag_name_idx" ON "tags" USING btree ("name");--> statement-breakpoint
CREATE INDEX "tenant_preferred_model_provider_tenant_provider_idx" ON "tenant_preferred_model_providers" USING btree ("tenant_id","provider_name");--> statement-breakpoint
CREATE INDEX "trial_app_app_id_idx" ON "trial_apps" USING btree ("app_id");--> statement-breakpoint
CREATE INDEX "trial_app_tenant_id_idx" ON "trial_apps" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "upload_file_tenant_idx" ON "upload_files" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "comment_mentions_comment_idx" ON "workflow_comment_mentions" USING btree ("comment_id");--> statement-breakpoint
CREATE INDEX "comment_mentions_reply_idx" ON "workflow_comment_mentions" USING btree ("reply_id");--> statement-breakpoint
CREATE INDEX "comment_mentions_user_idx" ON "workflow_comment_mentions" USING btree ("mentioned_user_id");--> statement-breakpoint
CREATE INDEX "comment_replies_comment_idx" ON "workflow_comment_replies" USING btree ("comment_id");--> statement-breakpoint
CREATE INDEX "comment_replies_created_at_idx" ON "workflow_comment_replies" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "workflow_comments_app_idx" ON "workflow_comments" USING btree ("tenant_id","app_id");--> statement-breakpoint
CREATE INDEX "workflow_comments_created_at_idx" ON "workflow_comments" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "wdv_app_user_node_name_idx" ON "workflow_draft_variables" USING btree ("app_id","user_id","node_id","name");--> statement-breakpoint
CREATE INDEX "wdv_file_id_idx" ON "workflow_draft_variables" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "workflow_run_triggerd_from_idx" ON "workflow_runs" USING btree ("tenant_id","app_id","triggered_from");--> statement-breakpoint
CREATE INDEX "workflow_run_created_at_id_idx" ON "workflow_runs" USING btree ("created_at","id");--> statement-breakpoint
CREATE INDEX "workflow_version_idx" ON "workflows" USING btree ("tenant_id","app_id","version");