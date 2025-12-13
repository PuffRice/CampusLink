-- Service Requests Table
-- This table stores all service requests submitted by students

CREATE TABLE IF NOT EXISTS public.service_requests (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  request_type VARCHAR(50) NOT NULL,
  -- Types: academic, technical, facilities, financial, health, document, other
  description TEXT NOT NULL,
  file_url TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  -- Statuses: pending, in_progress, completed
  staff_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_service_requests_user_id ON public.service_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_status ON public.service_requests(status);
CREATE INDEX IF NOT EXISTS idx_service_requests_created_at ON public.service_requests(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Students can see only their own requests
CREATE POLICY student_view_own_requests ON public.service_requests
  FOR SELECT
  USING (user_id = (SELECT id FROM public.users WHERE id = auth.uid()::int));

-- RLS Policy: Students can insert their own requests
CREATE POLICY student_insert_own_requests ON public.service_requests
  FOR INSERT
  WITH CHECK (user_id = (SELECT id FROM public.users WHERE id = auth.uid()::int));

-- RLS Policy: Staff/Admin can see all requests
CREATE POLICY staff_view_all_requests ON public.service_requests
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()::int
      AND role IN ('staff', 'admin')
    )
  );

-- RLS Policy: Staff/Admin can update requests
CREATE POLICY staff_update_requests ON public.service_requests
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()::int
      AND role IN ('staff', 'admin')
    )
  );

-- Grant permissions
GRANT SELECT, INSERT ON public.service_requests TO authenticated;
GRANT SELECT, UPDATE ON public.service_requests TO authenticated;
