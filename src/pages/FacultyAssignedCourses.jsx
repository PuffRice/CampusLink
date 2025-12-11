import { useState, useEffect } from "react";
import { supabase } from "../supabase";

export default function FacultyAssignedCourses({ courses }) {
  const [selectedCourse, setSelectedCourse] = useState(courses[0] || null);
  const [activeTab, setActiveTab] = useState("Stream");
  const [students, setStudents] = useState([]);
  const [grades, setGrades] = useState({});
  const [announcements, setAnnouncements] = useState([]);
  const [newAnnouncement, setNewAnnouncement] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [posting, setPosting] = useState(false);
  const [attendance, setAttendance] = useState([]);
  const [courseLoading, setCourseLoading] = useState(false);

  useEffect(() => {
    if (selectedCourse) {
      setCourseLoading(true);
      setTimeout(() => {
        fetchStudents(selectedCourse);
        fetchAnnouncements(selectedCourse.id);
        fetchAttendance(selectedCourse.id);
        setCourseLoading(false);
      }, 300);
    }
  }, [selectedCourse]);

  async function fetchAttendance(classId) {
    try {
      const { data, error } = await supabase
        .from("attendance")
        .select("*")
        .eq("enrollment_id", classId);

      if (error) {
        console.error("Error fetching attendance:", error);
        setAttendance([]);
        return;
      }

      setAttendance(data || []);
    } catch (err) {
      console.error("Error fetching attendance:", err);
      setAttendance([]);
    }
  }

  async function fetchStudents(courseClass) {
    setLoading(true);
    try {
      console.log("Course class ID:", courseClass.id);
      
      // Get enrollments where class_id matches
      const { data: enrollments, error: enrollError } = await supabase
        .from("enrollments")
        .select("*")
        .eq("class_id", courseClass.id);

      console.log("Enrollments found:", enrollments);
      
      if (enrollError || !enrollments || enrollments.length === 0) {
        console.log("No enrollments found for class_id:", courseClass.id);
        setStudents([]);
        setLoading(false);
        return;
      }

      // Step 2: For each enrollment, fetch student details
      const studentList = [];
      for (const enrollment of enrollments) {
        // First fetch student record using user_id (primary key)
        const { data: student, error: studentErr } = await supabase
          .from("students")
          .select("*")
          .eq("user_id", enrollment.student_id)
          .single();

        if (studentErr) {
          console.error("Error fetching student", enrollment.student_id, ":", studentErr);
          continue;
        }

        if (!student) continue;

        // Then fetch user details separately
        const { data: user } = await supabase
          .from("users")
          .select("*")
          .eq("id", student.user_id)
          .single();

        // Format student code: 2023160195 -> 2023-1-60-195
        const formattedCode = student.student_code 
          ? `${student.student_code.slice(0, 4)}-${student.student_code.slice(4, 5)}-${student.student_code.slice(5, 7)}-${student.student_code.slice(7)}`
          : "N/A";

        studentList.push({
          enrollmentId: enrollment.id,
          studentId: enrollment.student_id,
          studentCode: formattedCode,
          fullName: user?.full_name || "Unknown",
          email: user?.email || "N/A",
          currentGrade: enrollment.grade || "",
        });
      }

      console.log("Final student list:", studentList);
      setStudents(studentList);
      
      const gradeMap = {};
      studentList.forEach((s) => {
        gradeMap[s.enrollmentId] = s.currentGrade;
      });
      setGrades(gradeMap);
    } catch (err) {
      console.error("Error fetching students:", err);
      setStudents([]);
    }
    setLoading(false);
  }

  async function saveGrades() {
    setSaving(true);
    try {
      // Batch update enrollments with new grades
      const updates = students.map((student) => ({
        id: student.enrollmentId,
        grade: grades[student.enrollmentId] || null,
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from("enrollments")
          .update({ grade: update.grade })
          .eq("id", update.id);

        if (error) {
          console.error("Error updating grade:", error);
        }
      }

      alert("Grades saved successfully!");
    } catch (err) {
      console.error("Error saving grades:", err);
      alert("Error saving grades. Please try again.");
    }
    setSaving(false);
  }

  const handleGradeChange = (enrollmentId, grade) => {
    setGrades({
      ...grades,
      [enrollmentId]: grade,
    });
  };

  async function fetchAnnouncements(classId) {
    try {
      const { data, error } = await supabase
        .from("announcements")
        .select("*, users:user_id(*)")
        .eq("class_id", classId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching announcements:", error);
        setAnnouncements([]);
        return;
      }

      setAnnouncements(data || []);
    } catch (err) {
      console.error("Error fetching announcements:", err);
      setAnnouncements([]);
    }
  }

  async function postAnnouncement() {
    if (!newAnnouncement.trim()) return;

    setPosting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error("No authenticated user found for posting announcement");
        return;
      }

      const { data: userData, error: userErr } = await supabase
        .from("users")
        .select("id")
        .eq("email", user.email)
        .single();

      if (userErr || !userData) {
        console.error("Error fetching user id for announcement:", userErr);
        return;
      }

      const { data: inserted, error } = await supabase
        .from("announcements")
        .insert([
          {
            class_id: selectedCourse.id,
            user_id: userData.id,
            content: newAnnouncement,
            created_at: new Date().toISOString(),
          },
        ])
        .select("*, users:user_id(*)")
        .single();

      if (error) {
        console.error("Error inserting announcement:", error);
        return;
      }

      // Optimistically update stream for faculty; student view will pick it up on next fetch
      setAnnouncements((prev) => [inserted, ...(prev || [])]);
      setNewAnnouncement("");
    } catch (err) {
      console.error("Error posting announcement:", err);
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col bg-gray-50">
      {/* Main Content */}
      <div className="flex-1 flex flex-col relative">
          {/* Loading Overlay */}
          {courseLoading && (
            <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 border-4 border-[#8B3A3A]/20 border-t-[#8B3A3A] rounded-full animate-spin"></div>
                <p className="text-sm font-medium text-gray-600">Loading course...</p>
              </div>
            </div>
          )}

          {/* Content Tabs */}
          <div className="bg-gray-100 border-b border-gray-200">
            <div className="flex gap-0 items-end px-6 pt-4">
              {["Stream", "Students", "Grades", "Attendance"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-6 py-3 font-medium transition-all rounded-t-lg ${
                    activeTab === tab
                      ? "bg-white text-[#8B3A3A] border-t-2 border-[#8B3A3A] shadow-sm"
                      : "bg-gray-50 text-gray-600 hover:text-gray-800 hover:bg-white border-b border-gray-300"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          <div className={`flex-1 p-8 transition-opacity duration-300 overflow-y-auto ${courseLoading ? 'opacity-50' : 'opacity-100'}`}>
            {/* Stream Tab */}
            {activeTab === "Stream" && (
              <div className="space-y-6 max-w-3xl">
                {/* Post Announcement */}
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <textarea
                    value={newAnnouncement}
                    onChange={(e) => setNewAnnouncement(e.target.value)}
                    placeholder="Share an announcement with your class..."
                    className="w-full p-4 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#8B3A3A]"
                    rows="4"
                  ></textarea>
                  <div className="flex justify-end mt-4">
                    <button
                      onClick={postAnnouncement}
                      disabled={posting || !newAnnouncement.trim()}
                      className="px-6 py-2 bg-[#8B3A3A] text-white rounded-lg font-semibold hover:bg-[#6B2A2A] disabled:bg-gray-400 transition"
                    >
                      {posting ? "Posting..." : "Post"}
                    </button>
                  </div>
                </div>

                {/* Announcements List */}
                <div className="space-y-4">
                  {announcements.length === 0 ? (
                    <div className="bg-gray-50 rounded-lg p-8 text-center text-gray-500">No announcements yet</div>
                  ) : (
                    announcements.map((announcement) => (
                      <div key={announcement.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 bg-[#8B3A3A]/10 rounded-full p-2">
                            <i className="bx bx-user text-[#8B3A3A] text-xl"></i>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-2">
                              <p className="font-semibold text-gray-900">
                                {announcement.users?.full_name || "Faculty"}
                              </p>
                              <p className="text-xs text-gray-500">
                                {new Date(announcement.created_at).toLocaleString()}
                              </p>
                            </div>
                            <p className="text-gray-700 whitespace-pre-wrap">{announcement.content}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Students Tab */}
            {activeTab === "Students" && (
              <div className="max-w-4xl">
                {loading ? (
                  <div className="text-center text-gray-600 py-8">Loading students...</div>
                ) : students.length === 0 ? (
                  <div className="bg-gray-50 rounded-lg p-8 text-center text-gray-600">No students enrolled in this course.</div>
                ) : (
                  <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-[#8B3A3A] text-white">
                          <th className="px-6 py-4 text-left font-semibold">Student Code</th>
                          <th className="px-6 py-4 text-left font-semibold">Name</th>
                          <th className="px-6 py-4 text-left font-semibold">Email</th>
                        </tr>
                      </thead>
                      <tbody>
                        {students.map((student, idx) => (
                          <tr key={student.enrollmentId} className={`border-t ${idx % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-gray-100 transition`}>
                            <td className="px-6 py-4 text-gray-900 font-medium">{student.studentCode}</td>
                            <td className="px-6 py-4 text-gray-900">{student.fullName}</td>
                            <td className="px-6 py-4 text-gray-600">{student.email}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Grades Tab */}
            {activeTab === "Grades" && (
              <div className="max-w-4xl">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-bold text-gray-800">
                    Grade Submission ({students.length} students)
                  </h3>
                  {students.length > 0 && (
                    <button
                      onClick={saveGrades}
                      disabled={saving}
                      className="px-6 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-400 transition"
                    >
                      {saving ? "Saving..." : "Save Grades"}
                    </button>
                  )}
                </div>
                {loading ? (
                  <div className="text-center text-gray-600 py-8">Loading students...</div>
                ) : students.length === 0 ? (
                  <div className="bg-gray-50 rounded-lg p-8 text-center text-gray-600">No students enrolled in this course.</div>
                ) : (
                  <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-[#8B3A3A] text-white">
                          <th className="px-6 py-4 text-left font-semibold">Student Code</th>
                          <th className="px-6 py-4 text-left font-semibold">Name</th>
                          <th className="px-6 py-4 text-left font-semibold">Email</th>
                          <th className="px-6 py-4 text-left font-semibold">Grade</th>
                        </tr>
                      </thead>
                      <tbody>
                        {students.map((student, idx) => (
                          <tr key={student.enrollmentId} className={`border-t ${idx % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-gray-100 transition`}>
                            <td className="px-6 py-4 text-gray-900 font-medium">{student.studentCode}</td>
                            <td className="px-6 py-4 text-gray-900">{student.fullName}</td>
                            <td className="px-6 py-4 text-gray-600">{student.email}</td>
                            <td className="px-6 py-4">
                              <select
                                value={grades[student.enrollmentId] || ""}
                                onChange={(e) => handleGradeChange(student.enrollmentId, e.target.value)}
                                className="px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#8B3A3A]"
                              >
                                <option value="">No Grade</option>
                                <option value="A+">A+ (4.0)</option>
                                <option value="A">A (4.0)</option>
                                <option value="A-">A- (3.7)</option>
                                <option value="B+">B+ (3.3)</option>
                                <option value="B">B (3.0)</option>
                                <option value="B-">B- (2.7)</option>
                                <option value="C+">C+ (2.3)</option>
                                <option value="C">C (2.0)</option>
                                <option value="C-">C- (1.7)</option>
                                <option value="D">D (1.0)</option>
                                <option value="F">F (0.0)</option>
                                <option value="I">Incomplete</option>
                                <option value="W">Withdrawn</option>
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Attendance Tab */}
            {activeTab === "Attendance" && (
              <div className="max-w-4xl">
                {loading ? (
                  <div className="text-center text-gray-600 py-8">Loading attendance...</div>
                ) : students.length === 0 ? (
                  <div className="bg-gray-50 rounded-lg p-8 text-center text-gray-600">No students enrolled in this course.</div>
                ) : (
                  <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-[#8B3A3A] text-white">
                          <th className="px-6 py-4 text-left font-semibold">Student Code</th>
                          <th className="px-6 py-4 text-left font-semibold">Name</th>
                          <th className="px-6 py-4 text-left font-semibold">Attendance %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {students.map((student, idx) => (
                          <tr key={student.enrollmentId} className={`border-t ${idx % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-gray-100 transition`}>
                            <td className="px-6 py-4 text-gray-900 font-medium">{student.studentCode}</td>
                            <td className="px-6 py-4 text-gray-900">{student.fullName}</td>
                            <td className="px-6 py-4 text-gray-600">-</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar - Course Details */}
        <aside className="w-80 bg-white border-l border-gray-200 p-6 flex-shrink-0 overflow-y-auto">
            {/* Course Details Card */}
            <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
              <h2 className="text-base font-bold text-gray-800 mb-4">Course Details</h2>
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Course Name</p>
                  <p className="text-sm font-semibold text-gray-900">{selectedCourse.courses?.name}</p>
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Course Code</p>
                    <p className="text-sm font-semibold text-gray-900">{selectedCourse.courses?.course_code}</p>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Credits</p>
                    <p className="text-sm font-semibold text-gray-900">{selectedCourse.courses?.credit}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Class Details Card */}
            <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
              <h2 className="text-base font-bold text-gray-800 mb-4">Class Details</h2>
              <div className="space-y-3">
                <div className="flex gap-3">
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Section</p>
                    <p className="text-sm font-semibold text-gray-900">{selectedCourse.section}</p>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Day Slot</p>
                    <p className="text-sm font-semibold text-gray-900">{selectedCourse.day_slot}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Time Slot</p>
                  <p className="text-sm font-semibold text-gray-900">{selectedCourse.time_slot}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Class Room</p>
                  <p className="text-sm font-semibold text-gray-900">{selectedCourse.room_no || "TBA"}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Seats</p>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-600">Enrollment</span>
                    <span className="font-semibold text-gray-900">{selectedCourse.filled_seats} / {selectedCourse.seats}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="h-2 rounded-full bg-[#8B3A3A]"
                      style={{ width: `${selectedCourse.seats ? (selectedCourse.filled_seats / selectedCourse.seats) * 100 : 0}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Statistics Card */}
            <div className="bg-gradient-to-br from-[#8B3A3A] to-[#6B2A2A] rounded-lg p-5 text-white shadow-sm">
              <h2 className="text-base font-bold mb-4">Course Statistics</h2>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm opacity-90">Total Students</span>
                  <span className="text-2xl font-bold">{students.length}</span>
                </div>
                <div className="border-t border-white/20 pt-3">
                  <p className="text-xs opacity-75 mb-2">Seat Utilization</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-white/20 rounded-full h-2">
                      <div 
                        className="h-2 rounded-full bg-white transition-all"
                        style={{ width: `${selectedCourse.seats ? (selectedCourse.filled_seats / selectedCourse.seats) * 100 : 0}%` }}
                      ></div>
                    </div>
                    <span className="text-sm font-semibold">{selectedCourse.seats ? Math.round((selectedCourse.filled_seats / selectedCourse.seats) * 100) : 0}%</span>
                  </div>
                </div>
              </div>
    </div>
  );
}
