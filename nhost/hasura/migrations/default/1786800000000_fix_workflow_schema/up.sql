ALTER TABLE public.workflow_steps
RENAME COLUMN position TO step_order;

ALTER TABLE public.step_runs
RENAME COLUMN workflow_step_id TO step_id;

ALTER TABLE public.step_runs
ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.step_runs
ADD COLUMN IF NOT EXISTS approved_by uuid;

ALTER TABLE public.step_runs
ADD COLUMN IF NOT EXISTS approved_at timestamptz;

ALTER TABLE public.step_runs
ADD COLUMN IF NOT EXISTS error text;
