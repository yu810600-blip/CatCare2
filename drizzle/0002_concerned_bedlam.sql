ALTER TABLE `profiles` ADD `start_weight` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `profiles` ADD `program_start` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `profiles` ADD `program_weeks` integer DEFAULT 0 NOT NULL;