# Service Request Module - Quick Start

## What's New
Service Request Module has been successfully implemented with full student and staff/admin functionality.

## Where to Access

### Students
- **Sidebar**: "Service Requests" (was "Support Tickets")
- **Location**: StudentDashboard
- **What you can do**:
  - Submit new service requests
  - View your request history
  - Track status (Pending → In Progress → Completed)
  - Download attachments

### Staff/Admin
- **Menu**: "Service Requests" (new menu item)
- **Location**: StaffDashboard
- **What you can do**:
  - View all student requests
  - Filter by status and type
  - Update request status
  - Add internal notes
  - Download student attachments

## Files Created/Modified

### New Files
1. `src/components/ServiceRequest.jsx` - Student request form & list
2. `src/components/ServiceRequestManagement.jsx` - Staff/admin dashboard
3. `supabase/migrations/20250001_create_service_requests.sql` - Database table
4. `SERVICE_REQUEST_IMPLEMENTATION.md` - Full documentation
5. `SERVICE_REQUEST_QUICK_START.md` - This file

### Modified Files
1. `src/pages/StudentDashboard.jsx`
   - Added ServiceRequest import
   - Renamed sidebar item to "Service Requests"
   - Added ServiceRequest component rendering

2. `src/pages/StaffDashboard.jsx`
   - Added ServiceRequestManagement import
   - Added Service Requests menu option
   - Added case for service-requests rendering

## Required Setup

### 1. Create Database Table
Execute this SQL in Supabase SQL Editor:

```sql
-- Run the migration file contents
-- supabase/migrations/20250001_create_service_requests.sql
```

### 2. Verify Components Are in Place
- ✓ ServiceRequest.jsx exists
- ✓ ServiceRequestManagement.jsx exists
- ✓ StudentDashboard updated
- ✓ StaffDashboard updated

## Request Types Available
- Academic Support
- Technical Issue
- Facilities & Infrastructure
- Financial Assistance
- Health & Wellness
- Document Request
- Other

## Status Values
- Pending (Yellow)
- In Progress (Blue)
- Completed (Green)

## Key Features

### Student
- [x] Submit requests with description
- [x] Optional file attachment upload
- [x] View all submitted requests
- [x] See real-time status updates
- [x] Download attachments
- [x] Submission timestamps

### Staff/Admin
- [x] Dashboard with statistics
- [x] Filter by status
- [x] Filter by request type
- [x] Update request status
- [x] Add/edit staff notes
- [x] View student details
- [x] Download attachments
- [x] Request ID tracking

## Testing Instructions

### Test as Student
1. Log in as student
2. Navigate to "Service Requests" in sidebar
3. Fill out form:
   - Select "Academic Support"
   - Enter description
   - Optionally attach file
4. Click "Submit Request"
5. Verify request appears in "My Service Requests"

### Test as Staff
1. Log in as staff/admin
2. Click "Service Requests" in menu
3. You should see student's request
4. Click status buttons to change status
5. Add notes and click "Save Notes"
6. Verify student sees updated status

## Database Schema Summary

```
service_requests
├── id (UUID primary key)
├── user_id (references users)
├── request_type (academic, technical, facilities, financial, health, document, other)
├── description (text)
├── file_url (optional)
├── status (pending, in_progress, completed)
├── staff_notes (optional)
├── created_at (auto)
└── updated_at (auto)
```

## Configuration Notes

- Uses existing `course-files` bucket for file storage
- File path: `service-requests/{user_id}/{timestamp}_{randomstring}.ext`
- Uses Tailwind CSS for styling
- Uses Maroon theme for action buttons (#8B3A3A)
- Uses Boxicons (bx) for icons
- Integrated with Supabase Auth and RLS

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Database table doesn't exist | Run migration SQL in Supabase |
| Students can't submit | Check RLS policies are enabled |
| Staff can't see requests | Verify user.role = 'staff' or 'admin' |
| File upload fails | Ensure course-files bucket exists |
| Status won't update | Check RLS UPDATE policy for staff |

## File Size Reference

- ServiceRequest.jsx: ~3.5 KB
- ServiceRequestManagement.jsx: ~4.2 KB
- Total new code: ~7.7 KB + SQL migration

## Production Checklist

- [ ] Database table created and verified
- [ ] RLS policies enabled and tested
- [ ] Components imported and rendering correctly
- [ ] File upload functionality tested
- [ ] Student submission tested
- [ ] Staff status updates tested
- [ ] All colors and styling match app theme
- [ ] No console errors
- [ ] Mobile responsive tested
- [ ] Performance acceptable with 100+ requests

## Support

For full documentation, see: `SERVICE_REQUEST_IMPLEMENTATION.md`
