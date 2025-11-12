// src/components/ImageUploader.jsx
import React, { useState } from "react";
import api from "../mocks/api";
import toast from "react-hot-toast";

export default function ImageUploader({ sampleId, images = [], onChange }) {
  const [localImgs, setLocalImgs] = useState(images || []);
  const [uploading, setUploading] = useState(false);

  async function handleFile(e) {
    const f = e.target.files[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) { toast.error("Hanya gambar"); return; }
    if (f.size > 5 * 1024 * 1024) { toast.error("Max 5MB"); return; }

    // preview (optimistic)
    const reader = new FileReader();
    reader.onload = async () => {
      const previewUrl = reader.result;
      const temp = { id: "tmp-" + Math.random().toString(36).slice(2,9), url: previewUrl, caption: "" };
      setLocalImgs(prev => { const n=[...prev,temp]; onChange && onChange(n); return n; });

      // upload to server
      setUploading(true);
      try {
        const res = await api.uploadImage(sampleId, f);
        if (res && res.ok) {
          // replace temp with server url
          setLocalImgs(prev => {
            const n = prev.map(img => img.id === temp.id ? { id: res.id, url: res.url, caption: "" } : img);
            onChange && onChange(n);
            return n;
          });
          toast.success("Gambar diunggah");
        } else {
          throw new Error("upload failed");
        }
      } catch (err) {
        toast.error("Gagal upload");
        // remove temp
        setLocalImgs(prev => { const n = prev.filter(i => i.id !== temp.id); onChange && onChange(n); return n; });
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(f);
    // reset input
    e.target.value = "";
  }

  async function removeImage(img) {
    if (img.id && !String(img.id).startsWith("tmp-")) {
      const res = await api.deleteImage(sampleId, img.id);
      if (!res || !res.ok) { toast.error("Gagal hapus"); return; }
    }
    setLocalImgs(prev => { const n = prev.filter(i => i.id !== img.id); onChange && onChange(n); });
  }

  function updateCaption(imgId, caption) {
    setLocalImgs(prev => { const n = prev.map(i => i.id===imgId?{...i,caption}:i); onChange && onChange(n); return n; });
  }

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2">
        <label className="px-3 py-1 border rounded cursor-pointer">
          <input type="file" accept="image/*" onChange={handleFile} className="hidden" />
          {uploading ? "Mengunggah..." : "Tambah Gambar"}
        </label>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-3">
        {localImgs.map(img => (
          <div key={img.id} className="border p-2 rounded">
            <img src={img.url} alt={img.caption||""} className="w-full h-36 object-contain" />
            <input value={img.caption||''} onChange={(e)=>updateCaption(img.id, e.target.value)} placeholder="Caption" className="w-full mt-2 border px-2 py-1 rounded" />
            <div className="flex justify-between mt-2">
              <button onClick={()=>removeImage(img)} className="px-2 py-1 text-red-600 border rounded">Hapus</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
