// src/pages/DatasheetDetail.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import toast from "react-hot-toast";
import { FaSpinner } from "react-icons/fa";
import {
  FiArrowLeft,
  FiEdit3,
  FiPlus,
  FiCheck,
  FiTrash2,
  FiUpload,
  FiClipboard,
  FiImage,
} from "react-icons/fi";
import apiClient from "../api";

// The backend serves uploaded files at <host>/uploads/... (outside /api).
const FILE_BASE = (apiClient.defaults.baseURL || "").replace(/\/api\/?$/, "");

const btnPrimarySm =
  "inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-lg text-[13px] font-semibold bg-navy-800 text-white hover:bg-navy-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors";
const btnGhostSm =
  "inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-lg text-[13px] font-semibold bg-paper text-navy-800 border border-line hover:bg-navy-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors";
const btnSoftSm =
  "inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-lg text-[13px] font-semibold bg-navy-50 text-navy-800 hover:bg-navy-100 transition-colors";
const inputCls =
  "w-full px-2.5 py-2 border border-line rounded-lg text-[13px] text-navy-800 bg-paper outline-none transition-colors focus:border-navy-600 focus:ring-[3px] focus:ring-navy-600/[0.12] placeholder:text-ink-400";

const STATUS_META = {
  DRAFT: { label: "Draft", cls: "bg-neutral-bg text-neutral-fg" },
  IN_PROGRESS: { label: "In Progress", cls: "bg-warn-bg text-warn-fg" },
  APPROVED: { label: "Approved", cls: "bg-ok-bg text-ok-fg" },
};

function StatusPill({ status }) {
  const m = STATUS_META[status] || STATUS_META.DRAFT;
  return (
    <span
      className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-xs font-semibold whitespace-nowrap ${m.cls}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      {m.label}
    </span>
  );
}

function fmtDate(d) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return d;
  }
}

function InfoRow({ label, value, mono, editing, onChange, placeholder }) {
  const isEdit = editing && typeof onChange === "function";
  return (
    <div className="grid grid-cols-1 nav:grid-cols-[180px_1fr] gap-1 nav:gap-4 py-3.5 border-b border-line-soft last:border-b-0 nav:items-center">
      <dt className="text-[13px] text-ink-400">{label}</dt>
      <dd>
        {isEdit ? (
          <input
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={inputCls}
          />
        ) : (
          <span
            className={`text-sm font-medium text-navy-800 ${
              mono ? "font-mono text-[13px]" : ""
            }`}
          >
            {value || <span className="text-ink-300">—</span>}
          </span>
        )}
      </dd>
    </div>
  );
}

function ImageGallery({ title, sub, addLabel, category, reportId, images, onAdd, onRemove }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const pick = () => {
    if (!reportId) {
      toast.error("Report untuk sample ini belum tersedia.");
      return;
    }
    inputRef.current?.click();
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !reportId) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      fd.append("category", category);
      const res = await apiClient.post(
        `/uploads/report-image/${reportId}`,
        fd
      );
      onAdd(res.data);
      toast.success("Gambar ditambahkan.");
    } catch (err) {
      toast.error(err.response?.data?.error || "Gagal mengunggah gambar.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleDelete = async (id) => {
    try {
      await apiClient.delete(`/uploads/image/${id}`);
      onRemove(id);
    } catch {
      toast.error("Gagal menghapus gambar.");
    }
  };

  return (
    <section className="bg-paper border border-line rounded-2xl shadow-card overflow-hidden">
      <div className="flex flex-col gap-3 nav:flex-row nav:items-center nav:justify-between p-4 nav:py-5 nav:px-6 border-b border-line-soft">
        <div>
          <h2 className="text-lg font-semibold text-navy-800">{title}</h2>
          <p className="text-[13px] text-ink-400 mt-0.5">{sub}</p>
        </div>
        <button className={btnGhostSm} onClick={pick} disabled={busy}>
          {busy ? <FaSpinner className="animate-spin" /> : <FiUpload size={14} />}
          {addLabel}
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={handleFile}
      />

      <div className="grid grid-cols-2 nav:grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3 p-4 nav:p-5">
        {images.map((img) => (
          <div
            key={img.id}
            className="group relative rounded-xl overflow-hidden border border-line aspect-[4/3] bg-navy-50 bg-cover bg-center transition-transform hover:-translate-y-0.5 hover:shadow-card"
            style={{ backgroundImage: `url(${FILE_BASE}${img.url})` }}
          >
            <button
              onClick={() => handleDelete(img.id)}
              title="Hapus"
              className="absolute top-1.5 right-1.5 w-6 h-6 rounded-md bg-navy-900/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 hover:!bg-bad-fg transition-opacity"
            >
              <FiTrash2 size={13} />
            </button>
            <div className="absolute left-2 right-2 bottom-2 bg-navy-900/85 text-white rounded-md px-2 py-1 flex items-center justify-between gap-1.5 text-[11px]">
              <span className="truncate">{img.caption || title}</span>
              <span className="font-mono text-[10px] text-white/70 shrink-0">
                #{img.id}
              </span>
            </div>
          </div>
        ))}
        <button
          onClick={pick}
          disabled={busy}
          className="aspect-[4/3] border-2 border-dashed border-line rounded-xl flex flex-col items-center justify-center gap-1.5 text-ink-400 text-xs hover:border-navy-500 hover:bg-navy-50 hover:text-navy-800 transition-colors disabled:opacity-50"
        >
          <FiPlus size={20} />
          <strong className="text-[13px] font-semibold">{addLabel}</strong>
          <span>PNG / JPG · maks 5 MB</span>
        </button>
      </div>
    </section>
  );
}

const EMPTY_DRAFT = {
  objek: "",
  pabrikan: "",
  tipe: "",
  data_teknis: "",
  standar: "",
  tanda: "",
};

export default function DatasheetDetail() {
  const { sampleId } = useParams();
  const navigate = useNavigate();

  const [sample, setSample] = useState(null);
  const [loading, setLoading] = useState(true);
  const [components, setComponents] = useState([]);
  const [images, setImages] = useState([]);

  const [addOpen, setAddOpen] = useState(false);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [savingComp, setSavingComp] = useState(false);

  // Datasheet-info edit mode
  const [editing, setEditing] = useState(false);
  const [infoForm, setInfoForm] = useState({});
  const [savingInfo, setSavingInfo] = useState(false);

  useEffect(() => {
    let mounted = true;
    apiClient
      .get(`/samples/${sampleId}`)
      .then((res) => {
        if (!mounted) return;
        setSample(res.data);
        setComponents(res.data.Components || []);
        setImages(res.data.Report?.ReportImages || []);
      })
      .catch((err) => {
        console.error("Error fetching sample:", err);
        if (err.response?.status !== 404) {
          toast.error("Gagal memuat datasheet.");
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [sampleId]);

  const componentImages = useMemo(
    () => images.filter((i) => i.category === "COMPONENT"),
    [images]
  );
  const sampleImages = useMemo(
    () => images.filter((i) => i.category !== "COMPONENT"),
    [images]
  );

  const addComponent = async () => {
    if (!draft.objek.trim()) {
      toast.error("Objek / part No. wajib diisi.");
      return;
    }
    setSavingComp(true);
    try {
      const res = await apiClient.post(
        `/samples/${sampleId}/components`,
        draft
      );
      setComponents((c) => [...c, res.data]);
      setDraft(EMPTY_DRAFT);
      setAddOpen(false);
    } catch (err) {
      toast.error(err.response?.data?.error || "Gagal menambah komponen.");
    } finally {
      setSavingComp(false);
    }
  };

  const removeComponent = async (id) => {
    try {
      await apiClient.delete(`/components/${id}`);
      setComponents((c) => c.filter((x) => x.id !== id));
    } catch {
      toast.error("Gagal menghapus komponen.");
    }
  };

  const startEditInfo = () => {
    const o = sample.order || {};
    setInfoForm({
      applicant: o.applicant || "",
      applicant_address: o.address || "",
      brand: sample.brand || "",
      model: sample.model || "",
      factory: sample.factory || "",
      factory_address: sample.factory_address || "",
      country_origin: sample.country_origin || "",
      iwo_no: sample.iwo_no || "",
    });
    setEditing(true);
  };

  const saveInfo = async () => {
    if (!infoForm.brand?.trim() || !infoForm.model?.trim()) {
      toast.error("Brand dan Model wajib diisi.");
      return;
    }
    setSavingInfo(true);
    try {
      const res = await apiClient.patch(`/samples/${sampleId}`, infoForm);
      setSample(res.data);
      setComponents(res.data.Components || []);
      setImages(res.data.Report?.ReportImages || []);
      setEditing(false);
      toast.success("Datasheet info diperbarui.");
    } catch (err) {
      toast.error(err.response?.data?.error || "Gagal menyimpan perubahan.");
    } finally {
      setSavingInfo(false);
    }
  };

  const editField = (key, displayValue, placeholder) => ({
    editing,
    value: editing ? infoForm[key] : displayValue,
    onChange: (v) => setInfoForm((f) => ({ ...f, [key]: v })),
    placeholder,
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-ink-400">
        <FaSpinner className="animate-spin" /> Memuat datasheet…
      </div>
    );
  }
  if (!sample) {
    return (
      <div className="py-24 text-center">
        <div className="text-[15px] font-medium text-navy-800">
          Datasheet tidak ditemukan
        </div>
        <p className="text-sm text-ink-400 mt-1">
          Sample ini tidak ada atau tidak dapat diakses.
        </p>
      </div>
    );
  }

  const order = sample.order || {};
  const report = sample.Report || null;
  const reportId = report?.id || null;
  const td = (cls = "") =>
    `px-4 py-3.5 border-b border-line-soft text-sm ${cls}`;

  return (
    <div className="flex flex-col gap-4">
      <Link
        to="/technician-dashboard"
        className="inline-flex items-center gap-1.5 text-[13px] text-ink-500 hover:text-navy-800 transition-colors w-fit"
      >
        <FiArrowLeft size={14} /> Back to dashboard
      </Link>

      {/* Detail head */}
      <div className="flex flex-col gap-4 nav:flex-row nav:justify-between nav:items-start bg-paper border border-line rounded-2xl shadow-card p-5 nav:p-6">
        <div className="min-w-0">
          <div className="font-mono text-[13px] text-ink-400">
            Datasheet · {order.order_no || sample.id}
          </div>
          <h1 className="text-2xl font-semibold text-navy-800 mt-1 tracking-[-0.01em]">
            {order.applicant || sample.name || "Datasheet"}
          </h1>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-400 mt-1.5">
            <span>
              Lab: <strong className="font-medium text-navy-800">{order.lab?.name || "—"}</strong>
            </span>
            <span>
              Sample: <strong className="font-medium text-navy-800">{sample.name || "—"}</strong>
            </span>
            <span>
              Created:{" "}
              <strong className="font-medium text-navy-800">
                {fmtDate(order.createdAt)}
              </strong>
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status={report?.status || "DRAFT"} />
          <button
            className={btnPrimarySm}
            onClick={() => navigate(`/reports/${sample.id}`)}
          >
            <FiEdit3 size={14} /> Open Klausul Editor
          </button>
        </div>
      </div>

      {/* Datasheet info */}
      <section className="bg-paper border border-line rounded-2xl shadow-card overflow-hidden">
        <div className="flex items-center justify-between gap-3 p-4 nav:py-5 nav:px-6 border-b border-line-soft">
          <h2 className="text-lg font-semibold text-navy-800">Datasheet info</h2>
          {editing ? (
            <div className="flex items-center gap-2">
              <button
                className={btnSoftSm}
                onClick={() => setEditing(false)}
                disabled={savingInfo}
              >
                Batal
              </button>
              <button
                className={btnPrimarySm}
                onClick={saveInfo}
                disabled={savingInfo}
              >
                {savingInfo ? (
                  <FaSpinner className="animate-spin" />
                ) : (
                  <FiCheck size={14} />
                )}
                Simpan
              </button>
            </div>
          ) : (
            <button className={btnGhostSm} onClick={startEditInfo}>
              <FiEdit3 size={14} /> Edit
            </button>
          )}
        </div>
        {editing && (
          <p className="px-4 nav:px-6 pt-3 text-xs text-ink-400">
            Nomor order, lab, standar uji &amp; jenis pengujian tidak dapat
            diubah di sini.
          </p>
        )}
        <dl className="px-4 nav:px-6 py-1">
          <InfoRow label="Lab Number" value={order.order_no} mono />
          <InfoRow label="Laboratory" value={order.lab?.name} />
          <InfoRow label="Test standard" value={sample.testStandard?.name} />
          <InfoRow
            label="Applicant"
            {...editField("applicant", order.applicant, "Nama pemohon")}
          />
          <InfoRow
            label="Applicant address"
            {...editField(
              "applicant_address",
              order.address,
              "Alamat pemohon"
            )}
          />
          <InfoRow
            label="Brand"
            {...editField("brand", sample.brand, "Merek")}
          />
          <InfoRow
            label="Model"
            {...editField("model", sample.model, "Tipe / model")}
          />
          <InfoRow
            label="Factory"
            {...editField("factory", sample.factory, "Nama pabrikan")}
          />
          <InfoRow
            label="Factory address"
            {...editField(
              "factory_address",
              sample.factory_address,
              "Alamat pabrikan"
            )}
          />
          <InfoRow
            label="Country of origin"
            {...editField(
              "country_origin",
              sample.country_origin,
              "Negara pembuat"
            )}
          />
          <InfoRow
            label="IWO No."
            {...editField("iwo_no", sample.iwo_no, "Nomor IWO")}
          />
          <InfoRow label="Testing type" value={report?.testing_type} />
        </dl>
      </section>

      {/* Komponen */}
      <section className="bg-paper border border-line rounded-2xl shadow-card overflow-hidden">
        <div className="flex flex-col gap-3 nav:flex-row nav:items-center nav:justify-between p-4 nav:py-5 nav:px-6 border-b border-line-soft">
          <div>
            <h2 className="text-lg font-semibold text-navy-800">Komponen</h2>
            <p className="text-[13px] text-ink-400 mt-0.5">
              {components.length} komponen tercatat untuk sampel ini
            </p>
          </div>
          <button
            className={btnGhostSm}
            onClick={() => setAddOpen((o) => !o)}
          >
            <FiPlus size={14} /> {addOpen ? "Tutup form" : "Tambah Komponen"}
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-separate border-spacing-0">
            <thead>
              <tr>
                {[
                  ["#", "w-12"],
                  ["Objek / part No.", ""],
                  ["Pabrikan / merk dagang", ""],
                  ["Tipe / model", ""],
                  ["Data teknis", ""],
                  ["Standar", "text-center w-24"],
                  ["Tanda sertifikasi", "text-center w-32"],
                  ["", "w-14"],
                ].map(([h, w], i) => (
                  <th
                    key={i}
                    className={`bg-[#fbfcfe] text-left text-[11px] font-semibold text-ink-500 uppercase tracking-[0.06em] px-4 py-3 border-b border-line whitespace-nowrap ${w}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {addOpen && (
                <tr>
                  <td colSpan={8} className="bg-[#fbfcfe] px-4 py-3 border-b border-line-soft">
                    <div className="grid grid-cols-1 nav:grid-cols-3 gap-2">
                      <input
                        autoFocus
                        className={inputCls}
                        placeholder="Objek / part No. (mis. Terminal)"
                        value={draft.objek}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, objek: e.target.value }))
                        }
                      />
                      <input
                        className={inputCls}
                        placeholder="Pabrikan / merk dagang"
                        value={draft.pabrikan}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, pabrikan: e.target.value }))
                        }
                      />
                      <input
                        className={inputCls}
                        placeholder="Tipe / model"
                        value={draft.tipe}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, tipe: e.target.value }))
                        }
                      />
                      <input
                        className={inputCls}
                        placeholder="Data teknis (mis. 250V)"
                        value={draft.data_teknis}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            data_teknis: e.target.value,
                          }))
                        }
                      />
                      <input
                        className={inputCls}
                        placeholder="Standar"
                        value={draft.standar}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, standar: e.target.value }))
                        }
                      />
                      <input
                        className={inputCls}
                        placeholder="Tanda sertifikasi"
                        value={draft.tanda}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, tanda: e.target.value }))
                        }
                      />
                      <div className="nav:col-span-3 flex justify-end gap-2">
                        <button
                          className={btnSoftSm}
                          onClick={() => {
                            setAddOpen(false);
                            setDraft(EMPTY_DRAFT);
                          }}
                        >
                          Batal
                        </button>
                        <button
                          className={btnPrimarySm}
                          onClick={addComponent}
                          disabled={savingComp}
                        >
                          {savingComp ? (
                            <FaSpinner className="animate-spin" />
                          ) : (
                            <FiCheck size={14} />
                          )}
                          Tambah
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              )}

              {components.length === 0 && !addOpen ? (
                <tr>
                  <td colSpan={8}>
                    <div className="py-12 px-6 text-center">
                      <FiClipboard
                        size={44}
                        className="mx-auto text-ink-300 mb-3"
                      />
                      <div className="text-[15px] font-medium text-navy-800 mb-1">
                        Belum ada komponen
                      </div>
                      <div className="text-sm text-ink-400">
                        Klik "Tambah Komponen" untuk mencatat komponen yang
                        diuji
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                components.map((k, i) => (
                  <tr key={k.id} className="hover:bg-navy-50 transition-colors">
                    <td className={td("text-ink-400 tabular-nums")}>
                      {String(i + 1).padStart(2, "0")}
                    </td>
                    <td className={td("font-medium text-navy-800")}>
                      {k.objek}
                    </td>
                    <td className={td(k.pabrikan ? "text-ink-700" : "text-ink-300")}>
                      {k.pabrikan || "—"}
                    </td>
                    <td className={td("font-mono text-[12px] text-ink-500")}>
                      {k.tipe || "—"}
                    </td>
                    <td className={td("text-ink-700")}>
                      {k.data_teknis || "—"}
                    </td>
                    <td className={td("text-center font-semibold text-navy-700")}>
                      {k.standar || "—"}
                    </td>
                    <td className={td("text-center")}>
                      {k.tanda ? (
                        <span className="inline-flex items-center justify-center min-w-9 h-6 px-1.5 rounded-md bg-navy-50 text-navy-800 font-mono text-[12px] font-semibold">
                          {k.tanda}
                        </span>
                      ) : (
                        <span className="text-ink-300">—</span>
                      )}
                    </td>
                    <td className={td("text-right")}>
                      <button
                        onClick={() => removeComponent(k.id)}
                        title="Hapus komponen"
                        className="inline-flex w-8 h-8 rounded-lg items-center justify-center text-ink-400 hover:bg-bad-bg hover:text-bad-fg transition-colors"
                      >
                        <FiTrash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Gambar Komponen */}
      <ImageGallery
        title="Gambar Komponen"
        sub={`${componentImages.length} foto · dokumentasi setiap komponen`}
        addLabel="Tambah Gambar"
        category="COMPONENT"
        reportId={reportId}
        images={componentImages}
        onAdd={(img) => setImages((p) => [img, ...p])}
        onRemove={(id) => setImages((p) => p.filter((x) => x.id !== id))}
      />

      {/* Galeri Gambar Sampel */}
      <ImageGallery
        title="Galeri Gambar Sampel"
        sub={`${sampleImages.length} foto · dokumentasi sampel & lokasi pengujian`}
        addLabel="Tambah Gambar Sampel"
        category="SAMPLE"
        reportId={reportId}
        images={sampleImages}
        onAdd={(img) => setImages((p) => [img, ...p])}
        onRemove={(id) => setImages((p) => p.filter((x) => x.id !== id))}
      />
    </div>
  );
}
