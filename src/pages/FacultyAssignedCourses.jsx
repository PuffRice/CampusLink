import { useState, useEffect } from "react";
import { supabase } from "../supabase";
import AnnouncementsBlock from "../components/AnnouncementsBlock";
import AssignmentsBlock from "../components/AssignmentsBlock";
import MaterialsBlock from "../components/MaterialsBlock";

export default function FacultyAssignedCourses({ courses, selectedCourse, onCourseChange }) {
  const [localSelected, setLocalSelected] = useState(selectedCourse || courses[0] || null);
  const [activeTab, setActiveTab] = useState("Stream");
  const [students, setStudents] = useState([]);
  const [grades, setGrades] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [attendance, setAttendance] = useState([]);
  const [courseLoading, setCourseLoading] = useState(false);
  const [attendanceData, setAttendanceData] = useState({}); // { enrollmentId: { class1: true/false/null, ... } }
  const [classesCompleted, setClassesCompleted] = useState({}); // { class1: true/false, ... }

  // Function to handle class header click - marks null values as false
  const handleClassHeaderClick = async (classNum) => {
    const classKey = `class${classNum}`;
    
    // Toggle the completed state
    const newCompleted = !classesCompleted[classKey];
    setClassesCompleted(prev => ({
      ...prev,
      [classKey]: newCompleted
    }));

    // If marking as completed (true), convert all nulls to false for that class in DB
    if (newCompleted) {
      try {
        // Update database for all enrollments where class value is null
        for (const enrollmentId of Object.keys(attendanceData)) {
          const currentValue = attendanceData[enrollmentId][classKey];
          
          // Only update if null
          if (currentValue === null) {
            const { error } = await supabase
              .from("attendance")
              .update({ [classKey]: false })
              .eq("enrollment_id", enrollmentId);

            if (error) {
              console.error("Error updating attendance:", error);
            }
          }
        }

        // Update local state
        setAttendanceData(prev => {
          const updated = { ...prev };
          Object.keys(updated).forEach(enrollmentId => {
            if (updated[enrollmentId][classKey] === null) {
              updated[enrollmentId] = {
                ...updated[enrollmentId],
                [classKey]: false
              };
            }
          });
          return updated;
        });
      } catch (err) {
        console.error("Error updating null values:", err);
      }
    }
  };

  // Use selectedCourse from props, fallback to local state
  const currentCourse = selectedCourse || localSelected;

  useEffect(() => {
    if (selectedCourse) {
      setLocalSelected(selectedCourse);
    }
  }, [selectedCourse]);

  useEffect(() => {
    if (currentCourse) {
      setCourseLoading(true);
      setTimeout(() => {
        fetchStudents(currentCourse);
        fetchAttendanceDataForAll(currentCourse);
        setCourseLoading(false);
      }, 300);
    }
  }, [currentCourse]);

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

  async function fetchAttendanceDataForAll(courseClass) {
    try {
      // Get all enrollments for this class
      const { data: enrollments, error: enrollError } = await supabase
        .from("enrollments")
        .select("id, student_id")
        .eq("class_id", courseClass.id);

      if (enrollError || !enrollments) {
        console.error("Error fetching enrollments:", enrollError);
        return;
      }

      // Fetch attendance for all enrollments
      const attendanceMap = {};
      for (const enrollment of enrollments) {
        const { data: attendanceRecord, error: attError } = await supabase
          .from("attendance")
          .select("*")
          .eq("enrollment_id", enrollment.id)
          .single();

        if (!attError && attendanceRecord) {
          attendanceMap[enrollment.id] = {
            class1: attendanceRecord.class1,
            class2: attendanceRecord.class2,
            class3: attendanceRecord.class3,
            class4: attendanceRecord.class4,
            class5: attendanceRecord.class5,
            class6: attendanceRecord.class6,
            class7: attendanceRecord.class7,
            class8: attendanceRecord.class8,
            class9: attendanceRecord.class9,
            class10: attendanceRecord.class10,
            class11: attendanceRecord.class11,
            class12: attendanceRecord.class12,
          };
        }
      }
      setAttendanceData(attendanceMap);
    } catch (err) {
      console.error("Error fetching attendance data:", err);
    }
  }

  async function updateAttendance(enrollmentId, classNum, isPresent) {
    try {
      const columnName = `class${classNum}`;
      const { error } = await supabase
        .from("attendance")
        .update({ [columnName]: isPresent })
        .eq("enrollment_id", enrollmentId);

      if (error) {
        console.error("Error updating attendance:", error);
        return;
      }

      // Update local state
      setAttendanceData(prev => ({
        ...prev,
        [enrollmentId]: {
          ...prev[enrollmentId],
          [columnName]: isPresent
        }
      }));
    } catch (err) {
      console.error("Error updating attendance:", err);
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



  return (
    <div className="flex-1 flex flex-col bg-gray-50">
      {/* Main Content with Right Sidebar */}
      <div className="flex-1 flex gap-0 relative">
        {/* Left: Content Area */}
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

          {currentCourse ? (
            <>
              {/* Content Tabs */}
              <div className="bg-gray-100 border-b border-gray-200">
                <div className="flex gap-0 items-end px-6 pt-4">
                  {["Stream", "Assignments", "Materials", "Students", "Grades", "Attendance"].map((tab) => (
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
              <AnnouncementsBlock courseClassId={currentCourse.id} isReadOnly={false} />
            )}

            {/* Assignments Tab */}
            {activeTab === "Assignments" && (
              <AssignmentsBlock courseClassId={currentCourse.id} isReadOnly={false} />
            )}

            {/* Materials Tab */}
            {activeTab === "Materials" && (
              <MaterialsBlock courseClassId={currentCourse.id} isReadOnly={false} />
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
              <div className="max-w-full overflow-x-auto">
                {loading ? (
                  <div className="text-center text-gray-600 py-8">Loading attendance...</div>
                ) : students.length === 0 ? (
                  <div className="bg-gray-50 rounded-lg p-8 text-center text-gray-600">No students enrolled in this course.</div>
                ) : (
                  <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-[#8B3A3A] text-white">
                          <th className="px-4 py-3 text-left font-semibold sticky left-0 bg-[#8B3A3A] min-w-[150px]">Student Code</th>
                          <th className="px-4 py-3 text-left font-semibold sticky left-[150px] bg-[#8B3A3A] min-w-[180px]">Name</th>
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((classNum) => (
                            <th 
                              key={classNum} 
                              className="px-3 py-3 text-center font-semibold min-w-[60px] cursor-pointer hover:bg-[#A94A4A] active:bg-[#6B2A2A] transition select-none"
                              onClick={() => handleClassHeaderClick(classNum)}
                              title="Click to mark class as completed and initialize attendance"
                            >
                              <div className="flex flex-col items-center gap-1">
                                <span className="text-xs">Class {classNum}</span>
                                <span className="text-xs font-medium opacity-70">
                                  {classesCompleted[`class${classNum}`] ? "✓" : "○"}
                                </span>
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {students.map((student, idx) => {
                          const enrollmentAttendance = attendanceData[student.enrollmentId] || {};
                          return (
                            <tr key={student.enrollmentId} className={`border-t ${idx % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-blue-50 transition`}>
                              <td className="px-4 py-3 text-gray-900 font-medium sticky left-0 bg-inherit">{student.studentCode}</td>
                              <td className="px-4 py-3 text-gray-900 sticky left-[150px] bg-inherit">{student.fullName}</td>
                              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((classNum) => {
                                const classKey = `class${classNum}`;
                                const attendanceValue = enrollmentAttendance[classKey];
                                
                                return (
                                  <td key={classNum} className="px-3 py-3 text-center">
                                    {attendanceValue === null ? (
                                      // Null: empty cell
                                      <div className="text-gray-300 text-lg">-</div>
                                    ) : (
                                      // True or False: checkbox
                                      <input
                                        type="checkbox"
                                        checked={attendanceValue === true}
                                        onChange={(e) => updateAttendance(student.enrollmentId, classNum, e.target.checked)}
                                        className="w-4 h-4 cursor-pointer accent-green-600"
                                        title={attendanceValue === true ? "Present" : "Absent"}
                                      />
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full w-full">
              <p className="text-gray-500 text-lg">Select a course from the sidebar</p>
            </div>
          )}
        </div>

        {/* Right Sidebar - Course Details */}
        {currentCourse && (
        <aside className="w-80 bg-white border-l border-gray-200 p-6 flex-shrink-0 overflow-y-auto">
          <div className="space-y-5">
            {/* Course Details Card */}
            <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
              <h2 className="text-base font-bold text-gray-800 mb-4">Course Details</h2>
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Course Name</p>
                  <p className="text-sm font-semibold text-gray-900">{currentCourse.courses?.name}</p>
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Course Code</p>
                    <p className="text-sm font-semibold text-gray-900">{currentCourse.courses?.course_code}</p>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Credits</p>
                    <p className="text-sm font-semibold text-gray-900">{currentCourse.courses?.credit}</p>
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
                    <p className="text-sm font-semibold text-gray-900">{currentCourse.section}</p>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Day Slot</p>
                    <p className="text-sm font-semibold text-gray-900">{currentCourse.day_slot}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Time Slot</p>
                  <p className="text-sm font-semibold text-gray-900">{currentCourse.time_slot}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Class Room</p>
                  <p className="text-sm font-semibold text-gray-900">{currentCourse.room_no || "TBA"}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Seats</p>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-600">Enrollment</span>
                    <span className="font-semibold text-gray-900">{currentCourse.filled_seats} / {currentCourse.seats}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="h-2 rounded-full bg-[#8B3A3A]"
                      style={{ width: `${currentCourse.seats ? (currentCourse.filled_seats / currentCourse.seats) * 100 : 0}%` }}
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
                        style={{ width: `${currentCourse.seats ? (currentCourse.filled_seats / currentCourse.seats) * 100 : 0}%` }}
                      ></div>
                    </div>
                    <span className="text-sm font-semibold">{currentCourse.seats ? Math.round((currentCourse.filled_seats / currentCourse.seats) * 100) : 0}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </aside>
        )}
      </div>
    </div>
  );
}
