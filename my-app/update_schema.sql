-- Keep id, name, status, event, created_at, updated_at
-- Add the new columns
alter table participants add column register_number text;
alter table participants add column year text;
alter table participants add column department text;
alter table participants add column section text;
alter table participants add column game text;
alter table participants drop column college;
alter table participants drop column team;

-- Update the new columns to be not null if preferred
-- You may want to do this only AFTER filling in default values for existing rows if any
-- alter table participants alter column register_number set not null;
-- alter table participants alter column year set not null;
-- alter table participants alter column department set not null;
-- alter table participants alter column section set not null;
