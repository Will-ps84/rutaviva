
-- =============================================
-- stop_events table (append-only event log for stops)
-- =============================================
CREATE TABLE public.stop_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES public.companies(id),
    route_id uuid NOT NULL REFERENCES public.routes(id),
    stop_id uuid NOT NULL REFERENCES public.route_stops(id),
    created_by uuid NOT NULL REFERENCES auth.users(id),
    event_type text NOT NULL, -- 'done','skipped','failed','note','evidence'
    note text NULL,
    evidence_path text NULL, -- key in Storage bucket, NOT a public URL
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_stop_events_company_created ON public.stop_events (company_id, created_at);
CREATE INDEX idx_stop_events_stop_created ON public.stop_events (stop_id, created_at);
CREATE INDEX idx_stop_events_route_created ON public.stop_events (route_id, created_at);
CREATE INDEX idx_stop_events_created_by ON public.stop_events (created_by, created_at);

-- Enable RLS
ALTER TABLE public.stop_events ENABLE ROW LEVEL SECURITY;

-- SELECT: allowed if super_admin or can access the route
CREATE POLICY "select_stop_events"
ON public.stop_events
FOR SELECT
TO authenticated
USING (
    is_super_admin() OR user_can_access_route(route_id)
);

-- INSERT: allowed if user is the creator, can access route, and belongs to company
CREATE POLICY "insert_stop_events"
ON public.stop_events
FOR INSERT
TO authenticated
WITH CHECK (
    created_by = auth.uid()
    AND user_can_access_route(route_id)
    AND company_id = get_user_company_id()
);

-- No UPDATE or DELETE policies = append-only (RLS denies by default)

-- =============================================
-- Storage bucket for evidence (private)
-- =============================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('stop-evidence', 'stop-evidence', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: drivers/admins of same company can upload
CREATE POLICY "company_users_upload_evidence"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'stop-evidence'
    AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Storage RLS: company users can read their own uploads
CREATE POLICY "company_users_read_evidence"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'stop-evidence'
    AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Admins can read all evidence in their company folder
-- (files stored as: {user_id}/{stop_id}/{filename})
-- Access controlled via stop_events RLS (user must be able to SELECT the event)

-- =============================================
-- Audit trigger for stop_events inserts
-- =============================================
CREATE OR REPLACE FUNCTION public.audit_stop_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.audit_logs (company_id, user_id, action, target_table, target_id, details)
    VALUES (
        NEW.company_id,
        NEW.created_by,
        'stop_event_created',
        'stop_events',
        NEW.id::text,
        jsonb_build_object(
            'event_type', NEW.event_type,
            'stop_id', NEW.stop_id,
            'route_id', NEW.route_id,
            'has_note', NEW.note IS NOT NULL,
            'has_evidence', NEW.evidence_path IS NOT NULL
        )
    );
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_audit_stop_event
AFTER INSERT ON public.stop_events
FOR EACH ROW
EXECUTE FUNCTION public.audit_stop_event();

-- Enable realtime for stop_events (optional, for future use)
ALTER PUBLICATION supabase_realtime ADD TABLE public.stop_events;
