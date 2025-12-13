import { useState, useEffect } from "react";
import { supabase } from "../supabase";

const REQUEST_TYPES = [
  { value: "academic", label: "Academic Support" },
  { value: "technical", label: "Technical Issue" },
  { value: "facilities", label: "Facilities & Infrastructure" },
  { value: "financial", label: "Financial Assistance" },
  { value: "health", label: "Health & Wellness" },
  { value: "document", label: "Document Request" },
  { value: "other", label: "Other" },
];

const STATUS_COLORS = {
  pending: { bg: "bg-yellow-50", border: "border-yellow-200", text: "text-yellow-700", badge: "bg-yellow-100" },
  in_progress: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700", badge: "bg-blue-100" },
  completed: { bg: "bg-green-50", border: "border-green-200", text: "text-green-700", badge: "bg-green-100" },
};

export default function ServiceRequest({ userRole = "student" }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [userFullName, setUserFullName] = useState("");

  // Form state
  const [requestType, setRequestType] = useState("academic");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState({});

  useEffect(() => {
    fetchUserInfo();
    fetchRequests();
  }, []);

  async function fetchUserInfo() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("users")
        .select("id, full_name, role")
        .eq("email", user.email)
        .single();

      if (!error && data) {
        setCurrentUserId(data.id);
        setUserFullName(data.full_name);
      }
    } catch (e) {
      console.error("Error fetching user info:", e);
    }
  }

  async function fetchRequests() {
    setLoading(true);
    try {
      let query = supabase
        .from("service_requests")
        .select("*, users(full_name, email)")
        .order("created_at", { ascending: false });

      // Students see only their own requests
      if (userRole === "student") {
        query = query.eq("user_id", currentUserId);
      }
      // Staff/Admin see all requests

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

  async function submitRequest() {
    if (!description.trim() || !requestType) {
      alert("Please fill in all required fields");
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !currentUserId) {
        console.error("User not authenticated");
        return;
      }

      let fileUrl = null;
      if (file) {
        const fileExt = file.name.split(".").pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `service-requests/${currentUserId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("course-files")
          .upload(filePath, file);

        if (uploadError) {
          console.error("Error uploading file:", uploadError);
          alert("File upload failed. Please try again.");
          return;
        }

        const { data: urlData } = supabase.storage
          .from("course-files")
          .getPublicUrl(filePath);
        fileUrl = urlData.publicUrl;
      }

      const { error: insertErr } = await supabase
        .from("service_requests")
        .insert([
          {
            user_id: currentUserId,
            request_type: requestType,
            description: description,
            file_url: fileUrl,
            status: "pending",
          },
        ]);

      if (insertErr) {
        console.error("Error submitting request:", insertErr);
        alert("Failed to submit request. Please try again.");
        return;
      }

      // Reset form
      setRequestType("academic");
      setDescription("");
      setFile(null);
      alert("Request submitted successfully!");

      // Refetch requests
      await fetchRequests();
    } catch (e) {
      console.error("Error submitting request:", e);
      alert("An error occurred. Please try again.");
    } finally {
      setSubmitting(false);
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

      setSelectedStatus({ ...selectedStatus, [requestId]: newStatus });
      await fetchRequests();
    } catch (e) {
      console.error("Error updating request:", e);
    }
  }

  function getRequestTypeLabel(type) {
    return REQUEST_TYPES.find(t => t.value === type)?.label || type;
  }

  return (
    <div className="p-8 space-y-8">
      {/* Submit Form - Only for students */}
      {userRole === "student" && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Submit a Service Request</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Request Type *</label>
              <select
                value={requestType}
                onChange={(e) => setRequestType(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B3A3A]"
              >
                {REQUEST_TYPES.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Description *</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your request in detail..."
                className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#8B3A3A]"
                rows="5"
              ></textarea>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Attachment (Optional)</label>
              <input
                type="file"
                onChange={(e) => setFile(e.target.files[0])}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B3A3A]"
              />
              {file && (
                <p className="text-sm text-gray-600 mt-2">Selected: {file.name}</p>
              )}
            </div>
          </div>

          <div className="flex justify-end mt-6">
            <button
              onClick={submitRequest}
              disabled={submitting || !description.trim()}
              className="px-6 py-3 bg-[#8B3A3A] text-white rounded-lg font-semibold hover:bg-[#6B2A2A] disabled:bg-gray-400 transition"
            >
              {submitting ? "Submitting..." : "Submit Request"}
            </button>
          </div>
        </div>
      )}

      {/* Requests List */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          {userRole === "student" ? "My Service Requests" : "Service Requests"}
        </h2>

        {loading ? (
          <div className="text-center py-8 text-gray-600">Loading requests...</div>
        ) : requests.length === 0 ? (
          <div className="bg-gray-50 rounded-lg p-8 text-center text-gray-500">
            No requests found
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map((request) => {
              const colors = STATUS_COLORS[request.status] || STATUS_COLORS.pending;
              const typeLabel = getRequestTypeLabel(request.request_type);

              return (
                <div key={request.id} className={`border rounded-lg p-6 ${colors.border} ${colors.bg}`}>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-bold text-lg text-gray-900">{typeLabel}</h3>
                        <span className={`text-xs font-semibold px-3 py-1 rounded-full ${colors.badge} ${colors.text}`}>
                          {request.status === "pending" && "Pending"}
                          {request.status === "in_progress" && "In Progress"}
                          {request.status === "completed" && "Completed"}
                        </span>
                      </div>
                      {userRole !== "student" && (
                        <p className="text-sm text-gray-600">
                          Submitted by: <span className="font-semibold">{request.users?.full_name}</span> ({request.users?.email})
                        </p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(request.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="mb-4">
                    <p className="text-gray-900 whitespace-pre-wrap">{request.description}</p>
                  </div>

                  {request.file_url && (
                    <div className="mb-4 pt-4 border-t border-gray-300">
                      <a
                        href={request.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-[#8B3A3A] hover:text-[#6B2A2A] font-semibold text-sm"
                      >
                        <i className="bx bx-download"></i>
                        <span>View Attachment</span>
                      </a>
                    </div>
                  )}

                  {userRole !== "student" && (
                    <div className="pt-4 border-t border-gray-300">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Update Status</label>
                      <div className="flex gap-2">
                        {["pending", "in_progress", "completed"].map((status) => (
                          <button
                            key={status}
                            onClick={() => updateRequestStatus(request.id, status)}
                            className={`px-4 py-2 rounded-lg font-semibold text-sm transition ${
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
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
