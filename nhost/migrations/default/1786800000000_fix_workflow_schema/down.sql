ALTER TABLE public.step_runs
DROP COLUMN IF EXISTS error;

ALTER TABLE public.step_runs
DROP COLUMN IF EXISTS approved_at;

ALTER TABLE public.step_runs
DROP COLUMN IF EXISTS approved_by;

ALTER TABLE public.step_runs
DROP COLUMN IF EXISTS attempt_count;

ALTER TABLE public.step_runs
RENAME COLUMN step_id TO workflow_step_id;

ALTER TABLE public.workflow_steps
RENAME COLUMN step_order TO position;
