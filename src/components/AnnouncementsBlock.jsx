import { useState, useEffect } from "react";
import { supabase } from "../supabase";

export default function AnnouncementsBlock({ courseClassId, isReadOnly = false }) {
  const [announcements, setAnnouncements] = useState([]);
  const [newAnnouncement, setNewAnnouncement] = useState("");
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    fetchAnnouncements();
  }, [courseClassId]);

  async function fetchAnnouncements() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("announcements")
        .select("*, users:user_id!inner(*)")
        .eq("course_class_id", courseClassId)
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
    } finally {
      setLoading(false);
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
            course_class_id: courseClassId,
            user_id: userData.id,
            content: newAnnouncement,
          },
        ])
        .select("*, users:user_id!inner(*)")
        .single();

      if (error) {
        console.error("Error inserting announcement:", error);
        return;
      }

      // Optimistically update announcements list
      setAnnouncements((prev) => [inserted, ...(prev || [])]);
      setNewAnnouncement("");
    } catch (err) {
      console.error("Error posting announcement:", err);
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Post Announcement - Only show for faculty (isReadOnly = false) */}
      {!isReadOnly && (
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
      )}

      {/* Announcements List */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center text-gray-600 py-8">Loading announcements...</div>
        ) : announcements.length === 0 ? (
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
  );
}
