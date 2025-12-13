# Service Request Module - Implementation Guide

## Overview
The Service Request Module (formerly "Support Tickets") is a comprehensive system allowing students to submit and track service requests, and enabling staff/admin to manage and update request statuses.

## Features

### Student Features
- **Submit Service Requests**: Simple form with request type dropdown, description textarea, and optional file upload
- **Request Types**: Academic Support, Technical Issue, Facilities & Infrastructure, Financial Assistance, Health & Wellness, Document Request, Other
- **View My Requests**: Students can see all their submitted requests with status tracking
- **Status Visibility**: Track request progress (Pending → In Progress → Completed)
- **File Attachments**: Upload supporting documents with requests
- **Request History**: View all past requests with timestamps

### Staff/Admin Features
- **Manage All Requests**: View and filter all student service requests
- **Status Updates**: Change request status from Pending to In Progress to Completed
- **Filtering**: Filter requests by status and request type
- **Staff Notes**: Add internal notes for documentation and communication
- **Statistics Dashboard**: Quick overview of total, pending, in-progress, and completed requests
- **Student Information**: View submitter details (name, email, timestamp)
- **Request Tracking**: Access request attachments and full submission history

## Component Files

### 1. `src/components/ServiceRequest.jsx`
**Purpose**: Main component for student service request submission and viewing

**Key Functions**:
- `fetchUserInfo()`: Get current logged-in user info
- `fetchRequests()`: Fetch user's service requests
- `submitRequest()`: Submit new service request with optional file upload
- `updateRequestStatus()`: Students don't update, but component supports role-based visibility

**State**:
- `requests`: Array of service requests
- `requestType`: Selected request type
- `description`: Request description text
- `file`: Selected attachment file
- `submitting`: Loading state during submission

**UI Elements**:
- Request submission form (hidden for non-students)
- Color-coded status badges (yellow: Pending, blue: In Progress, green: Completed)
- Request list with collapsible details
- File attachment download links
- Status update buttons (for staff only)

### 2. `src/components/ServiceRequestManagement.jsx`
**Purpose**: Admin/Staff dashboard for managing all service requests

**Key Functions**:
- `fetchAllRequests()`: Fetch all service requests across all students
- `updateRequestStatus()`: Change request status and persist to DB
- `saveStaffNotes()`: Add/update internal notes for staff documentation

**State**:
- `requests`: All service requests
- `filterStatus`: Current status filter (all/pending/in_progress/completed)
- `filterType`: Current type filter (all/academic/technical/etc.)
- `staffNotes`: Draft notes being edited

**UI Elements**:
- Filter controls (status and type dropdowns)
- Statistics cards showing request counts by status
- Request cards with 3-column layout:
  - Left (Submitter info, description, attachments)
  - Center (Staff notes textarea)
  - Right (Status update buttons, request ID)
- Color-coded status badges matching student view

### 3. Updated `src/pages/StudentDashboard.jsx`
**Changes**:
- Import `ServiceRequest` component
- Rename sidebar item "Support Tickets" → "Service Requests"
- Add ServiceRequest component to activeMenu rendering
- `activeMenu === "Service Requests"` shows `<ServiceRequest userRole="student" />`

### 4. Updated `src/pages/StaffDashboard.jsx`
**Changes**:
- Import `ServiceRequestManagement` component
- Add "Service Requests" menu item to sidebar
- Add `case "service-requests"` to renderContent switch statement
- Shows `<ServiceRequestManagement />` when selected

## Database Schema

### `service_requests` Table
```sql
CREATE TABLE service_requests (
  id UUID PRIMARY KEY (auto-generated),
  user_id UUID NOT NULL (references users.id),
  request_type VARCHAR(50) NOT NULL,
    -- Values: 'academic', 'technical', 'facilities', 'financial', 'health', 'document', 'other'
  description TEXT NOT NULL,
  file_url TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
    -- Values: 'pending', 'in_progress', 'completed'
  staff_notes TEXT,
  created_at TIMESTAMP (auto-generated),
  updated_at TIMESTAMP (auto-generated)
);
```

### Indexes
- `idx_service_requests_user_id`: Fast filtering by student
- `idx_service_requests_status`: Fast filtering by status
- `idx_service_requests_created_at`: Fast ordering by date

### Row Level Security (RLS) Policies
1. **student_view_own_requests**: Students see only their own requests
2. **student_insert_own_requests**: Students can only insert requests for themselves
3. **staff_view_all_requests**: Staff/Admin see all requests
4. **staff_update_requests**: Staff/Admin can update request status/notes

## Workflow

### Student Flow
1. Navigate to "Service Requests" in sidebar (renamed from "Support Tickets")
2. Fill out "Submit a Service Request" form:
   - Select request type from dropdown
   - Enter detailed description
   - Optionally upload supporting file
   - Click "Submit Request"
3. View "My Service Requests" section showing:
   - Request type
   - Current status (color-coded badge)
   - Submission date/time
   - Description text
   - Download link for attachments (if any)
   - Status automatically updates as staff processes request

### Staff/Admin Flow
1. Navigate to "Service Requests" in Staff Dashboard menu
2. View statistics dashboard showing:
   - Total requests
   - Pending count
   - In Progress count
   - Completed count
3. Use filters to find requests:
   - Filter by status (Pending, In Progress, Completed)
   - Filter by type (Academic, Technical, Facilities, etc.)
4. For each request, can:
   - View student name and email
   - Read complete description
   - Download attached files
   - Add/edit staff notes
   - Update status with single button click
   - View request ID for record-keeping

## Color Scheme

### Status Colors
- **Pending (Yellow)**: 
  - Background: `bg-yellow-50`
  - Border: `border-yellow-200`
  - Text: `text-yellow-700`
  - Badge: `bg-yellow-100`

- **In Progress (Blue)**:
  - Background: `bg-blue-50`
  - Border: `border-blue-200`
  - Text: `text-blue-700`
  - Badge: `bg-blue-100`

- **Completed (Green)**:
  - Background: `bg-green-50`
  - Border: `border-green-200`
  - Text: `text-green-700`
  - Badge: `bg-green-100`

### Action Buttons
- Maroon theme consistent with rest of app:
  - Normal: `bg-[#8B3A3A]`
  - Hover: `bg-[#6B2A2A]`

## API Integration

### Supabase Calls

#### Fetch User Info
```javascript
const { data: { user } } = await supabase.auth.getUser();
const { data } = await supabase
  .from("users")
  .select("id, full_name, role")
  .eq("email", user.email)
  .single();
```

#### Fetch Service Requests
```javascript
// Students - their own requests
const { data } = await supabase
  .from("service_requests")
  .select("*, users(full_name, email)")
  .eq("user_id", userId)
  .order("created_at", { ascending: false });

// Staff/Admin - all requests
const { data } = await supabase
  .from("service_requests")
  .select("*, users(full_name, email)")
  .order("created_at", { ascending: false });
```

#### Submit Service Request
```javascript
// 1. Upload file to storage (if provided)
const { error: uploadError } = await supabase.storage
  .from("course-files")
  .upload(filePath, file);

const { data: urlData } = supabase.storage
  .from("course-files")
  .getPublicUrl(filePath);

// 2. Insert request record
const { error: insertErr } = await supabase
  .from("service_requests")
  .insert([{
    user_id: userId,
    request_type: type,
    description: description,
    file_url: fileUrl,
    status: "pending"
  }]);
```

#### Update Request Status
```javascript
const { error } = await supabase
  .from("service_requests")
  .update({ status: newStatus })
  .eq("id", requestId);
```

#### Save Staff Notes
```javascript
const { error } = await supabase
  .from("service_requests")
  .update({ staff_notes: notes })
  .eq("id", requestId);
```

## Installation Steps

### 1. Create Database Table
Run the SQL migration:
```bash
# Via Supabase SQL Editor
# Copy contents of supabase/migrations/20250001_create_service_requests.sql
# Paste into Supabase SQL Editor and execute
```

Or directly in Supabase SQL Editor:
```sql
-- Copy the full table creation SQL from the migration file
```

### 2. Deploy Components
Components are already in place:
- `src/components/ServiceRequest.jsx` ✓
- `src/components/ServiceRequestManagement.jsx` ✓
- Updated StudentDashboard ✓
- Updated StaffDashboard ✓

### 3. Test the Module

**Student Testing**:
1. Log in as student
2. Click "Service Requests" in sidebar
3. Fill out and submit a test request
4. Verify request appears in "My Service Requests"

**Staff Testing**:
1. Log in as staff/admin
2. Click "Service Requests" in menu
3. Verify student request appears
4. Update status and add notes
5. Verify student sees updated status

## Request Types Reference

| Value | Label | Use Case |
|-------|-------|----------|
| `academic` | Academic Support | Tutoring, course clarification, academic advising |
| `technical` | Technical Issue | Portal bugs, password reset, system access |
| `facilities` | Facilities & Infrastructure | Campus facilities, classroom issues, maintenance |
| `financial` | Financial Assistance | Scholarships, fee waiver, payment plans |
| `health` | Health & Wellness | Medical leave, counseling, health services |
| `document` | Document Request | Transcripts, certificates, letters of reference |
| `other` | Other | Miscellaneous requests |

## Future Enhancements

### Potential Features
1. **Email Notifications**: Send student email when status changes
2. **Priority Levels**: Add urgent/normal/low priority
3. **Assignment to Staff**: Assign specific requests to staff members
4. **Response Time SLA**: Track resolution time
5. **Category Hierarchy**: Nested categories for better organization
6. **Request Templates**: Pre-filled common request types
7. **Bulk Actions**: Mark multiple requests as complete
8. **Analytics Dashboard**: Request volume, resolution time, category breakdowns
9. **Feedback System**: Student satisfaction ratings after completion
10. **Duplicate Detection**: Alert if similar request already submitted

## Troubleshooting

### Common Issues

**Issue**: "No requests found" when student submits request
- **Solution**: Ensure `service_requests` table exists and RLS policies are enabled correctly

**Issue**: Staff can't see student requests
- **Solution**: Verify user.role is set to 'staff' or 'admin' in users table

**Issue**: File upload fails
- **Solution**: Ensure `course-files` bucket exists in Supabase Storage and has proper permissions

**Issue**: Status update doesn't persist
- **Solution**: Check RLS policies allow staff to UPDATE service_requests table

## Testing Checklist

- [ ] Student can submit service request with all fields
- [ ] Student can submit service request with file attachment
- [ ] Student sees submitted request in "My Service Requests" list
- [ ] Staff can view all service requests
- [ ] Staff can filter by status
- [ ] Staff can filter by type
- [ ] Staff can update request status
- [ ] Staff can add/edit notes
- [ ] Student sees updated status in real-time after page refresh
- [ ] File attachment links work and download correctly
- [ ] Statistics dashboard shows correct counts
- [ ] Request list shows correct submitter information
- [ ] Timestamps display correctly for all requests
