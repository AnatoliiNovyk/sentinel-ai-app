-- Batch-84: webhook_url field in projects for alert notifications
ALTER TABLE projects ADD COLUMN IF NOT EXISTS webhook_url text;
