CREATE TABLE `profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text DEFAULT '' NOT NULL,
	`birthday` text DEFAULT '' NOT NULL,
	`sex` text DEFAULT '' NOT NULL,
	`height` real DEFAULT 0 NOT NULL,
	`target_weight` real DEFAULT 0 NOT NULL,
	`calorie_goal` integer DEFAULT 0 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
DROP TABLE `entries`;--> statement-breakpoint
CREATE TABLE `entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`category` text NOT NULL,
	`recorded_at` text NOT NULL,
	`data` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_entries_user_date` ON `entries` (`user_id`,`recorded_at`);
