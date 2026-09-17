CREATE TABLE `astro_cache` (
	`key` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL,
	`computed_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `block_completions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`block_id` integer NOT NULL,
	`status` text NOT NULL,
	`at` text NOT NULL,
	FOREIGN KEY (`block_id`) REFERENCES `blocks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `block_completions_unique` ON `block_completions` (`date`,`block_id`);--> statement-breakpoint
CREATE INDEX `block_completions_date_idx` ON `block_completions` (`date`);--> statement-breakpoint
CREATE TABLE `blocks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`routine_id` integer NOT NULL,
	`title` text NOT NULL,
	`detail` text DEFAULT '' NOT NULL,
	`category` text NOT NULL,
	`anchor` text DEFAULT 'sunrise' NOT NULL,
	`offset_minutes` integer DEFAULT 0 NOT NULL,
	`duration_minutes` integer DEFAULT 15 NOT NULL,
	`fuel` text DEFAULT 'any' NOT NULL,
	`weekday_mask` integer DEFAULT 127 NOT NULL,
	`notify` integer DEFAULT false NOT NULL,
	`notify_lead_minutes` integer DEFAULT 5 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`icon` text DEFAULT 'dot' NOT NULL,
	`science_ids` text DEFAULT '[]' NOT NULL,
	`href` text,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`routine_id`) REFERENCES `routines`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `blocks_routine_idx` ON `blocks` (`routine_id`);--> statement-breakpoint
CREATE INDEX `blocks_routine_order_idx` ON `blocks` (`routine_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `caffeine_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`at_minute` integer NOT NULL,
	`milligrams` integer DEFAULT 80 NOT NULL,
	`source` text DEFAULT 'coffee' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `caffeine_logs_date_idx` ON `caffeine_logs` (`date`);--> statement-breakpoint
CREATE TABLE `day_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`wake_minute` integer,
	`sleep_minute` integer,
	`sleep_quality` integer,
	`resting_hr` integer,
	`mood` integer,
	`energy` integer,
	`hard_task_before_noon` integer,
	`morning_light` integer,
	`notes` text DEFAULT '' NOT NULL,
	`tomorrow_intention` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `day_logs_date_unique` ON `day_logs` (`date`);--> statement-breakpoint
CREATE INDEX `day_logs_date_idx` ON `day_logs` (`date`);--> statement-breakpoint
CREATE TABLE `game_results` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`game` text NOT NULL,
	`at` text NOT NULL,
	`at_minute` integer,
	`duration_seconds` integer DEFAULT 0 NOT NULL,
	`primary_metric` real,
	`metrics` text DEFAULT '{}' NOT NULL,
	`is_practice` integer DEFAULT false NOT NULL,
	`notes` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `game_results_date_idx` ON `game_results` (`date`);--> statement-breakpoint
CREATE INDEX `game_results_game_idx` ON `game_results` (`game`,`date`);--> statement-breakpoint
CREATE TABLE `hydration_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`milliliters` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `hydration_logs_date_unique` ON `hydration_logs` (`date`);--> statement-breakpoint
CREATE INDEX `hydration_logs_date_idx` ON `hydration_logs` (`date`);--> statement-breakpoint
CREATE TABLE `meals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`kind` text NOT NULL,
	`at_minute` integer NOT NULL,
	`size` integer DEFAULT 3 NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `meals_date_idx` ON `meals` (`date`);--> statement-breakpoint
CREATE TABLE `notification_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`block_id` integer DEFAULT 0 NOT NULL,
	`kind` text NOT NULL,
	`sent_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notification_unique` ON `notification_log` (`date`,`block_id`,`kind`);--> statement-breakpoint
CREATE TABLE `papers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source` text NOT NULL,
	`doi` text,
	`pmid` text,
	`pmcid` text,
	`title` text NOT NULL,
	`authors` text DEFAULT '' NOT NULL,
	`journal` text DEFAULT '' NOT NULL,
	`year` integer,
	`abstract` text DEFAULT '' NOT NULL,
	`url` text DEFAULT '' NOT NULL,
	`evidence_type` text DEFAULT 'other' NOT NULL,
	`is_open_access` integer DEFAULT false NOT NULL,
	`cited_by_count` integer,
	`tags` text DEFAULT '[]' NOT NULL,
	`card_ids` text DEFAULT '[]' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`saved_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `papers_doi_unique` ON `papers` (`doi`);--> statement-breakpoint
CREATE INDEX `papers_saved_idx` ON `papers` (`saved_at`);--> statement-breakpoint
CREATE TABLE `practice_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`kind` text NOT NULL,
	`practice_slug` text DEFAULT '' NOT NULL,
	`start_minute` integer,
	`duration_seconds` integer DEFAULT 0 NOT NULL,
	`rounds` integer,
	`empty_stomach_confirmed` integer DEFAULT false NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `practice_sessions_date_idx` ON `practice_sessions` (`date`);--> statement-breakpoint
CREATE TABLE `push_subscriptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`endpoint` text NOT NULL,
	`p256dh` text NOT NULL,
	`auth` text NOT NULL,
	`user_agent` text DEFAULT '' NOT NULL,
	`time_zone` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`last_seen_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `push_subscriptions_endpoint_unique` ON `push_subscriptions` (`endpoint`);--> statement-breakpoint
CREATE INDEX `push_endpoint_idx` ON `push_subscriptions` (`endpoint`);--> statement-breakpoint
CREATE TABLE `routines` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`is_preset` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `routines_slug_unique` ON `routines` (`slug`);--> statement-breakpoint
CREATE TABLE `science_notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`card_id` text NOT NULL,
	`body` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `science_notes_card_idx` ON `science_notes` (`card_id`);--> statement-breakpoint
CREATE TABLE `search_cache` (
	`key` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL,
	`fetched_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`city` text DEFAULT 'Hyderabad' NOT NULL,
	`region` text DEFAULT 'Telangana' NOT NULL,
	`latitude` real DEFAULT 17.385 NOT NULL,
	`longitude` real DEFAULT 78.4867 NOT NULL,
	`time_zone` text DEFAULT 'Asia/Kolkata' NOT NULL,
	`muhurta_mode` text DEFAULT 'fixed' NOT NULL,
	`wake_offset_minutes` integer DEFAULT -75 NOT NULL,
	`sleep_target_minutes` integer DEFAULT 465 NOT NULL,
	`chronotype` text DEFAULT 'unknown' NOT NULL,
	`chronotype_score` integer,
	`active_track` text DEFAULT 'gentle' NOT NULL,
	`active_routine_id` integer,
	`track_started_on` text,
	`theme` text DEFAULT 'dark' NOT NULL,
	`clock_24h` integer DEFAULT false NOT NULL,
	`dosha_accent` integer DEFAULT true NOT NULL,
	`reduce_motion` integer DEFAULT false NOT NULL,
	`notify_enabled` integer DEFAULT false NOT NULL,
	`caffeine_cutoff_hours` real DEFAULT 8.5 NOT NULL,
	`dinner_gap_target_minutes` integer DEFAULT 180 NOT NULL,
	`onboarded_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `workout_sets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`workout_id` integer NOT NULL,
	`exercise_slug` text NOT NULL,
	`set_index` integer NOT NULL,
	`reps` integer,
	`weight_kg` real,
	`hold_seconds` integer,
	`rpe` real,
	`is_warmup` integer DEFAULT false NOT NULL,
	`completed` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`workout_id`) REFERENCES `workouts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `workout_sets_workout_idx` ON `workout_sets` (`workout_id`);--> statement-breakpoint
CREATE INDEX `workout_sets_exercise_idx` ON `workout_sets` (`exercise_slug`);--> statement-breakpoint
CREATE TABLE `workouts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`track` text DEFAULT 'gentle' NOT NULL,
	`session_slug` text NOT NULL,
	`session_name` text NOT NULL,
	`start_minute` integer,
	`duration_minutes` integer,
	`fasted` integer DEFAULT false NOT NULL,
	`session_rpe` integer,
	`week_in_cycle` integer,
	`is_deload` integer DEFAULT false NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `workouts_date_idx` ON `workouts` (`date`);