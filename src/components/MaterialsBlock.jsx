import { useState, useEffect } from "react";
import { supabase } from "../supabase";

export default function MaterialsBlock({ courseClassId, isReadOnly = false }) {
  const [materials, setMaterials] = useState([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [attachment, setAttachment] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchMaterials();
  }, [courseClassId]);

  async function fetchMaterials() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("materials")
        .select("*, users:user_id!inner(*)")
        .eq("course_class_id", courseClassId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching materials:", error);
        setMaterials([]);
        return;
      }

      setMaterials(data || []);
    } catch (err) {
      console.error("Error fetching materials:", err);
      setMaterials([]);
    } finally {
      setLoading(false);
    }
  }

  async function uploadMaterial() {
    if (!title.trim() || !attachment) return;

    setUploading(true);
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

      const fileExt = attachment.name.split(".").pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `materials/${courseClassId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("course-files")
        .upload(filePath, attachment);

      if (uploadError) {
        console.error("Error uploading file:", uploadError);
        alert("Failed to upload file. Please try again.");
        setUploading(false);
        return;
      }

      const { data: urlData } = supabase.storage
        .from("course-files")
        .getPublicUrl(filePath);

      const { data: inserted, error } = await supabase
        .from("materials")
        .insert([
          {
            course_class_id: courseClassId,
            user_id: userData.id,
            title: title,
            description: description || null,
            file_url: urlData.publicUrl,
            file_name: attachment.name,
            file_size: attachment.size,
          },
        ])
        .select("*, users:user_id!inner(*)")
        .single();

      if (error) {
        console.error("Error inserting material:", error);
        return;
      }

      setMaterials((prev) => [inserted, ...(prev || [])]);
      setTitle("");
      setDescription("");
      setAttachment(null);
    } catch (err) {
      console.error("Error uploading material:", err);
    } finally {
      setUploading(false);
    }
  }

  function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  function getFileIcon(fileName) {
    const ext = fileName.split(".").pop().toLowerCase();
    const iconMap = {
      pdf: "bx-file-pdf",
      doc: "bx-file-doc",
      docx: "bx-file-doc",
      xls: "bx-spreadsheet",
      xlsx: "bx-spreadsheet",
      ppt: "bx-file",
      pptx: "bx-file",
      zip: "bx-archive",
      rar: "bx-archive",
      jpg: "bx-image",
      jpeg: "bx-image",
      png: "bx-image",
      gif: "bx-image",
      txt: "bx-file-blank",
    };
    return iconMap[ext] || "bx-file";
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Upload Material - Only show for faculty */}
      {!isReadOnly && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-900">Upload Material</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Material title"
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B3A3A]"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Additional details about this material..."
                className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#8B3A3A]"
                rows="3"
              ></textarea>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">File *</label>
              <input
                type="file"
                onChange={(e) => setAttachment(e.target.files[0])}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B3A3A]"
              />
              {attachment && (
                <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-700 font-medium">{attachment.name}</p>
                  <p className="text-xs text-gray-500">{formatFileSize(attachment.size)}</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end mt-4">
            <button
              onClick={uploadMaterial}
              disabled={uploading || !title.trim() || !attachment}
              className="px-6 py-2 bg-[#8B3A3A] text-white rounded-lg font-semibold hover:bg-[#6B2A2A] disabled:bg-gray-400 transition"
            >
              {uploading ? "Uploading..." : "Upload Material"}
            </button>
          </div>
        </div>
      )}

      {/* Materials List */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center text-gray-600 py-8">Loading materials...</div>
        ) : materials.length === 0 ? (
          <div className="bg-gray-50 rounded-lg p-8 text-center text-gray-500">No materials uploaded yet</div>
        ) : (
          materials.map((material) => (
            <div key={material.id} className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm hover:shadow-md transition">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 bg-[#8B3A3A]/10 rounded-lg p-3">
                  <i className={`bx ${getFileIcon(material.file_name)} text-[#8B3A3A] text-2xl`}></i>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-lg text-gray-900 mb-1">{material.title}</h3>
                  <p className="text-sm text-gray-600 mb-2">
                    Uploaded by {material.users?.full_name || "Faculty"} • {new Date(material.created_at).toLocaleDateString()}
                  </p>
                  {material.description && (
                    <p className="text-gray-700 text-sm mb-3 whitespace-pre-wrap">{material.description}</p>
                  )}
                  <div className="flex items-center gap-4 mt-3">
                    <span className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                      {material.file_name}
                    </span>
                    <span className="text-xs text-gray-500">
                      {formatFileSize(material.file_size)}
                    </span>
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <a
                    href={material.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#8B3A3A] text-white rounded-lg font-semibold hover:bg-[#6B2A2A] transition text-sm"
                  >
                    <i className="bx bx-download text-lg"></i>
                    <span>Download</span>
                  </a>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
