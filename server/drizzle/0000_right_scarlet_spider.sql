CREATE TABLE `device_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`device` text NOT NULL,
	`timestamp` text NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_device_logs_device` ON `device_logs` (`device`);--> statement-breakpoint
CREATE INDEX `idx_device_logs_timestamp` ON `device_logs` (`timestamp`);--> statement-breakpoint
CREATE TABLE `devices` (
	`id` text PRIMARY KEY NOT NULL,
	`user` text NOT NULL,
	`label` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`last_seen` text,
	FOREIGN KEY (`user`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_devices_user_id` ON `devices` (`user`);--> statement-breakpoint
CREATE TABLE `manager_state` (
	`device` text PRIMARY KEY NOT NULL,
	`user` text NOT NULL,
	`locked` integer DEFAULT false NOT NULL,
	`timezone` text NOT NULL,
	`last_heartbeat` text,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `schedules` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`hour` integer NOT NULL,
	`minute` integer DEFAULT 0 NOT NULL,
	`params` text,
	`timezone` text,
	`last_run_time` text,
	`run_count` integer DEFAULT 0 NOT NULL,
	`cooldown_until` text,
	`device` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_schedules_device` ON `schedules` (`device`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`stage` text NOT NULL,
	`status` text,
	`params` text,
	`payload` text,
	`created_at` text NOT NULL,
	`started_at` text,
	`completed_at` text,
	`duration` integer,
	`device` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_tasks_device` ON `tasks` (`device`);--> statement-breakpoint
CREATE INDEX `idx_tasks_created_at` ON `tasks` (`created_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
