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

  useEffect(() => {
    if (selectedCourse) {
      fetchStudents(selectedCourse);
      fetchAnnouncements(selectedCourse.id);
    }
  }, [selectedCourse]);

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
    <div className="p-8 space-y-6">
      {/* Course Selection */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 mb-4">Select a Course</h2>
        <div className="flex gap-3 flex-wrap">
          {courses.map((course) => (
            <button
              key={course.id}
              onClick={() => setSelectedCourse(course)}
              className={`px-4 py-2 rounded-lg font-semibold transition ${
                selectedCourse?.id === course.id
                  ? "bg-blue-500 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {course.courses?.course_code} - Section {course.section}
            </button>
          ))}
        </div>
      </div>

      {selectedCourse && (
        <>
          {/* Course Details */}
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4">
              {selectedCourse.courses?.name} ({selectedCourse.courses?.course_code})
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-gray-600 font-semibold">Section</p>
                <p className="text-gray-900">{selectedCourse.section}</p>
              </div>
              <div>
                <p className="text-gray-600 font-semibold">Time</p>
                <p className="text-gray-900">{selectedCourse.time_slot}</p>
              </div>
              <div>
                <p className="text-gray-600 font-semibold">Days</p>
                <p className="text-gray-900">{selectedCourse.day_slot}</p>
              </div>
              <div>
                <p className="text-gray-600 font-semibold">Room</p>
                <p className="text-gray-900">{selectedCourse.room || "TBA"}</p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="flex border-b border-slate-200">
              {["Stream", "Students", "Grades"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 px-6 py-3 font-semibold transition ${
                    activeTab === tab
                      ? "bg-blue-500 text-white"
                      : "bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Stream Tab */}
            {activeTab === "Stream" && (
              <div className="p-6 space-y-6">
                {/* Post Announcement */}
                <div className="bg-gray-50 border border-slate-200 rounded-lg p-4">
                  <textarea
                    value={newAnnouncement}
                    onChange={(e) => setNewAnnouncement(e.target.value)}
                    placeholder="Share an announcement with your class..."
                    className="w-full p-3 border border-slate-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows="3"
                  ></textarea>
                  <div className="flex justify-end mt-3">
                    <button
                      onClick={postAnnouncement}
                      disabled={posting || !newAnnouncement.trim()}
                      className="px-4 py-2 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 disabled:bg-gray-400 transition"
                    >
                      {posting ? "Posting..." : "Post"}
                    </button>
                  </div>
                </div>

                {/* Announcements List */}
                <div className="space-y-4">
                  {announcements.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">No announcements yet</div>
                  ) : (
                    announcements.map((announcement) => (
                      <div key={announcement.id} className="bg-white border border-slate-200 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 bg-blue-100 rounded-full p-2">
                            <i className="bx bx-user text-blue-600 text-xl"></i>
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
              <div className="p-6">
                {loading ? (
                  <div className="text-center text-gray-600">Loading students...</div>
                ) : students.length === 0 ? (
                  <div className="text-center text-gray-600">No students enrolled in this course.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-slate-200">
                        <tr>
                          <th className="px-6 py-3 text-left font-semibold text-gray-900">Student Code</th>
                          <th className="px-6 py-3 text-left font-semibold text-gray-900">Name</th>
                          <th className="px-6 py-3 text-left font-semibold text-gray-900">Email</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {students.map((student, idx) => (
                          <tr key={student.enrollmentId} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                            <td className="px-6 py-4 text-gray-900">{student.studentCode}</td>
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
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-slate-900">
                    Grade Submission ({students.length} students)
                  </h3>
                  {students.length > 0 && (
                    <button
                      onClick={saveGrades}
                      disabled={saving}
                      className="px-4 py-2 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 disabled:bg-gray-400 transition"
                    >
                      {saving ? "Saving..." : "Save Grades"}
                    </button>
                  )}
                </div>
                {loading ? (
                  <div className="text-center text-gray-600">Loading students...</div>
                ) : students.length === 0 ? (
                  <div className="text-center text-gray-600">No students enrolled in this course.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-slate-200">
                        <tr>
                          <th className="px-6 py-3 text-left font-semibold text-gray-900">Student Code</th>
                          <th className="px-6 py-3 text-left font-semibold text-gray-900">Name</th>
                          <th className="px-6 py-3 text-left font-semibold text-gray-900">Email</th>
                          <th className="px-6 py-3 text-left font-semibold text-gray-900">Grade</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {students.map((student, idx) => (
                          <tr key={student.enrollmentId} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                            <td className="px-6 py-4 text-gray-900">{student.studentCode}</td>
                            <td className="px-6 py-4 text-gray-900">{student.fullName}</td>
                            <td className="px-6 py-4 text-gray-600">{student.email}</td>
                            <td className="px-6 py-4">
                              <select
                                value={grades[student.enrollmentId] || ""}
                                onChange={(e) => handleGradeChange(student.enrollmentId, e.target.value)}
                                className="px-3 py-2 border border-slate-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
          </div>
        </>
      )}
    </div>
  );
}
