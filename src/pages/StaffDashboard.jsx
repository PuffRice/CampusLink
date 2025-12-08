import { Link } from "react-router-dom";

export default function StaffDashboard() {
  return (
    <div className="p-6">
      <h1 className="text-2xl mb-4">Staff Dashboard</h1>

      <div className="flex flex-col gap-3">
        <Link
          className="bg-blue-600 text-white px-4 py-2 rounded"
          to="/staff/add-student"
        >
          ➕ Add Student
        </Link>

        <Link
          className="bg-green-600 text-white px-4 py-2 rounded"
          to="/staff/add-faculty"
        >
          ➕ Add Faculty
        </Link>

        <Link
  to="/staff/create-class"
  className="bg-purple-600 text-white px-4 py-2 rounded"
>
  ➕ Create Course Class
</Link>


      </div>
    </div>
  );
}
