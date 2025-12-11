import { useState, useEffect } from "react";
import { supabase } from "../supabase";
import { useNavigate } from "react-router-dom";

export default function Advising() {
  const [student, setStudent] = useState(null);
  const [availableCourses, setAvailableCourses] = useState([]);
  const [enrolledCourses, setEnrolledCourses] = useState([]);
  const [totalCredits, setTotalCredits] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    fetchStudentData();
  }, []);

  async function fetchStudentData() {
    try {
      // Get current user from auth
      const { data: { user } } = await supabase.auth.getUser();
      console.log("Auth user:", user);
      
      if (!user || !user.email) {
        console.error("No auth user found");
        navigate("/");
        return;
      }

      // Get user from users table using email to get the integer ID
      console.log("Querying users table with email:", user.email);
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("id")
        .eq("email", user.email)
        .single();

      console.log("Users query result:", { userData, userError });

      if (userError || !userData) {
        console.error("Error fetching user from users table:", userError);
        console.error("User data:", userData);
        alert(`User profile not found for email: ${user.email}. Please contact administration.`);
        setLoading(false);
        return;
      }

      // Now get student details using the users table integer ID
      console.log("Querying students table with user_id:", userData.id);
      const { data: studentData, error: studentError } = await supabase
        .from("students")
        .select("*")
        .eq("user_id", userData.id)
        .maybeSingle();

      console.log("Students query result:", { studentData, studentError });

      if (studentError) {
        console.error("Error fetching student data:", studentError);
        alert(`Database error: ${studentError.message}`);
        setLoading(false);
        return;
      }

      if (!studentData) {
        console.error("No student record found for user_id:", userData.id);
        alert(`Your account (${user.email}) exists but is not registered as a student. Please contact administration to complete your student registration.`);
        setLoading(false);
        return;
      }

      console.log("Student data retrieved:", studentData);
      console.log("Student user_id:", studentData.user_id);

      setStudent(studentData);

      // Fetch enrolled courses (use user_id as the student identifier)
      await fetchEnrolledCourses(studentData.user_id);

      // Fetch available courses
      await fetchAvailableCourses(studentData.user_id);

      setLoading(false);
    } catch (error) {
      console.error("Error fetching student data:", error);
      setLoading(false);
    }
  }

  async function fetchEnrolledCourses(studentId) {
    const { data, error } = await supabase
      .from("enrollments")
      .select(`
        *,
        course_classes:class_id (
          *,
          courses:course_id (*)
        )
      `)
      .eq("student_id", studentId);

    if (error) {
      console.error("Error fetching enrolled courses:", error);
      return;
    }

    setEnrolledCourses(data || []);
    
    // Calculate total credits
    const credits = data?.reduce((sum, enrollment) => {
      return sum + (enrollment.course_classes?.courses?.credit || 0);
    }, 0) || 0;
    setTotalCredits(credits);
  }

  async function fetchAvailableCourses(studentId) {
    // Fetch all course classes with course details
    console.log("Fetching available courses for student:", studentId);
    const { data, error } = await supabase
      .from("course_classes")
      .select(`
        *,
        courses:course_id (*)
      `)
      .order("id", { ascending: true });

    console.log("Course classes query result:", { data, error });

    if (error) {
      console.error("Error fetching courses:", error);
      return;
    }

    // Filter out already enrolled courses
    const { data: enrollments } = await supabase
      .from("enrollments")
      .select("class_id")
      .eq("student_id", studentId);

    console.log("Student enrollments:", enrollments);

    const enrolledClassIds = enrollments?.map(e => e.class_id) || [];
    const filtered = data?.filter(course => !enrolledClassIds.includes(course.id)) || [];

    // Sort by course code alphabetically
    const sorted = filtered.sort((a, b) => {
      const codeA = a.courses?.course_code || "";
      const codeB = b.courses?.course_code || "";
      return codeA.localeCompare(codeB);
    });

    console.log("Available courses after filtering and sorting:", sorted);
    if (sorted && sorted.length > 0) {
      console.log("Sample course data:", sorted[0]);
    }
    setAvailableCourses(sorted);
  }

  function parseTime(timeStr) {
    // Expected format: "09:30 AM" or "9:30 AM"
    if (!timeStr) return null;
    
    const [time, period] = timeStr.split(" ");
    const [hours, minutes] = time.split(":").map(Number);
    
    let hour24 = hours;
    if (period === "PM" && hours !== 12) hour24 += 12;
    if (period === "AM" && hours === 12) hour24 = 0;
    
    return hour24 * 60 + minutes; // Return minutes from midnight
  }

  function getDaysFromSlot(daySlot) {
    if (!daySlot) return [];
    const dayMap = { S: 'Sun', M: 'Mon', T: 'Tue', W: 'Wed', R: 'Thu' };
    return daySlot.split('').map(ch => dayMap[ch]).filter(Boolean);
  }

  function timesOverlap(time1, time2) {
    if (!time1 || !time2) return false;
    
    const [start1Str, end1Str] = time1.split(' - ');
    const [start2Str, end2Str] = time2.split(' - ');
    
    const start1 = parseTime(start1Str);
    const end1 = parseTime(end1Str);
    const start2 = parseTime(start2Str);
    const end2 = parseTime(end2Str);
    
    if (!start1 || !end1 || !start2 || !end2) return false;
    
    // Check if time ranges overlap
    return start1 < end2 && start2 < end1;
  }

  function checkTimeClash(newCourse) {
    if (!newCourse.time_slot || !newCourse.day_slot) return null;
    
    const newDays = getDaysFromSlot(newCourse.day_slot);

    for (const enrollment of enrolledCourses) {
      const course = enrollment.course_classes;
      if (!course.time_slot || !course.day_slot) continue;

      const enrolledDays = getDaysFromSlot(course.day_slot);
      
      // Check if any days overlap
      const hasCommonDay = newDays.some(day => enrolledDays.includes(day));
      
      if (hasCommonDay) {
        // Check if times overlap
        if (timesOverlap(newCourse.time_slot, course.time_slot)) {
          return {
            hasClash: true,
            clashingCourse: course.courses?.course_code,
            clashingCourseName: course.courses?.name
          }; // Clash detected
        }
      }
    }
    return { hasClash: false };
  }

  async function handleEnroll(courseClass) {
    if (!student) return;

    setLoading(true);

    try {
      // Check if this course has a corresponding lab
      const courseName = courseClass.courses?.name || "";
      let labClassToEnroll = null;
      let labCourseCredits = 0;

      // If course doesn't end with "Lab", check if a corresponding lab exists
      if (!courseName.toLowerCase().includes("lab")) {
        const { data: labCourse } = await supabase
          .from("courses")
          .select("id, name, credit")
          .ilike("name", `${courseName}%Lab`)
          .single();

        // If lab course exists, find the lab class with the same section number
        if (labCourse) {
          labCourseCredits = labCourse.credit || 0;
          const { data: labClasses } = await supabase
            .from("course_classes")
            .select("*")
            .eq("course_id", labCourse.id)
            .eq("section", courseClass.section);

          if (labClasses && labClasses.length > 0) {
            labClassToEnroll = labClasses[0];
          }
        }
      }

      // Check credit limit including both main course and lab (if any)
      const courseCredits = courseClass.courses?.credit || 0;
      const totalNewCredits = courseCredits + labCourseCredits;
      
      if (totalCredits + totalNewCredits > 15) {
        setLoading(false);
        const labInfo = labClassToEnroll ? ` and ${labCourseCredits} credits for the lab` : "";
        alert(`Cannot enroll: Credit limit exceeded. You have ${totalCredits} credits. This course is ${courseCredits} credits${labInfo}, totaling ${totalNewCredits} credits. Maximum is 15.`);
        return;
      }

      // Check time clash
      const clashInfo = checkTimeClash(courseClass);
      if (clashInfo.hasClash) {
        setLoading(false);
        alert(`Cannot enroll: Time clash with ${clashInfo.clashingCourse} - ${clashInfo.clashingCourseName}.`);
        return;
      }

      // Check seat availability
      const totalSeats = courseClass.seats || 0;
      const filledSeats = courseClass.filled_seats || 0;
      if (filledSeats >= totalSeats) {
        setLoading(false);
        alert("Cannot enroll: No seats available in this course.");
        return;
      }

      // Check if lab class has available seats
      if (labClassToEnroll) {
        const labTotalSeats = labClassToEnroll.seats || 0;
        const labFilledSeats = labClassToEnroll.filled_seats || 0;
        if (labFilledSeats >= labTotalSeats) {
          setLoading(false);
          alert(`Cannot enroll: No seats available in the corresponding lab section.`);
          return;
        }

        // Check time clash for lab
        const labClashInfo = checkTimeClash(labClassToEnroll);
        if (labClashInfo.hasClash) {
          setLoading(false);
          alert(`Cannot enroll: Time clash between course and corresponding lab (clashes with ${labClashInfo.clashingCourse}).`);
          return;
        }
      }

      // Create enrollment for main course
      const { data: enrollmentData, error: enrollError } = await supabase
        .from("enrollments")
        .insert({
          class_id: courseClass.id,
          student_id: student.user_id,
          score: 0,
          grade: 0.0
        })
        .select();

      if (enrollError) {
        alert("Enrollment Error: " + enrollError.message);
        setLoading(false);
        return;
      }

      // Create attendance record for main course
      const mainEnrollmentId = enrollmentData[0]?.id;
      if (mainEnrollmentId) {
        const { error: attendanceError } = await supabase
          .from("attendance")
          .insert({
            enrollment_id: mainEnrollmentId
          });

        if (attendanceError) {
          console.error("Error creating attendance record:", attendanceError);
        }
      }

      // Update filled seats for main course
      const currentFilledSeats = courseClass.filled_seats || 0;
      const { error: updateError } = await supabase
        .from("course_classes")
        .update({ filled_seats: currentFilledSeats + 1 })
        .eq("id", courseClass.id);

      if (updateError) {
        console.error("Error updating main course seats:", updateError);
      }

      // If there's a lab class, enroll in that too
      if (labClassToEnroll) {
        const { data: labEnrollmentData, error: labEnrollError } = await supabase
          .from("enrollments")
          .insert({
            class_id: labClassToEnroll.id,
            student_id: student.user_id,
            score: 0,
            grade: 0.0
          })
          .select();

        if (labEnrollError) {
          console.error("Error enrolling in lab:", labEnrollError);
        }

        // Create attendance record for lab
        const labEnrollmentId = labEnrollmentData?.[0]?.id;
        if (labEnrollmentId) {
          const { error: labAttendanceError } = await supabase
            .from("attendance")
            .insert({
              enrollment_id: labEnrollmentId
            });

          if (labAttendanceError) {
            console.error("Error creating lab attendance record:", labAttendanceError);
          }
        }

        // Update filled seats for lab
        const labCurrentFilledSeats = labClassToEnroll.filled_seats || 0;
        const { error: labUpdateError } = await supabase
          .from("course_classes")
          .update({ filled_seats: labCurrentFilledSeats + 1 })
          .eq("id", labClassToEnroll.id);

        if (labUpdateError) {
          console.error("Error updating lab seats:", labUpdateError);
        }

        alert(`Successfully enrolled in ${courseClass.courses?.name} and ${courseClass.section} section!`);
      } else {
        alert(`Successfully enrolled in ${courseClass.courses?.name || courseClass.section}!`);
      }
      
      // Refresh data
      await fetchStudentData();
    } catch (error) {
      console.error("Enrollment error:", error);
      alert("An error occurred during enrollment.");
      setLoading(false);
    }
  }

  async function handleDrop(enrollment) {
    if (!confirm("Are you sure you want to drop this course?")) return;

    setLoading(true);

    try {
      const courseClass = enrollment.course_classes;
      const course = courseClass?.courses;

      // Delete enrollment
      const { error: dropError } = await supabase
        .from("enrollments")
        .delete()
        .eq("id", enrollment.id);

      if (dropError) {
        alert("Drop Error: " + dropError.message);
        setLoading(false);
        return;
      }

      // Update filled seats
      const currentFilledSeats = courseClass.filled_seats || 0;
      const { error: updateError } = await supabase
        .from("course_classes")
        .update({ filled_seats: Math.max(0, currentFilledSeats - 1) })
        .eq("id", courseClass.id);

      if (updateError) {
        console.error("Error updating seats:", updateError);
      }

      // Check if this course has a corresponding lab and drop that too
      if (!course?.name.toLowerCase().includes("lab")) {
        const { data: labCourse } = await supabase
          .from("courses")
          .select("id")
          .ilike("name", `${course?.name}%Lab`)
          .single();

        if (labCourse) {
          // Find the lab class enrollment with the same section
          const { data: labEnrollments } = await supabase
            .from("enrollments")
            .select(`
              id,
              course_classes:class_id (
                id,
                section,
                course_id,
                filled_seats
              )
            `)
            .eq("student_id", student.user_id);

          // Find the matching lab enrollment
          const labEnrollment = labEnrollments?.find(
            (e) => e.course_classes?.course_id === labCourse.id && 
                   e.course_classes?.section === courseClass.section
          );

          if (labEnrollment) {
            // Delete lab enrollment
            const { error: labDropError } = await supabase
              .from("enrollments")
              .delete()
              .eq("id", labEnrollment.id);

            if (labDropError) {
              console.error("Error dropping lab enrollment:", labDropError);
            } else {
              // Update lab filled seats
              const labFilledSeats = labEnrollment.course_classes?.filled_seats || 0;
              const { error: labUpdateError } = await supabase
                .from("course_classes")
                .update({ filled_seats: Math.max(0, labFilledSeats - 1) })
                .eq("id", labEnrollment.course_classes?.id);

              if (labUpdateError) {
                console.error("Error updating lab seats:", labUpdateError);
              }
            }
          }
        }
      }

      alert("Course and corresponding lab (if any) dropped successfully!");
      
      // Refresh data
      await fetchStudentData();
    } catch (error) {
      console.error("Drop error:", error);
      alert("An error occurred while dropping the course.");
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="p-8 bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-gray-800 flex items-center gap-3">
          <box-icon name="book" type="solid" size="lg" color="#2563eb"></box-icon>
          Course Advising
        </h1>

        {/* Credit Summary Card */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-8 max-w-md border-l-4 border-blue-500">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
              <box-icon name="bar-chart-alt-2" color="#3b82f6"></box-icon>
              Credit Summary
            </h2>
            <span className={`text-2xl font-bold ${totalCredits > 15 ? 'text-red-500' : 'text-blue-600'}`}>
              {totalCredits}/15
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 mt-4 overflow-hidden">
            <div 
              className={`h-3 rounded-full transition-all duration-300 ${totalCredits > 15 ? 'bg-red-500' : 'bg-gradient-to-r from-blue-500 to-blue-600'}`}
              style={{ width: `${Math.min((totalCredits / 15) * 100, 100)}%` }}
            ></div>
          </div>
          <p className="text-sm text-gray-500 mt-3">
            {totalCredits <= 12 && "You can add more courses"}
            {totalCredits > 12 && totalCredits <= 15 && "Almost at the limit"}
            {totalCredits > 15 && "⚠️ Credits exceeded limit"}
          </p>
        </div>

        {/* Enrolled Courses */}
        <div className="mb-10">
          <h2 className="text-2xl font-bold mb-5 text-gray-800 flex items-center gap-2">
            <box-icon name="check-circle" type="solid" color="#22c55e"></box-icon>
            Enrolled Courses
          </h2>
        {enrolledCourses.length === 0 ? (
          <p className="text-gray-500">No courses enrolled yet.</p>
        ) : (
          <div className="overflow-x-auto bg-white rounded-xl shadow-md">
            <table className="min-w-full">
              <thead>
                <tr className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
                  <th className="px-6 py-4 text-left text-sm font-semibold">Course Code</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">Course Name</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">Credits</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">Section</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">Time</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">Days</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">Room</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">Faculty</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {enrolledCourses.map((enrollment, idx) => {
                  const courseClass = enrollment.course_classes;
                  const course = courseClass?.courses;
                  return (
                    <tr key={enrollment.id} className={`border-b transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-blue-50'} hover:bg-blue-100`}>
                      <td className="px-6 py-4 font-semibold text-blue-600">{course?.course_code}</td>
                      <td className="px-6 py-4 text-gray-700">{course?.name}</td>
                      <td className="px-6 py-4 text-gray-600 font-medium">{course?.credit}</td>
                      <td className="px-6 py-4 text-gray-600">{courseClass?.section}</td>
                      <td className="px-6 py-4 text-gray-600">
                        {courseClass?.time_slot}
                      </td>
                      <td className="px-6 py-4 text-gray-600">{courseClass?.day_slot}</td>
                      <td className="px-6 py-4 text-gray-600">{courseClass?.room_no || "TBA"}</td>
                      <td className="px-6 py-4 text-gray-600">
                        {courseClass?.faculty?.users?.full_name || "TBA"}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleDrop(enrollment)}
                          className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors font-medium text-sm"
                        >
                          Drop
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

        {/* Available Courses */}
        <div>
          <h2 className="text-2xl font-bold mb-5 text-gray-800 flex items-center gap-2">
            <box-icon name="book" type="solid" color="#a855f7"></box-icon>
            Available Courses
          </h2>
          
          {/* Search Bar */}
          <div className="mb-6 max-w-md">
            <div className="relative">
              <box-icon name="search" className="absolute left-4 top-3.5 text-gray-400"></box-icon>
              <input
                type="text"
                placeholder="Search courses (e.g., CSE)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value.toUpperCase())}
                className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white shadow-sm"
              />
            </div>
          </div>

          {availableCourses.length === 0 ? (
            <p className="text-gray-500">No available courses to enroll.</p>
          ) : (
            <div className="overflow-x-auto bg-white rounded-xl shadow-md">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
                    <th className="px-6 py-4 text-left text-sm font-semibold">Course Code</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold">Course Name</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold">Credits</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold">Section</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold">Time</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold">Days</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold">Room</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold">Faculty</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold">Seats</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold">Action</th>
                  </tr>
                </thead>
              <tbody>
                {availableCourses
                  .filter(courseClass => 
                    courseClass.courses?.course_code?.includes(searchTerm)
                  )
                  .map((courseClass, idx) => {
                  const course = courseClass.courses;
                  const totalSeats = courseClass.seats || 0;
                  const filledSeats = courseClass.filled_seats || 0;
                  const hasSeats = filledSeats < totalSeats;
                  const wouldExceedCredits = (totalCredits + (course?.credit || 0)) > 15;
                  const clashInfo = checkTimeClash(courseClass);
                  const hasTimeClash = clashInfo.hasClash;
                  // Check if already enrolled in any section of this course
                  const alreadyEnrolledInCourse = enrolledCourses.some(
                    (enrollment) => enrollment.course_classes?.course_id === courseClass.course_id
                  );
                  return (
                    <tr key={courseClass.id} className={`border-b transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-purple-50'} hover:bg-purple-100`}>
                      <td className="px-6 py-4 font-semibold text-purple-600">{course?.course_code}</td>
                      <td className="px-6 py-4 text-gray-700">{course?.name}</td>
                      <td className="px-6 py-4 text-gray-600 font-medium">{course?.credit}</td>
                      <td className="px-6 py-4 text-gray-600">{courseClass.section}</td>
                      <td className="px-6 py-4 text-gray-600">
                        {courseClass.time_slot}
                      </td>
                      <td className="px-6 py-4 text-gray-600">{courseClass.day_slot}</td>
                      <td className="px-6 py-4 text-gray-600">{courseClass.room_no || "TBA"}</td>
                      <td className="px-6 py-4 text-gray-600">
                        {courseClass.faculty?.users?.full_name || "TBA"}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                          hasSeats ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {courseClass.filled_seats !== undefined && courseClass.seats !== undefined 
                            ? `${courseClass.filled_seats}/${courseClass.seats}` 
                            : "N/A"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {alreadyEnrolledInCourse ? (
                          <button
                            disabled
                            className="px-4 py-2 rounded-lg bg-gray-200 text-gray-500 cursor-not-allowed font-medium text-sm"
                          >
                            Enrolled
                          </button>
                        ) : (
                          <button
                            onClick={() => handleEnroll(courseClass)}
                            disabled={!hasSeats || wouldExceedCredits || hasTimeClash}
                            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                              !hasSeats || wouldExceedCredits || hasTimeClash
                                ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                                : "bg-green-500 text-white hover:bg-green-600"
                            }`}
                            title={
                              !hasSeats ? "No seats available" :
                              wouldExceedCredits ? "Would exceed 15 credit limit" :
                              hasTimeClash ? `Time clash with ${clashInfo.clashingCourse} - ${clashInfo.clashingCourseName}` :
                              "Click to enroll"
                            }
                          >
                            {!hasSeats ? "Full" : 
                             wouldExceedCredits ? "Credits" :
                             hasTimeClash ? "Clash" : "Enroll"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}
