// src/pages/ManageStandards.jsx
import { useEffect, useState } from "react";
import apiClient from "../api";
import toast from "react-hot-toast";
import {
  FiPlus,
  FiTrash2,
  FiCode,
  FiList,
  FiSave,
  FiEdit3,
  FiX,
  FiFolder,
  FiChevronDown,
  FiChevronRight,
  FiColumns,
  FiUploadCloud,
  FiFileText,
} from "react-icons/fi";
import TemplateBuilder from "../components/TemplateBuilder";

const input =
  "w-full px-3.5 py-2.5 border border-line rounded-lg text-sm text-navy-800 bg-paper outline-none transition-colors focus:border-navy-600 focus:ring-[3px] focus:ring-navy-600/[0.12] placeholder:text-ink-400";
const inputSm =
  "px-2.5 py-1.5 border border-line rounded-lg text-[13px] text-navy-800 bg-paper outline-none transition-colors focus:border-navy-600 focus:ring-2 focus:ring-navy-600/10 placeholder:text-ink-400";
const label = "block text-[13px] font-medium text-navy-800 mb-1.5";
const btnPrimary =
  "inline-flex items-center justify-center gap-2 h-11 px-[18px] rounded-xl text-sm font-semibold bg-navy-800 text-white hover:bg-navy-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors";
const iconBtn =
  "w-8 h-8 rounded-lg inline-flex items-center justify-center transition-colors shrink-0";

export default function ManageStandards() {
  const [labs, setLabs] = useState([]);
  const [activeTab, setActiveTab] = useState("BUILDER");
  const [isLoading, setIsLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState("");
  const [standardNumbers, setStandardNumbers] = useState([""]);
  const [formCode, setFormCode] = useState("");
  const [labId, setLabId] = useState("");
  const [jsonFile, setJsonFile] = useState(null);
  const [jsonFileName, setJsonFileName] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [clauses, setClauses] = useState([]);
  const [expandedLabs, setExpandedLabs] = useState({});

  const addStandardNumber = () => setStandardNumbers([...standardNumbers, ""]);
  const updateStandardNumber = (index, value) => {
    const n = [...standardNumbers];
    n[index] = value;
    setStandardNumbers(n);
  };
  const removeStandardNumber = (index) => {
    const n = [...standardNumbers];
    n.splice(index, 1);
    setStandardNumbers(n);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await apiClient.get("/labs");
      setLabs(res.data);
      const init = {};
      res.data.forEach((l) => {
        if (l.TestStandards?.length > 0) init[l.id] = true;
      });
      setExpandedLabs(init);
    } catch (e) {
      console.error(e);
    }
  };

  const toggleLab = (id) =>
    setExpandedLabs((prev) => ({ ...prev, [id]: !prev[id] }));

  function getSubClauses() {
    const result = [];
    clauses.forEach((k) => {
      (k.sub_klausul || []).forEach((s) => {
        result.push({ kode: s.kode, judul: s.judul || "" });
      });
    });
    return result;
  }

  const handleEdit = async (standard) => {
    setEditingId(standard.id);
    setName(standard.name);
    setLabId(standard.labId);
    setStandardNumbers(
      standard.standard_numbers?.length > 0 ? standard.standard_numbers : [""],
    );
    setFormCode(standard.form_code || "");
    if (standard.template_data && Array.isArray(standard.template_data)) {
      setClauses(standard.template_data);
      setActiveTab("BUILDER");
    } else {
      setClauses([]);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setName("");
    setLabId("");
    setClauses([]);
    setJsonFile(null);
    setJsonFileName("");
    setStandardNumbers([""]);
    setFormCode("");
    setActiveTab("BUILDER");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    let finalJson = null;
    if (activeTab === "JSON") {
      if (!jsonFile) return toast.error("Please upload a JSON file");
      try {
        finalJson = JSON.parse(jsonFile);
      } catch {
        return toast.error("Invalid JSON Syntax");
      }
    } else if (activeTab === "BUILDER") {
      if (clauses.length === 0)
        return toast.error("Please add at least one clause");
      finalJson = clauses;
    } else {
      finalJson = clauses;
    }
    setIsLoading(true);
    try {
      const payload = {
        name,
        labId,
        standard_numbers: standardNumbers.filter((n) => n.trim() !== ""),
        form_code: formCode.trim() || null,
        template_data: finalJson,
      };
      if (editingId) {
        await apiClient.put(`/standards/${editingId}`, payload);
        toast.success("Standard Updated!");
        setEditingId(null);
      } else {
        await apiClient.post("/standards", payload);
        toast.success("Standard Created!");
      }
      setName("");
      setLabId("");
      setJsonFile(null);
      setJsonFileName("");
      setClauses([]);
      setStandardNumbers([""]);
      setFormCode("");
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to save");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this standard?")) return;
    try {
      await apiClient.delete(`/standards/${id}`);
      toast.success("Deleted");
      fetchData();
    } catch {
      toast.error("Cannot delete. Used in existing reports.");
    }
  };

  // ── JSON File Processing & Drag-and-Drop Handlers ────────────────────────
  const processJsonFile = (file) => {
    if (!file) return;

    if (!file.name.endsWith(".json") && file.type !== "application/json") {
      toast.error("Please upload a valid .json file");
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      setJsonFile(ev.target.result);
      setJsonFileName(file.name);
      toast.success(`Loaded file: ${file.name}`);
    };
    reader.readAsText(file);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    processJsonFile(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processJsonFile(files[0]);
    }
  };

  // ── Builder helpers ──────────────────────────────────────────────────────
  const addClause = () =>
    setClauses([
      ...clauses,
      {
        klausul: "",
        judul: "",
        meta: {
          tester_name: "",
          test_datetime: "",
          temperature: null,
          humidity: null,
        },
        sub_klausul: [],
        tables: [],
      },
    ]);
  const updateClause = (i, f, v) => {
    const n = [...clauses];
    n[i][f] = v;
    setClauses(n);
  };
  const removeClause = (i) => {
    const n = [...clauses];
    n.splice(i, 1);
    setClauses(n);
  };
  const addSubClause = (ci) => {
    const n = [...clauses];
    n[ci].sub_klausul.push({ kode: "", butir: [] });
    setClauses(n);
  };
  const updateSubClause = (ci, si, f, v) => {
    const n = [...clauses];
    n[ci].sub_klausul[si][f] = v;
    setClauses(n);
  };
  const removeSubClause = (ci, si) => {
    const n = [...clauses];
    n[ci].sub_klausul.splice(si, 1);
    setClauses(n);
  };
  const addItem = (ci, si) => {
    const n = [...clauses];
    n[ci].sub_klausul[si].butir.push({ kode: "", teks: "", keputusan: null });
    setClauses(n);
  };
  const updateItem = (ci, si, bi, f, v) => {
    const n = [...clauses];
    n[ci].sub_klausul[si].butir[bi][f] = v;
    setClauses(n);
  };
  const removeItem = (ci, si, bi) => {
    const n = [...clauses];
    n[ci].sub_klausul[si].butir.splice(bi, 1);
    setClauses(n);
  };

  const TABS = [
    { id: "BUILDER", label: "Visual Builder", Icon: FiList },
    { id: "JSON", label: "Upload JSON", Icon: FiCode },
    ...(editingId
      ? [{ id: "TABEL", label: "Template Tabel", Icon: FiColumns }]
      : []),
  ];
  const hasStandards = labs.some((l) => l.TestStandards?.length);

  return (
    <div>
      {/* Page head */}
      <div className="mb-6">
        <h1 className="text-2xl nav:text-[28px] font-semibold text-navy-800 tracking-[-0.01em]">
          Manage Standards
        </h1>
        <p className="text-sm text-ink-400 mt-1">
          Define test standards, clauses and attachment table templates
        </p>
      </div>

      <div className="grid grid-cols-1 nav:grid-cols-3 gap-5 items-start">
        {/* ── LEFT: FORM ──────────────────────────────────────────────── */}
        <section
          className={`nav:col-span-2 bg-paper border rounded-2xl shadow-card overflow-hidden ${
            editingId ? "border-navy-500" : "border-line"
          }`}
        >
          <div className="flex items-center justify-between gap-3 p-4 nav:py-5 nav:px-6 border-b border-line-soft">
            <h2 className="text-lg font-semibold text-navy-800 truncate">
              {editingId
                ? `Editing: ${name || "Standard"}`
                : "Create New Standard"}
            </h2>
            {editingId && (
              <button
                onClick={handleCancelEdit}
                className="inline-flex items-center gap-1.5 text-[13px] font-medium text-bad-fg hover:underline shrink-0"
              >
                <FiX size={14} /> Cancel Edit
              </button>
            )}
          </div>

          <div className="p-4 nav:p-6 flex flex-col gap-[18px]">
            <div>
              <label className={label}>Standard Name</label>
              <input
                className={input}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Lampu LED Swa-Balast"
              />
            </div>

            <div>
              <label className={label}>Standard Numbers (SNI / IEC)</label>
              <div className="flex flex-col gap-2">
                {standardNumbers.map((num, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input
                      className={input}
                      value={num}
                      onChange={(e) =>
                        updateStandardNumber(idx, e.target.value)
                      }
                      placeholder="e.g. SNI IEC 62560:2015"
                    />
                    {standardNumbers.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeStandardNumber(idx)}
                        className={`${iconBtn} w-11 h-11 text-bad-fg border border-line hover:bg-bad-bg`}
                      >
                        <FiTrash2 size={15} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addStandardNumber}
                className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-semibold text-navy-700 hover:text-navy-900"
              >
                <FiPlus size={13} /> Add Another Number
              </button>
            </div>

            <div>
              <label className={label}>Laboratory</label>
              <select
                className={input}
                value={labId}
                onChange={(e) => setLabId(e.target.value)}
              >
                <option value="">-- Select Lab --</option>
                {labs.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={label}>
                PO Code{" "}
                <span className="normal-case font-normal text-ink-400">
                  — nomor formulir di footer PDF datasheet
                </span>
              </label>
              <input
                className={input}
                value={formCode}
                onChange={(e) => setFormCode(e.target.value)}
                placeholder="e.g. FOR-LAB-CHY-09"
              />
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-line-soft -mb-1">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center gap-2 px-3.5 py-2.5 text-[13px] font-semibold border-b-2 -mb-px transition-colors ${
                    activeTab === tab.id
                      ? "border-navy-800 text-navy-800"
                      : "border-transparent text-ink-400 hover:text-navy-700"
                  }`}
                >
                  <tab.Icon size={14} /> {tab.label}
                </button>
              ))}
            </div>

            {/* BUILDER tab */}
            {activeTab === "BUILDER" && (
              <div className="flex flex-col gap-3 max-h-[620px] overflow-y-auto pr-1">
                {clauses.map((clause, cIdx) => (
                  <div
                    key={cIdx}
                    className="border border-line rounded-xl bg-navy-50/60 p-4"
                  >
                    <div className="flex gap-2">
                      <input
                        placeholder="No."
                        className={`${inputSm} w-16 shrink-0 text-center font-mono`}
                        value={clause.klausul}
                        onChange={(e) =>
                          updateClause(cIdx, "klausul", e.target.value)
                        }
                      />
                      <input
                        placeholder="Clause title"
                        className={`${inputSm} flex-1 font-semibold`}
                        value={clause.judul}
                        onChange={(e) =>
                          updateClause(cIdx, "judul", e.target.value)
                        }
                      />
                      <button
                        onClick={() => removeClause(cIdx)}
                        className={`${iconBtn} text-ink-400 hover:bg-bad-bg hover:text-bad-fg`}
                      >
                        <FiTrash2 size={15} />
                      </button>
                    </div>

                    <div className="mt-3 pl-4 border-l-2 border-line flex flex-col gap-2.5">
                      {clause.sub_klausul.map((sub, sIdx) => (
                        <div
                          key={sIdx}
                          className="bg-paper border border-line rounded-lg p-3"
                        >
                          <div className="flex gap-2 items-center">
                            <input
                              placeholder="Sub No."
                              className={`${inputSm} w-24 shrink-0 font-mono`}
                              value={sub.kode}
                              onChange={(e) =>
                                updateSubClause(
                                  cIdx,
                                  sIdx,
                                  "kode",
                                  e.target.value,
                                )
                              }
                            />
                            <input
                              placeholder="Sub-clause title (optional)"
                              className={`${inputSm} flex-1`}
                              value={sub.judul || ""}
                              onChange={(e) =>
                                updateSubClause(
                                  cIdx,
                                  sIdx,
                                  "judul",
                                  e.target.value,
                                )
                              }
                            />
                            <button
                              onClick={() => removeSubClause(cIdx, sIdx)}
                              className={`${iconBtn} text-ink-400 hover:bg-bad-bg hover:text-bad-fg`}
                            >
                              <FiTrash2 size={13} />
                            </button>
                          </div>

                          <div className="mt-2.5 flex flex-col gap-2">
                            {sub.butir.map((butir, bIdx) => (
                              <div
                                key={bIdx}
                                className="flex gap-2 items-start"
                              >
                                <input
                                  placeholder="a)"
                                  className={`${inputSm} w-14 shrink-0 text-center font-mono`}
                                  value={butir.kode}
                                  onChange={(e) =>
                                    updateItem(
                                      cIdx,
                                      sIdx,
                                      bIdx,
                                      "kode",
                                      e.target.value,
                                    )
                                  }
                                />
                                <textarea
                                  placeholder="Requirement text…"
                                  rows={1}
                                  className={`${inputSm} flex-1 resize-y`}
                                  value={butir.teks}
                                  onChange={(e) =>
                                    updateItem(
                                      cIdx,
                                      sIdx,
                                      bIdx,
                                      "teks",
                                      e.target.value,
                                    )
                                  }
                                />
                                <button
                                  onClick={() => removeItem(cIdx, sIdx, bIdx)}
                                  className={`${iconBtn} text-ink-400 hover:bg-bad-bg hover:text-bad-fg`}
                                >
                                  <FiTrash2 size={12} />
                                </button>
                              </div>
                            ))}
                            <button
                              onClick={() => addItem(cIdx, sIdx)}
                              className="inline-flex items-center gap-1.5 text-xs font-semibold text-navy-700 hover:text-navy-900 w-fit"
                            >
                              <FiPlus size={11} /> Add Item
                            </button>
                          </div>
                        </div>
                      ))}
                      <button
                        onClick={() => addSubClause(cIdx)}
                        className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-navy-700 hover:text-navy-900 w-fit"
                      >
                        <FiPlus size={12} /> Add Sub-Clause
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  onClick={addClause}
                  className="w-full py-3 border-2 border-dashed border-line rounded-xl text-sm font-semibold text-ink-400 hover:border-navy-500 hover:text-navy-800 hover:bg-navy-50 transition-colors flex justify-center items-center gap-2"
                >
                  <FiPlus size={16} /> Add Main Clause
                </button>
              </div>
            )}

            {/* JSON Drag and Drop tab */}
            {activeTab === "JSON" && (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${
                  isDragging
                    ? "border-navy-600 bg-navy-100/50"
                    : "border-line bg-navy-50/60 hover:border-navy-400"
                }`}
              >
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileChange}
                  className="hidden"
                  id="json-file-input"
                />
                <label
                  htmlFor="json-file-input"
                  className="cursor-pointer flex flex-col items-center justify-center gap-2"
                >
                  <FiUploadCloud size={32} className="text-navy-600" />
                  <div className="text-sm font-semibold text-navy-800">
                    Drag and drop your JSON file here, or{" "}
                    <span className="text-navy-600 underline">browse</span>
                  </div>
                  <p className="text-xs text-ink-400">
                    Upload a pre-formatted JSON clause-tree file (.json)
                  </p>
                </label>

                {jsonFileName && (
                  <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 bg-paper border border-line rounded-lg text-xs font-semibold text-navy-800">
                    <FiFileText size={14} className="text-navy-600" />
                    <span>Loaded: {jsonFileName}</span>
                  </div>
                )}
              </div>
            )}

            {/* TABEL tab */}
            {activeTab === "TABEL" && editingId && (
              <div className="min-h-[300px]">
                <TemplateBuilder
                  standardId={editingId}
                  subClauses={getSubClauses()}
                />
              </div>
            )}

            {/* Save */}
            {activeTab !== "TABEL" && (
              <div className="pt-4 border-t border-line-soft">
                <button
                  onClick={handleSubmit}
                  disabled={isLoading || !name || !labId}
                  className={`${btnPrimary} w-full`}
                >
                  <FiSave size={16} />
                  {isLoading
                    ? "Saving…"
                    : editingId
                      ? "Update Standard"
                      : "Create Standard"}
                </button>
              </div>
            )}
          </div>
        </section>

        {/* ── RIGHT: STANDARDS LIST ───────────────────────────────────── */}
        <section className="bg-paper border border-line rounded-2xl shadow-card overflow-hidden">
          <div className="p-4 nav:py-5 nav:px-6 border-b border-line-soft">
            <h2 className="text-lg font-semibold text-navy-800">
              Existing Standards
            </h2>
          </div>
          <div className="p-3 flex flex-col gap-2">
            {labs.map((lab) => {
              if (!lab.TestStandards?.length) return null;
              const isExpanded = expandedLabs[lab.id];
              return (
                <div
                  key={lab.id}
                  className="border border-line rounded-xl overflow-hidden"
                >
                  <button
                    onClick={() => toggleLab(lab.id)}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2.5 bg-navy-50 hover:bg-navy-100 transition-colors"
                  >
                    <span className="flex items-center gap-2 font-medium text-sm text-navy-800 min-w-0">
                      <FiFolder size={15} className="text-navy-600 shrink-0" />
                      <span className="truncate">{lab.name}</span>
                    </span>
                    <span className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] font-semibold bg-white border border-line px-1.5 py-0.5 rounded-full text-ink-500">
                        {lab.TestStandards.length}
                      </span>
                      {isExpanded ? (
                        <FiChevronDown size={14} className="text-ink-400" />
                      ) : (
                        <FiChevronRight size={14} className="text-ink-400" />
                      )}
                    </span>
                  </button>
                  {isExpanded && (
                    <div className="divide-y divide-line-soft">
                      {lab.TestStandards.map((s) => (
                        <div
                          key={s.id}
                          className={`group flex justify-between items-start gap-2 p-3 transition-colors ${
                            editingId === s.id
                              ? "bg-navy-50"
                              : "hover:bg-navy-50"
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="font-medium text-sm text-navy-800 truncate">
                              {s.name}
                            </div>
                            {s.standard_numbers?.length > 0 && (
                              <div className="text-xs text-ink-400 mt-0.5">
                                {s.standard_numbers.join(", ")}
                              </div>
                            )}
                            <div className="text-[11px] text-ink-300 mt-0.5">
                              Edited:{" "}
                              {new Date(s.updatedAt).toLocaleDateString(
                                "id-ID",
                              )}
                            </div>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <button
                              onClick={() => handleEdit(s)}
                              title="Edit"
                              className={`${iconBtn} text-navy-700 hover:bg-navy-100`}
                            >
                              <FiEdit3 size={15} />
                            </button>
                            <button
                              onClick={() => handleDelete(s.id)}
                              title="Delete"
                              className={`${iconBtn} text-ink-400 hover:bg-bad-bg hover:text-bad-fg`}
                            >
                              <FiTrash2 size={15} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {!hasStandards && (
              <p className="text-sm text-ink-400 text-center py-8">
                No standards found yet.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
