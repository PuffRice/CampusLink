# Schema Update - INT Identity Columns

## Change Summary

Updated the `service_requests` table schema to use INT IDENTITY columns instead of UUID:

### Before
```sql
CREATE TABLE service_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id),
  ...
);
```

### After
```sql
CREATE TABLE service_requests (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES public.users(id),
  ...
);
```

## Details

### Column Types Changed
- `id`: UUID → `SERIAL` (INT IDENTITY auto-increment)
- `user_id`: UUID → `INT` (foreign key to users.id)

### RLS Policies Updated
All RLS policies now cast `auth.uid()` to INT:
```sql
auth.uid()::int
```

This ensures proper type matching with INT user IDs.

### What Changed
✅ `service_requests.id` is now auto-incrementing integer (SERIAL)
✅ `service_requests.user_id` is now integer matching `users.id`
✅ Foreign key reference updated to INT
✅ RLS policies updated to handle INT comparisons
✅ All indexes remain the same
✅ Application code needs no changes

## Migration File
**Location**: `supabase/migrations/20250001_create_service_requests.sql`

## Notes
- The application code in `ServiceRequest.jsx` and `ServiceRequestManagement.jsx` doesn't need changes - it stores and uses the ID as-is
- The INT type is more efficient for indexing and foreign keys
- Auto-increment (SERIAL) ensures no duplicate IDs
- Matches the schema of the `users` table

## Next Steps
1. Delete the old `service_requests` table if it exists (had UUIDs)
2. Run the updated migration SQL
3. Test student and staff workflows
