import { useState, useEffect } from "react";
import { supabase } from "../supabase";

export default function AssignmentsBlock({ courseClassId, isReadOnly = false }) {
  const [assignments, setAssignments] = useState([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [attachment, setAttachment] = useState(null);
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [submittingId, setSubmittingId] = useState(null);
  const [submissionFiles, setSubmissionFiles] = useState({});
  const [studentSubmissions, setStudentSubmissions] = useState({});
  const [currentUserId, setCurrentUserId] = useState(null);

  useEffect(() => {
    fetchAssignments();
    fetchUserRole();
  }, [courseClassId]);

  async function fetchUserRole() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase
        .from("users")
        .select("id, role")
        .eq("email", user.email)
        .single();
      if (!error && data) {
        setUserRole(data.role);
        setCurrentUserId(data.id);
        // Fetch student submissions for this user
        if (data.role === 'student') {
          fetchStudentSubmissions(data.id);
        }
      }
    } catch (e) {
      console.error("Error fetching user role", e);
    }
  }

  async function fetchStudentSubmissions(userId) {
    try {
      const { data, error } = await supabase
        .from("submissions")
        .select("*")
        .eq("student_id", userId);

      if (!error && data) {
        const submissionsByAssignment = {};
        data.forEach(sub => {
          if (!submissionsByAssignment[sub.assignment_id]) {
            submissionsByAssignment[sub.assignment_id] = [];
          }
          submissionsByAssignment[sub.assignment_id].push(sub);
        });
        setStudentSubmissions(submissionsByAssignment);
      }
    } catch (e) {
      console.error("Error fetching student submissions:", e);
    }
  }

  async function fetchAssignments() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("assignments")
        .select("*, users(*)")
        .eq("course_class_id", courseClassId)
        .order("deadline", { ascending: true });

      if (error) {
        console.error("Error fetching assignments:", error);
        setAssignments([]);
        return;
      }

      setAssignments(data || []);
    } catch (err) {
      console.error("Error fetching assignments:", err);
      setAssignments([]);
    } finally {
      setLoading(false);
    }
  }

  async function submitAssignmentFile(assignment, file) {
    if (!file) return;
    setSubmittingId(assignment.id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error("No authenticated user found");
        return;
      }

      const { data: userData, error: userErr } = await supabase
        .from("users")
        .select("id")
        .eq("email", user.email)
        .single();

      if (userErr || !userData) {
        console.error("Error fetching user id:", userErr);
        return;
      }

      const ext = file.name.split(".").pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
      const filePath = `submissions/${assignment.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("course-files")
        .upload(filePath, file);

      if (uploadError) {
        console.error("Error uploading submission:", uploadError);
        return;
      }

      const { data: urlData } = supabase.storage
        .from("course-files")
        .getPublicUrl(filePath);

      const { error: insertErr } = await supabase
        .from("submissions")
        .insert([
          {
            assignment_id: assignment.id,
            student_id: userData.id,
            file_url: urlData.publicUrl,
          },
        ]);

      if (insertErr) {
        console.error("Error inserting submission:", insertErr);
        return;
      }
      // Refetch submissions to update UI
      if (currentUserId) {
        await fetchStudentSubmissions(currentUserId);
      }
      // Clear the submission file input
      setSubmissionFiles({ ...submissionFiles, [assignment.id]: null });
    } catch (e) {
      console.error("Error submitting assignment:", e);
    } finally {
      setSubmittingId(null);
    }
  }

  async function deleteSubmission(submissionId, assignmentId) {
    try {
      const submission = studentSubmissions[assignmentId]?.find(s => s.id === submissionId);
      if (!submission) return;

      // Delete file from storage
      if (submission.file_url) {
        const urlParts = submission.file_url.split('/');
        const filePath = urlParts.slice(-3).join('/'); // Get path from URL
        await supabase.storage.from("course-files").remove([filePath]);
      }

      // Delete submission record
      const { error } = await supabase
        .from("submissions")
        .delete()
        .eq("id", submissionId);

      if (error) {
        console.error("Error deleting submission:", error);
        return;
      }

      // Refetch submissions
      if (currentUserId) {
        await fetchStudentSubmissions(currentUserId);
      }
    } catch (e) {
      console.error("Error deleting submission:", e);
    }
  }

  async function postAssignment() {
    if (!title.trim() || !dueDate) return;

    setPosting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error("No authenticated user found");
        return;
      }

      const { data: userData, error: userErr } = await supabase
        .from("users")
        .select("id")
        .eq("email", user.email)
        .single();

      if (userErr || !userData) {
        console.error("Error fetching user id:", userErr);
        return;
      }

      let attachmentUrl = null;
      if (attachment) {
        const fileExt = attachment.name.split(".").pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `assignments/${courseClassId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("course-files")
          .upload(filePath, attachment);

        if (uploadError) {
          console.error("Error uploading file:", uploadError);
        } else {
          const { data: urlData } = supabase.storage
            .from("course-files")
            .getPublicUrl(filePath);
          attachmentUrl = urlData.publicUrl;
        }
      }

      const dueDateTimeString = dueTime 
        ? `${dueDate}T${dueTime}:00`
        : `${dueDate}T23:59:00`;

      const { data: inserted, error } = await supabase
        .from("assignments")
        .insert([
          {
            course_class_id: courseClassId,
            user_id: userData.id,
            title: title,
            description: description || null,
            deadline: dueDateTimeString,
            file_url: attachmentUrl,
          },
        ])
        .select("*, users(*)")
        .single();

      if (error) {
        console.error("Error inserting assignment:", error);
        return;
      }

      setAssignments((prev) => [...(prev || []), inserted]);
      setTitle("");
      setDescription("");
      setDueDate("");
      setDueTime("");
      setAttachment(null);
    } catch (err) {
      console.error("Error posting assignment:", err);
    } finally {
      setPosting(false);
    }
  }

  function formatDueDate(dueDateString) {
    const date = new Date(dueDateString);
    const now = new Date();
    const isOverdue = date < now;
    
    const dateStr = date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
    const timeStr = date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });

    return { dateStr, timeStr, isOverdue };
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Post Assignment - Only show for faculty */}
      {!isReadOnly && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-900">Create Assignment</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Assignment title"
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B3A3A]"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Assignment details and instructions..."
                className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#8B3A3A]"
                rows="4"
              ></textarea>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Due Date *</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B3A3A]"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Due Time</label>
                <input
                  type="time"
                  value={dueTime}
                  onChange={(e) => setDueTime(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B3A3A]"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Attachment</label>
              <input
                type="file"
                onChange={(e) => setAttachment(e.target.files[0])}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B3A3A]"
              />
              {attachment && (
                <p className="text-sm text-gray-600 mt-2">Selected: {attachment.name}</p>
              )}
            </div>
          </div>

          <div className="flex justify-end mt-4">
            <button
              onClick={postAssignment}
              disabled={posting || !title.trim() || !dueDate}
              className="px-6 py-2 bg-[#8B3A3A] text-white rounded-lg font-semibold hover:bg-[#6B2A2A] disabled:bg-gray-400 transition"
            >
              {posting ? "Creating..." : "Create Assignment"}
            </button>
          </div>
        </div>
      )}

      {/* Assignments List */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center text-gray-600 py-8">Loading assignments...</div>
        ) : assignments.length === 0 ? (
          <div className="bg-gray-50 rounded-lg p-8 text-center text-gray-500">No assignments yet</div>
        ) : (
          assignments.map((assignment) => {
            const { dateStr, timeStr, isOverdue } = formatDueDate(assignment.deadline);
            return (
              <div key={assignment.id} className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm hover:shadow-md transition">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="flex-shrink-0 bg-[#8B3A3A]/10 rounded-lg p-3">
                      <i className="bx bx-file text-[#8B3A3A] text-2xl"></i>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-lg text-gray-900 mb-1">{assignment.title}</h3>
                      <p className="text-sm text-gray-600 mb-2">
                        Posted by {assignment.users?.full_name || "Faculty"}
                      </p>
                      {assignment.description && (
                        <p className="text-gray-700 whitespace-pre-wrap mb-3">{assignment.description}</p>
                      )}
                    </div>
                  </div>
                  <div className={`flex flex-col items-end gap-1 ${isOverdue ? 'text-red-600' : 'text-gray-600'}`}>
                    <div className="flex items-center gap-1 text-sm font-semibold">
                      <i className="bx bx-time-five"></i>
                      <span>{dateStr}</span>
                    </div>
                    <span className="text-xs">{timeStr}</span>
                    {isOverdue && (
                      <span className="text-xs font-semibold bg-red-100 text-red-700 px-2 py-1 rounded mt-1">
                        Overdue
                      </span>
                    )}
                  </div>
                </div>
                
                {assignment.file_url && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <a
                      href={assignment.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-[#8B3A3A] hover:text-[#6B2A2A] font-semibold text-sm"
                    >
                      <i className="bx bx-paperclip text-lg"></i>
                      <span>View Attachment</span>
                    </a>
                  </div>
                )}

                {userRole === 'student' && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Submit your work</label>
                    <div className="flex items-center gap-3 mb-4">
                      <input
                        type="file"
                        onChange={(e) => setSubmissionFiles({ ...submissionFiles, [assignment.id]: e.target.files[0] })}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B3A3A]"
                      />
                      <button
                        onClick={() => submitAssignmentFile(assignment, submissionFiles[assignment.id])}
                        disabled={submittingId === assignment.id || !submissionFiles[assignment.id]}
                        className="px-4 py-2 bg-[#8B3A3A] text-white rounded-lg font-semibold hover:bg-[#6B2A2A] disabled:bg-gray-400 transition whitespace-nowrap"
                      >
                        {submittingId === assignment.id ? 'Submitting...' : 'Upload'}
                      </button>
                    </div>

                    {studentSubmissions[assignment.id] && studentSubmissions[assignment.id].length > 0 && (
                      <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                        <h4 className="font-semibold text-gray-900 mb-3 text-sm">Your Submissions ({studentSubmissions[assignment.id].length})</h4>
                        <div className="space-y-2">
                          {studentSubmissions[assignment.id].map((submission) => (
                            <div key={submission.id} className="flex items-center justify-between bg-white p-3 rounded border border-gray-200">
                              <div className="flex-1 min-w-0">
                                <a
                                  href={submission.file_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm font-medium text-[#8B3A3A] hover:text-[#6B2A2A] truncate flex items-center gap-2"
                                >
                                  <i className="bx bx-file"></i>
                                  <span className="truncate">{submission.file_url.split('/').pop()}</span>
                                </a>
                                <p className="text-xs text-gray-500 mt-1">
                                  {new Date(submission.submitted_at || submission.created_at).toLocaleString()}
                                </p>
                              </div>
                              <button
                                onClick={() => deleteSubmission(submission.id, assignment.id)}
                                className="ml-2 px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition flex-shrink-0"
                              >
                                <i className="bx bx-trash"></i>
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
