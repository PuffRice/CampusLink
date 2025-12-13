import { useState, useEffect } from "react";
import { supabase } from "../supabase";

const STATUS_COLORS = {
  pending: { bg: "bg-yellow-50", border: "border-yellow-200", text: "text-yellow-700", badge: "bg-yellow-100" },
  in_progress: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700", badge: "bg-blue-100" },
  completed: { bg: "bg-green-50", border: "border-green-200", text: "text-green-700", badge: "bg-green-100" },
};

const REQUEST_TYPES = {
  "academic": "Academic Support",
  "technical": "Technical Issue",
  "facilities": "Facilities & Infrastructure",
  "financial": "Financial Assistance",
  "health": "Health & Wellness",
  "document": "Document Request",
  "other": "Other",
};

export default function ServiceRequestManagement() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [staffNotes, setStaffNotes] = useState({});

  useEffect(() => {
    fetchAllRequests();
  }, []);

  async function fetchAllRequests() {
    setLoading(true);
    try {
      let query = supabase
        .from("service_requests")
        .select("*, users(full_name, email)")
        .order("created_at", { ascending: false });

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching requests:", error);
        setRequests([]);
        return;
      }

      setRequests(data || []);
    } catch (err) {
      console.error("Error fetching requests:", err);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }

  async function updateRequestStatus(requestId, newStatus) {
    try {
      const { error } = await supabase
        .from("service_requests")
        .update({ status: newStatus })
        .eq("id", requestId);

      if (error) {
        console.error("Error updating status:", error);
        return;
      }

      await fetchAllRequests();
    } catch (e) {
      console.error("Error updating request:", e);
    }
  }

  async function saveStaffNotes(requestId, notes) {
    try {
      const { error } = await supabase
        .from("service_requests")
        .update({ staff_notes: notes })
        .eq("id", requestId);

      if (error) {
        console.error("Error saving notes:", error);
        return;
      }

      alert("Notes saved successfully!");
      await fetchAllRequests();
    } catch (e) {
      console.error("Error saving notes:", e);
    }
  }

  // Filter requests
  const filteredRequests = requests.filter((req) => {
    const statusMatch = filterStatus === "all" || req.status === filterStatus;
    const typeMatch = filterType === "all" || req.request_type === filterType;
    return statusMatch && typeMatch;
  });

  function getRequestTypeLabel(type) {
    return REQUEST_TYPES[type] || type;
  }

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Service Request Management</h1>
        <p className="text-gray-600">Review and manage all student service requests</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Filter by Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B3A3A]"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Filter by Type</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B3A3A]"
            >
              <option value="all">All Types</option>
              {Object.entries(REQUEST_TYPES).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-sm font-semibold text-gray-600 mb-1">Total Requests</p>
          <p className="text-3xl font-bold text-gray-900">{requests.length}</p>
        </div>
        <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-6">
          <p className="text-sm font-semibold text-yellow-700 mb-1">Pending</p>
          <p className="text-3xl font-bold text-yellow-700">{requests.filter(r => r.status === "pending").length}</p>
        </div>
        <div className="bg-blue-50 rounded-lg border border-blue-200 p-6">
          <p className="text-sm font-semibold text-blue-700 mb-1">In Progress</p>
          <p className="text-3xl font-bold text-blue-700">{requests.filter(r => r.status === "in_progress").length}</p>
        </div>
        <div className="bg-green-50 rounded-lg border border-green-200 p-6">
          <p className="text-sm font-semibold text-green-700 mb-1">Completed</p>
          <p className="text-3xl font-bold text-green-700">{requests.filter(r => r.status === "completed").length}</p>
        </div>
      </div>

      {/* Requests List */}
      <div>
        {loading ? (
          <div className="text-center py-8 text-gray-600">Loading requests...</div>
        ) : filteredRequests.length === 0 ? (
          <div className="bg-gray-50 rounded-lg p-8 text-center text-gray-500">
            No requests match the selected filters
          </div>
        ) : (
          <div className="space-y-4">
            {filteredRequests.map((request) => {
              const colors = STATUS_COLORS[request.status] || STATUS_COLORS.pending;
              const typeLabel = getRequestTypeLabel(request.request_type);

              return (
                <div key={request.id} className={`border rounded-lg p-6 ${colors.border} ${colors.bg}`}>
                  <div className="grid grid-cols-3 gap-6">
                    {/* Left Column - Request Info */}
                    <div className="col-span-2">
                      <div className="flex items-center gap-3 mb-3">
                        <h3 className="font-bold text-lg text-gray-900">{typeLabel}</h3>
                        <span className={`text-xs font-semibold px-3 py-1 rounded-full ${colors.badge} ${colors.text}`}>
                          {request.status === "pending" && "Pending"}
                          {request.status === "in_progress" && "In Progress"}
                          {request.status === "completed" && "Completed"}
                        </span>
                      </div>

                      <div className="mb-4 p-4 bg-white rounded-lg border border-gray-200">
                        <p className="text-sm font-semibold text-gray-700 mb-1">Submitted by:</p>
                        <p className="text-gray-900 font-semibold">{request.users?.full_name}</p>
                        <p className="text-sm text-gray-600">{request.users?.email}</p>
                        <p className="text-xs text-gray-500 mt-2">
                          {new Date(request.created_at).toLocaleString()}
                        </p>
                      </div>

                      <div className="mb-4">
                        <p className="text-sm font-semibold text-gray-700 mb-2">Description:</p>
                        <div className="bg-white rounded-lg border border-gray-200 p-4">
                          <p className="text-gray-900 whitespace-pre-wrap">{request.description}</p>
                        </div>
                      </div>

                      {request.file_url && (
                        <div className="mb-4">
                          <a
                            href={request.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-[#8B3A3A] hover:text-[#6B2A2A] font-semibold text-sm bg-white px-4 py-2 rounded-lg border border-gray-200"
                          >
                            <i className="bx bx-download"></i>
                            <span>View Attachment</span>
                          </a>
                        </div>
                      )}

                      {/* Staff Notes */}
                      <div className="mb-4">
                        <p className="text-sm font-semibold text-gray-700 mb-2">Staff Notes:</p>
                        <textarea
                          value={staffNotes[request.id] || request.staff_notes || ""}
                          onChange={(e) => setStaffNotes({ ...staffNotes, [request.id]: e.target.value })}
                          placeholder="Add internal notes for this request..."
                          className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#8B3A3A]"
                          rows="3"
                        ></textarea>
                        <button
                          onClick={() => saveStaffNotes(request.id, staffNotes[request.id] || request.staff_notes || "")}
                          className="mt-2 px-4 py-2 bg-[#8B3A3A] text-white rounded-lg font-semibold hover:bg-[#6B2A2A] transition"
                        >
                          Save Notes
                        </button>
                      </div>
                    </div>

                    {/* Right Column - Status Management */}
                    <div>
                      <p className="text-sm font-semibold text-gray-700 mb-3">Update Status</p>
                      <div className="space-y-2">
                        {["pending", "in_progress", "completed"].map((status) => (
                          <button
                            key={status}
                            onClick={() => updateRequestStatus(request.id, status)}
                            className={`w-full px-4 py-2 rounded-lg font-semibold text-sm transition ${
                              request.status === status
                                ? "bg-[#8B3A3A] text-white"
                                : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
                            }`}
                          >
                            {status === "pending" && "Pending"}
                            {status === "in_progress" && "In Progress"}
                            {status === "completed" && "Completed"}
                          </button>
                        ))}
                      </div>

                      {/* Request ID */}
                      <div className="mt-6 p-3 bg-gray-100 rounded-lg">
                        <p className="text-xs font-semibold text-gray-600 mb-1">Request ID</p>
                        <p className="text-xs font-mono text-gray-700 break-all">{request.id}</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
