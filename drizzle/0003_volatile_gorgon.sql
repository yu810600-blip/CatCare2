ALTER TABLE `profiles` ADD `hidden_records` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `profiles` ADD `hidden_fields` text DEFAULT '{}' NOT NULL;