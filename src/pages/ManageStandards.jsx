// src/pages/ManageStandards.jsx
// Changes from previous version:
// - Added a third tab "TABEL LAMPIRAN" per standard
// - When editing a standard, engineers can click the new tab to open TemplateBuilder
// - TemplateBuilder receives the standardId and the flat list of sub-clauses

import React, { useEffect, useState } from "react";
import apiClient from "../api";
import toast from "react-hot-toast";
import {
  FaPlus,
  FaTrash,
  FaFileCode,
  FaList,
  FaSave,
  FaEdit,
  FaTimes,
  FaFolder,
  FaFolderOpen,
  FaChevronDown,
  FaChevronRight,
  FaTable,
} from "react-icons/fa";
import TemplateBuilder from "../components/TemplateBuilder";

export default function ManageStandards() {
  const [labs, setLabs] = useState([]);
  const [activeTab, setActiveTab] = useState("BUILDER");
  const [isLoading, setIsLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState("");
  const [standardNumbers, setStandardNumbers] = useState([""]);
  const [labId, setLabId] = useState("");
  const [jsonFile, setJsonFile] = useState(null);
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

  // Build flat sub-clause list from current clauses tree (used by TemplateBuilder)
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
    setStandardNumbers([""]);
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
      // TABEL tab — save the standard as-is (clauses unchanged)
      finalJson = clauses;
    }
    setIsLoading(true);
    try {
      const payload = {
        name,
        labId,
        standard_numbers: standardNumbers.filter((n) => n.trim() !== ""),
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
      setClauses([]);
      setStandardNumbers([""]);
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

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setJsonFile(ev.target.result);
      reader.readAsText(file);
    }
  };

  // Builder helpers (unchanged from original)
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

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Manage Test Standards</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* LEFT: FORM */}
        <div className="lg:col-span-2 space-y-6">
          <div
            className={`bg-white p-6 rounded shadow border ${editingId ? "border-sky-500 ring-2 ring-sky-100" : ""}`}
          >
            <div className="flex justify-between items-center mb-4 border-b pb-2">
              <h2 className="text-lg font-semibold">
                {editingId ? `Editing: ${name}` : "Create New Standard"}
              </h2>
              {editingId && (
                <button
                  onClick={handleCancelEdit}
                  className="text-sm text-red-500 flex items-center gap-1 hover:underline"
                >
                  <FaTimes /> Cancel Edit
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Standard Name
                </label>
                <input
                  className="w-full border rounded px-3 py-2 mt-1"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Lampu LED Swa-Balast"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Standard Numbers (SNI/IEC)
                </label>
                {standardNumbers.map((num, idx) => (
                  <div key={idx} className="flex gap-2 mb-2">
                    <input
                      className="w-full border rounded px-3 py-2"
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
                        className="text-red-500 border border-red-200 px-3 rounded hover:bg-red-50"
                      >
                        <FaTrash />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addStandardNumber}
                  className="text-sm text-sky-600 font-medium flex items-center gap-1 hover:underline"
                >
                  <FaPlus size={10} /> Add Another Number
                </button>
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700">
                  Laboratory
                </label>
                <select
                  className="w-full border rounded px-3 py-2 mt-1"
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
            </div>

            {/* TABS */}
            <div className="flex gap-2 mb-4 border-b">
              {[
                { id: "BUILDER", label: "Visual Builder", icon: FaList },
                { id: "JSON", label: "Upload JSON", icon: FaFileCode },
                ...(editingId
                  ? [{ id: "TABEL", label: "Template Tabel", icon: FaTable }]
                  : []),
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 text-sm font-medium flex items-center gap-2 ${
                    activeTab === tab.id
                      ? "border-b-2 border-blue-600 text-blue-600"
                      : "text-gray-500"
                  }`}
                >
                  <tab.icon size={12} /> {tab.label}
                </button>
              ))}
            </div>

            {/* BUILDER tab */}
            {activeTab === "BUILDER" && (
              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                {clauses.map((clause, cIdx) => (
                  <div key={cIdx} className="border rounded p-4 bg-gray-50">
                    <div className="flex gap-2 mb-2">
                      <input
                        placeholder="No."
                        className="w-16 border px-2 py-1 rounded"
                        value={clause.klausul}
                        onChange={(e) =>
                          updateClause(cIdx, "klausul", e.target.value)
                        }
                      />
                      <input
                        placeholder="Clause Title"
                        className="flex-1 border px-2 py-1 rounded font-bold"
                        value={clause.judul}
                        onChange={(e) =>
                          updateClause(cIdx, "judul", e.target.value)
                        }
                      />
                      <button
                        onClick={() => removeClause(cIdx)}
                        className="text-red-500 p-2"
                      >
                        <FaTrash />
                      </button>
                    </div>
                    <div className="pl-6 space-y-3 border-l-2 border-gray-200 ml-2">
                      {clause.sub_klausul.map((sub, sIdx) => (
                        <div key={sIdx} className="bg-white p-3 rounded border">
                          <div className="flex gap-2 mb-2">
                            <input
                              placeholder="Sub No."
                              className="w-20 border px-2 py-1 rounded text-sm"
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
                            <div className="flex-1" />
                            <button
                              onClick={() => removeSubClause(cIdx, sIdx)}
                              className="text-red-400 text-xs"
                            >
                              <FaTrash />
                            </button>
                          </div>
                          <div className="space-y-2">
                            {sub.butir.map((butir, bIdx) => (
                              <div
                                key={bIdx}
                                className="flex gap-2 items-start"
                              >
                                <input
                                  placeholder="a)"
                                  className="w-10 border px-1 py-1 rounded text-xs"
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
                                  placeholder="Requirement..."
                                  className="flex-1 border px-2 py-1 rounded text-sm"
                                  rows={1}
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
                                  className="text-gray-400 hover:text-red-500"
                                >
                                  <FaTrash size={10} />
                                </button>
                              </div>
                            ))}
                            <button
                              onClick={() => addItem(cIdx, sIdx)}
                              className="text-xs text-sky-600 font-medium flex items-center gap-1 mt-1"
                            >
                              <FaPlus size={10} /> Add Item
                            </button>
                          </div>
                        </div>
                      ))}
                      <button
                        onClick={() => addSubClause(cIdx)}
                        className="text-sm text-blue-600 font-medium flex items-center gap-1"
                      >
                        <FaPlus size={12} /> Add Sub-Clause
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  onClick={addClause}
                  className="w-full py-2 border-2 border-dashed border-gray-300 rounded text-gray-500 hover:border-blue-500 hover:text-blue-500 flex justify-center items-center gap-2"
                >
                  <FaPlus /> Add Main Clause
                </button>
              </div>
            )}

            {/* JSON tab */}
            {activeTab === "JSON" && (
              <div className="p-4 bg-gray-50 rounded border border-dashed border-gray-300">
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileChange}
                  className="w-full"
                />
                <p className="text-xs text-gray-500 mt-2">
                  Upload a pre-formatted JSON file structure.
                </p>
              </div>
            )}

            {/* TABEL tab — TemplateBuilder */}
            {activeTab === "TABEL" && editingId && (
              <div className="min-h-[300px]">
                <TemplateBuilder
                  standardId={editingId}
                  subClauses={getSubClauses()}
                />
              </div>
            )}

            {/* Save button (not shown on TABEL tab — templates save themselves) */}
            {activeTab !== "TABEL" && (
              <div className="pt-4 border-t mt-4">
                <button
                  onClick={handleSubmit}
                  disabled={isLoading || !name || !labId}
                  className={`w-full text-white py-3 rounded flex justify-center items-center gap-2 font-semibold shadow ${
                    editingId
                      ? "bg-sky-600 hover:bg-sky-700"
                      : "bg-emerald-600 hover:bg-emerald-700"
                  }`}
                >
                  {isLoading ? (
                    "Saving..."
                  ) : editingId ? (
                    <>
                      <FaSave /> Update Standard
                    </>
                  ) : (
                    <>
                      <FaSave /> Create Standard
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: LIST */}
        <div className="bg-white p-6 rounded shadow border h-fit">
          <h2 className="text-lg font-semibold mb-4">Existing Standards</h2>
          <div className="space-y-4">
            {labs.map((lab) => {
              if (!lab.TestStandards?.length) return null;
              const isExpanded = expandedLabs[lab.id];
              return (
                <div key={lab.id} className="border rounded overflow-hidden">
                  <button
                    onClick={() => toggleLab(lab.id)}
                    className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition"
                  >
                    <div className="flex items-center gap-2 font-medium text-gray-800">
                      {isExpanded ? (
                        <FaFolderOpen className="text-yellow-500" />
                      ) : (
                        <FaFolder className="text-yellow-500" />
                      )}
                      {lab.name}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-gray-200 px-2 py-0.5 rounded-full text-gray-600">
                        {lab.TestStandards.length}
                      </span>
                      {isExpanded ? (
                        <FaChevronDown size={12} className="text-gray-400" />
                      ) : (
                        <FaChevronRight size={12} className="text-gray-400" />
                      )}
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="bg-white divide-y">
                      {lab.TestStandards.map((s) => (
                        <div
                          key={s.id}
                          className={`p-3 pl-8 flex justify-between items-start group hover:bg-sky-50 transition ${
                            editingId === s.id
                              ? "bg-sky-50 border-l-4 border-l-sky-500"
                              : ""
                          }`}
                        >
                          <div className="flex-1">
                            <div className="font-medium text-gray-800 text-sm">
                              {s.name}
                            </div>
                            {s.standard_numbers?.length > 0 && (
                              <div className="text-xs text-gray-500 mt-1">
                                {s.standard_numbers.join(", ")}
                              </div>
                            )}
                            <div className="text-[10px] text-gray-400 mt-1">
                              Edited:{" "}
                              {new Date(s.updatedAt).toLocaleDateString()}
                            </div>
                          </div>
                          <div className="flex gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleEdit(s)}
                              title="Edit"
                              className="text-sky-600 hover:bg-sky-100 p-1.5 rounded border border-sky-200"
                            >
                              <FaEdit size={14} />
                            </button>
                            <button
                              onClick={() => handleDelete(s.id)}
                              title="Delete"
                              className="text-red-500 hover:bg-red-100 p-1.5 rounded border border-red-200"
                            >
                              <FaTrash size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {labs.every((l) => !l.TestStandards?.length) && (
              <p className="text-gray-500 italic text-center py-4">
                No standards found.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
