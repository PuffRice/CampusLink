# Service Request Module - Database Setup

## Step-by-Step Setup Guide

### Step 1: Access Supabase SQL Editor
1. Go to your Supabase project dashboard
2. Click on "SQL Editor" in the left sidebar
3. Click "New Query"

### Step 2: Copy and Paste the SQL

Copy the entire SQL from below and paste it into the SQL Editor:

```sql
-- Create service_requests table
CREATE TABLE IF NOT EXISTS public.service_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  request_type VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  file_url TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  staff_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_service_requests_user_id ON public.service_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_status ON public.service_requests(status);
CREATE INDEX IF NOT EXISTS idx_service_requests_created_at ON public.service_requests(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;

-- Policy 1: Students can view only their own requests
CREATE POLICY student_view_own_requests ON public.service_requests
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy 2: Students can insert their own requests
CREATE POLICY student_insert_own_requests ON public.service_requests
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy 3: Staff/Admin can view all requests
CREATE POLICY staff_view_all_requests ON public.service_requests
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role IN ('staff', 'admin')
    )
  );

-- Policy 4: Staff/Admin can update requests
CREATE POLICY staff_update_requests ON public.service_requests
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role IN ('staff', 'admin')
    )
  );

-- Grant permissions
GRANT SELECT, INSERT ON public.service_requests TO authenticated;
GRANT UPDATE ON public.service_requests TO authenticated;
```

### Step 3: Execute the SQL
1. Click the blue "Run" button in the SQL Editor
2. You should see success messages
3. The table is now created!

### Step 4: Verify Table Was Created
1. Go to "Table Editor" in the left sidebar
2. You should see `service_requests` in the list
3. Click it to view the table structure
4. Verify these columns exist:
   - `id` (UUID)
   - `user_id` (UUID)
   - `request_type` (text)
   - `description` (text)
   - `file_url` (text)
   - `status` (text)
   - `staff_notes` (text)
   - `created_at` (timestamp)
   - `updated_at` (timestamp)

### Step 5: Verify RLS Policies
1. Click on the `service_requests` table
2. Click "RLS" tab at the top
3. You should see 4 policies:
   - `student_view_own_requests`
   - `student_insert_own_requests`
   - `staff_view_all_requests`
   - `staff_update_requests`

### Step 6: Test the Setup
1. Run the application
2. Log in as a student
3. Go to "Service Requests" in sidebar
4. Try submitting a request
5. If successful, the setup is complete!

## Troubleshooting

### Error: "Table already exists"
- This is fine! The `IF NOT EXISTS` clause means it won't create duplicates
- Continue with verification steps

### Error: "Permission denied" or "RLS policy error"
- Make sure you're running the SQL as a Supabase admin
- Check that the users table has the `role` column
- Verify that your user has role='admin' or role='staff' if testing as staff

### Table exists but no policies
- The policies may not have been created due to an error
- Run just the policy creation SQL:

```sql
-- Drop existing policies if they exist
DROP POLICY IF EXISTS student_view_own_requests ON public.service_requests;
DROP POLICY IF EXISTS student_insert_own_requests ON public.service_requests;
DROP POLICY IF EXISTS staff_view_all_requests ON public.service_requests;
DROP POLICY IF EXISTS staff_update_requests ON public.service_requests;

-- Recreate policies
CREATE POLICY student_view_own_requests ON public.service_requests
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY student_insert_own_requests ON public.service_requests
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY staff_view_all_requests ON public.service_requests
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role IN ('staff', 'admin')
    )
  );

CREATE POLICY staff_update_requests ON public.service_requests
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role IN ('staff', 'admin')
    )
  );
```

### File upload not working
- Ensure the `course-files` bucket exists in Supabase Storage
- Check that the bucket has public read access (for downloaded files)
- Verify the bucket name matches in the code: `course-files`

## Database Backup

Before running the SQL, you can backup by exporting:
1. Go to "Table Editor"
2. Right-click on any table
3. Click "Export" → "CSV" (for backup)

## Rollback Instructions

If you need to delete the table and start over:

```sql
-- Drop the table (be careful - this deletes all data!)
DROP TABLE IF EXISTS public.service_requests CASCADE;
```

Then run the setup SQL again.

## Testing Queries

Once the table is created, you can test with these queries:

```sql
-- View all requests
SELECT * FROM service_requests ORDER BY created_at DESC;

-- View requests by status
SELECT * FROM service_requests WHERE status = 'pending' ORDER BY created_at DESC;

-- View requests by student
SELECT * FROM service_requests WHERE user_id = 'YOUR_USER_ID' ORDER BY created_at DESC;

-- Count requests by status
SELECT status, COUNT(*) FROM service_requests GROUP BY status;

-- Count requests by type
SELECT request_type, COUNT(*) FROM service_requests GROUP BY request_type;
```

## Performance Notes

- Table has 3 indexes for fast queries
- Index on user_id for student filtering
- Index on status for staff filtering
- Index on created_at for sorting (descending for recent first)
- RLS policies are efficient - they check user role only

## Security Considerations

- RLS is enabled - students can only see their own requests
- Staff/Admin can see all requests
- Students can only INSERT and SELECT
- Staff/Admin can UPDATE status and notes
- Files are stored in Supabase Storage with public read access
- All data is encrypted in transit and at rest

## Column Reference

| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID | Unique identifier for each request |
| `user_id` | UUID | References the student who submitted |
| `request_type` | VARCHAR(50) | Category (academic, technical, etc.) |
| `description` | TEXT | Full request details from student |
| `file_url` | TEXT | Optional attachment URL |
| `status` | VARCHAR(20) | Current state (pending/in_progress/completed) |
| `staff_notes` | TEXT | Internal notes for staff reference |
| `created_at` | TIMESTAMP | When request was submitted |
| `updated_at` | TIMESTAMP | When request was last modified |

## Next Steps

1. ✓ Create the table (you're doing this)
2. Run the application
3. Test student submission
4. Test staff review and updates
5. Monitor for any SQL errors
6. Adjust RLS policies if needed

## Support

If you encounter issues:
1. Check the Supabase logs for errors
2. Verify RLS policies are correct
3. Ensure the `users` table has a `role` column
4. Confirm user roles are set correctly ('admin', 'staff', 'student', etc.)
5. Test with simple SELECT queries first

---

**Created**: Service Request Module v1.0
**Compatible with**: Supabase (PostgreSQL 13+)
**Last Updated**: 2025
