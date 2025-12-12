import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "../supabase";
import AnnouncementsBlock from "../components/AnnouncementsBlock";
import AssignmentsBlock from "../components/AssignmentsBlock";
import MaterialsBlock from "../components/MaterialsBlock";

export default function EnrolledClassesLMS({ selectedCourseCode }) {
  const [courses, setCourses] = useState([]);
  const [activeCourse, setActiveCourse] = useState(null);
  const [activeEnrollmentId, setActiveEnrollmentId] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [attendance, setAttendance] = useState(null);
  const [classDetails, setClassDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [courseLoading, setCourseLoading] = useState(false);
  const location = useLocation();

  useEffect(() => {
    fetchEnrolledCourses();
  }, []);

  async function fetchEnrolledCourses() {
    try {
      // Get current user from auth
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !user.email) {
        setLoading(false);
        return;
      }

      // Get user from users table using email to get the integer ID
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("id")
        .eq("email", user.email)
        .single();
      if (userError || !userData) {
        console.error("User fetch error:", userError);
        setLoading(false);
        return;
      }
      console.log("User found:", userData);

      // Fetch enrollments for this student (student_id in enrollments matches users.id)
      const { data: enrollments, error: enrollError } = await supabase
        .from("enrollments")
        .select(`
          id,
          *,
          course_classes:class_id (
            *,
            courses:course_id (*)
          )
        `)
        .eq("student_id", userData.id);
      console.log("Enrollments fetch error:", enrollError);
      console.log("Enrollments data:", enrollments);
      if (enrollError || !enrollments) {
        setLoading(false);
        return;
      }

      // Flatten to course_classes array
      const courseClasses = enrollments
        .map(e => ({ ...e.course_classes, enrollmentId: e.id }))
        .filter(Boolean);
      console.log("Course classes:", courseClasses);
      setCourses(courseClasses);
      
      // Check if a specific course was selected from props or navigation state
      const courseToSelect = selectedCourseCode || location.state?.selectedCourse;
      if (courseToSelect) {
        const matchedCourse = courseClasses.find(
          cc => cc.courses?.course_code === courseToSelect
        );
        setActiveCourse(matchedCourse || courseClasses[0] || null);
        setActiveEnrollmentId(matchedCourse?.enrollmentId || courseClasses[0]?.enrollmentId || null);
      } else {
        setActiveCourse(courseClasses[0] || null);
        setActiveEnrollmentId(courseClasses[0]?.enrollmentId || null);
      }
      
      setLoading(false);
    } catch (err) {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (activeCourse) {
      setCourseLoading(true);
      // Small delay to show loading animation
      setTimeout(() => {
        fetchCourseData(activeCourse);

        if (activeEnrollmentId) {
          fetchAttendance(activeEnrollmentId);
        }
        setCourseLoading(false);
      }, 300);
    } else {
      setAttendance(null);
    }
  }, [activeCourse]);

  async function fetchCourseData(course) {
    // Fetch faculty details if faculty_id exists
    let facultyName = "TBA";
    let facultyEmail = "N/A";
    let officeRoom = "TBA";
    if (course.faculty_id) {
      const { data: facultyData } = await supabase
        .from("faculty")
        .select("office_room, users:user_id(full_name, email)")
        .eq("user_id", course.faculty_id)
        .single();
      facultyName = facultyData?.users?.full_name || "TBA";
      facultyEmail = facultyData?.users?.email || "N/A";
      officeRoom = facultyData?.office_room || "TBA";
    }

    // Set class details from the active course
    if (course) {
      setClassDetails({
        courseName: course.courses?.name,
        courseCode: course.courses?.course_code,
        section: course.section,
        credits: course.courses?.credit,
        room: course.room_no || "TBA",
        timeSlot: course.time_slot,
        daySlot: course.day_slot,
        faculty: facultyName,
        facultyEmail: facultyEmail,
        officeRoom: officeRoom,
        seats: course.seats,
        filledSeats: course.filled_seats,
      });
    }
    // TODO: Fetch assignments, materials, attendance, and stream for the selected course
  }

  async function fetchAttendance(enrollmentId) {
    try {
      const { data, error } = await supabase
        .from("attendance")
        .select("*")
        .eq("enrollment_id", enrollmentId)
        .single();

      if (error) {
        console.error("Attendance fetch error:", error);
        setAttendance(null);
        return;
      }

      setAttendance(data || null);
    } catch (err) {
      console.error("Attendance fetch exception:", err);
      setAttendance(null);
    }
  }



  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  if (!courses.length) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Enrolled Classes</h1>
        <div className="bg-gray-50 border rounded-lg p-6 text-gray-600">
          No enrolled courses found.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top Tab Bar for Course Switching */}
      <div className="bg-gray-100 border-b border-gray-300">
        <div className="flex gap-1 items-end px-2 pt-2">
          {courses.map((course) => (
            <button
              key={course.id}
              onClick={() => {
                setActiveCourse(course);
                setActiveEnrollmentId(course.enrollmentId);
              }}
              className={`px-5 py-3 font-medium transition-all rounded-t-lg whitespace-nowrap ${
                activeCourse?.id === course.id
                  ? "bg-white text-[#23336A] border-t-2 border-[#23336A] shadow-sm"
                  : "bg-gray-50 text-gray-700 hover:bg-white hover:text-gray-900 border-b border-gray-300"
              }`}
            >
              {course.courses?.name || course.name}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-1 relative">
        {/* Loading Overlay */}
        {courseLoading && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 border-4 border-[#23336A]/20 border-t-[#23336A] rounded-full animate-spin"></div>
              <p className="text-sm font-medium text-gray-600">Loading course...</p>
            </div>
          </div>
        )}
        {/* Main Content */}
        <div className={`flex-1 p-8 transition-opacity duration-300 ${courseLoading ? 'opacity-50' : 'opacity-100'}`}>
          {activeCourse ? (
            <>
              {/* Stream (Announcements) */}
              <section className="mb-8">
                <h2 className="text-xl font-bold mb-4">Stream</h2>
                <AnnouncementsBlock courseClassId={activeCourse.id} isReadOnly={true} />
              </section>
          {/* Assignments */}
          <section className="mb-8">
            <h2 className="text-xl font-bold mb-4">Assignments</h2>
            <AssignmentsBlock courseClassId={activeCourse.id} isReadOnly={true} />
          </section>
          {/* Uploaded Materials */}
          <section className="mb-8">
            <h2 className="text-xl font-bold mb-4">Materials</h2>
            <MaterialsBlock courseClassId={activeCourse.id} isReadOnly={true} />
          </section>
          {/* Attendance */}
          <section className="mb-8">
            <h2 className="text-xl font-bold mb-4">Attendance</h2>
            {attendance ? (
              <div className="bg-gradient-to-br from-white to-gray-50 rounded-lg border border-gray-200 overflow-hidden">
                {/* Header with Stats */}
                {(() => {
                  const attendanceValues = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
                    .map(num => attendance[`class${num}`])
                    .filter(val => val !== null && val !== undefined);
                  
                  const presentCount = attendanceValues.filter(val => val === true).length;
                  const absentCount = attendanceValues.filter(val => val === false).length;
                  const percentage = attendanceValues.length > 0 ? Math.round((presentCount / attendanceValues.length) * 100) : 0;
                  
                  return (
                    <div className="bg-[#23336A] text-white px-6 py-4 flex items-center justify-between">
                      <div className="flex items-center gap-6">
                        <div>
                          <p className="text-sm opacity-90 font-medium">Overall Attendance</p>
                          <p className="text-3xl font-bold mt-1">{percentage}%</p>
                        </div>
                        <div className="h-16 border-l border-white/20"></div>
                        <div className="flex gap-6">
                          <div>
                            <p className="text-sm opacity-90">Present</p>
                            <p className="text-2xl font-bold text-green-400">{presentCount}</p>
                          </div>
                          <div>
                            <p className="text-sm opacity-90">Absent</p>
                            <p className="text-2xl font-bold text-red-400">{absentCount}</p>
                          </div>
                          <div>
                            <p className="text-sm opacity-90">Total</p>
                            <p className="text-2xl font-bold text-blue-300">{attendanceValues.length}</p>
                          </div>
                        </div>
                      </div>
                      {/* Circular Progress */}
                      <div className="flex items-center justify-center">
                        <div className="relative w-20 h-20">
                          <svg className="w-20 h-20 transform -rotate-90" viewBox="0 0 80 80">
                            {/* Background circle */}
                            <circle cx="40" cy="40" r="36" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
                            {/* Progress circle */}
                            <circle 
                              cx="40" 
                              cy="40" 
                              r="36" 
                              fill="none" 
                              stroke="#22c55e" 
                              strokeWidth="8"
                              strokeDasharray={`${(percentage / 100) * 226} 226`}
                              strokeLinecap="round"
                            />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-lg font-bold">{percentage}%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
                
                {/* Attendance Table */}
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-100 border-t border-gray-200">
                      <th className="px-4 py-3 text-center font-semibold text-gray-700">Class 1</th>
                      <th className="px-4 py-3 text-center font-semibold text-gray-700">Class 2</th>
                      <th className="px-4 py-3 text-center font-semibold text-gray-700">Class 3</th>
                      <th className="px-4 py-3 text-center font-semibold text-gray-700">Class 4</th>
                      <th className="px-4 py-3 text-center font-semibold text-gray-700">Class 5</th>
                      <th className="px-4 py-3 text-center font-semibold text-gray-700">Class 6</th>
                      <th className="px-4 py-3 text-center font-semibold text-gray-700">Class 7</th>
                      <th className="px-4 py-3 text-center font-semibold text-gray-700">Class 8</th>
                      <th className="px-4 py-3 text-center font-semibold text-gray-700">Class 9</th>
                      <th className="px-4 py-3 text-center font-semibold text-gray-700">Class 10</th>
                      <th className="px-4 py-3 text-center font-semibold text-gray-700">Class 11</th>
                      <th className="px-4 py-3 text-center font-semibold text-gray-700">Class 12</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((classNum) => {
                        const fieldName = `class${classNum}`;
                        const value = attendance[fieldName];
                        let displayValue = '';
                        if (value === true) displayValue = 'P';
                        else if (value === false) displayValue = 'A';
                        
                        return (
                          <td key={fieldName} className="px-4 py-4 text-center border-r last:border-r-0 hover:bg-gray-50 transition-colors">
                            <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-semibold text-sm ${
                              value === true ? 'bg-green-100 text-green-700' :
                              value === false ? 'bg-red-100 text-red-700' :
                              'bg-gray-100 text-gray-400'
                            }`}>
                              {displayValue}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="bg-gray-50 rounded-lg p-4 text-gray-600">Attendance data not available.</div>
            )}
          </section>
            </>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-500">Select a course to view details</p>
            </div>
          )}
        </div>
        {/* Side Cards */}
        <aside className="w-80 bg-white border-l p-6 flex-shrink-0 overflow-y-auto">
          {classDetails ? (
            <div className="space-y-5">
              {/* Course Details Card */}
              <div className="bg-white rounded-lg border border-gray-200 p-5">
                <h2 className="text-base font-bold text-gray-800 mb-4">Course Details</h2>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Course Name</p>
                    <p className="text-sm font-semibold text-gray-900">{classDetails.courseName}</p>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Course Code</p>
                      <p className="text-sm font-semibold text-gray-900">{classDetails.courseCode}</p>
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Credits</p>
                      <p className="text-sm font-semibold text-gray-900">{classDetails.credits}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Class Details Card */}
              <div className="bg-white rounded-lg border border-gray-200 p-5">
                <h2 className="text-base font-bold text-gray-800 mb-4">Class Details</h2>
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Section</p>
                      <p className="text-sm font-semibold text-gray-900">{classDetails.section}</p>
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Day Slot</p>
                      <p className="text-sm font-semibold text-gray-900">{classDetails.daySlot}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Time Slot</p>
                    <p className="text-sm font-semibold text-gray-900">{classDetails.timeSlot}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Class Room</p>
                    <p className="text-sm font-semibold text-gray-900">{classDetails.room}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Seats</p>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-600">Enrollment</span>
                      <span className="font-semibold text-gray-900">{classDetails.filledSeats} / {classDetails.seats}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="h-2 rounded-full bg-blue-500"
                        style={{ width: `${classDetails.seats ? (classDetails.filledSeats / classDetails.seats) * 100 : 0}%` }}
                      ></div>
                    </div>
                  </div>
                  <button className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 mt-4">
                    <i className="bx bx-download"></i>
                    Download Course Outline
                  </button>
                </div>
              </div>

              {/* Faculty Details Card */}
              <div className="bg-white rounded-lg border border-gray-200 p-5">
                <h2 className="text-base font-bold text-gray-800 mb-4">Faculty Details</h2>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Name</p>
                    <p className="text-sm font-semibold text-gray-900">{classDetails.faculty}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Email</p>
                    <p className="text-sm text-gray-900 break-all">{classDetails.facultyEmail}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Office Room</p>
                    <p className="text-sm font-semibold text-gray-900">{classDetails.officeRoom}</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <p className="text-gray-500 text-center">No details available.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
