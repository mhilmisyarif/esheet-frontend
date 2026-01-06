// src/pages/CreateReport.jsx
import React, { useState, useEffect } from "react";
import apiClient from "../api";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

export default function CreateReport() {
  const navigate = useNavigate();
  const [labs, setLabs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Form state
  const [orderNo, setOrderNo] = useState("");
  const [applicant, setApplicant] = useState("PT MEGA CAKRA NUSANTARA"); // Default
  const [iwoNo, setIwoNo] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [selectedStandardId, setSelectedStandardId] = useState("");
  const [testingType, setTestingType] = useState("FULL");
  const [selectedClauses, setSelectedClauses] = useState([]);

  // Derived state
  const [detectedLab, setDetectedLab] = useState(null);
  const [availableStandards, setAvailableStandards] = useState([]);

  // Fetch all labs and standards on mount
  useEffect(() => {
    apiClient
      .get("/labs")
      .then((res) => setLabs(res.data))
      .catch((err) => toast.error("Gagal memuat data lab"));
  }, []);

  // Auto-detect lab from Order Number (Q2)
  useEffect(() => {
    const match = orderNo.match(/20-104-(\d{2})/);
    if (match && match[1]) {
      const labCode = match[1];
      const foundLab = labs.find((lab) => lab.lab_code === labCode);
      setDetectedLab(foundLab);
      setAvailableStandards(foundLab ? foundLab.TestStandards : []);
      setSelectedStandardId(""); // Reset standard selection
    } else {
      setDetectedLab(null);
      setAvailableStandards([]);
    }
  }, [orderNo, labs]);

  // Handle clause selection for Verification testing
  const handleClauseToggle = (clauseNumber) => {
    setSelectedClauses((prev) =>
      prev.includes(clauseNumber)
        ? prev.filter((c) => c !== clauseNumber)
        : [...prev, clauseNumber]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedStandardId) {
      toast.error("Silakan pilih Standar Uji / Nama Contoh");
      return;
    }

    setIsLoading(true);
    try {
      const payload = {
        order_no: orderNo,
        applicant: applicant,
        iwo_no: iwoNo,
        testStandardId: parseInt(selectedStandardId, 10),
        brand: brand,
        model: model,
        testingType: testingType,
        selectedClauses: testingType === "VERIFICATION" ? selectedClauses : [],
        technicianId: 1, // Hard-coded for now. We'll fix this with auth.
      };

      // Call our new "workflow" endpoint
      const response = await apiClient.post("/workflow/create-report", payload);

      // The response will be the new Report object
      const newReport = response.data;
      toast.success("Worksheet berhasil dibuat!");

      // Navigate directly to the editor for the new report
      // Note: We use the sampleId for the URL
      navigate(`/reports/${newReport.sampleId}`);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Gagal membuat worksheet");
    } finally {
      setIsLoading(false);
    }
  };

  const selectedStandard = availableStandards.find(
    (s) => s.id === parseInt(selectedStandardId, 10)
  );

  return (
    <div className="max-w-2xl mx-auto bg-white p-6 rounded shadow">
      <h1 className="text-2xl font-semibold mb-6">Buat Worksheet Baru</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            1. Masukkan Nomor Order
          </label>
          <input
            type="text"
            value={orderNo}
            onChange={(e) => setOrderNo(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-sky-500 focus:border-sky-500"
            placeholder="CBT/3801/20-104-XX/..."
            required
          />
          {detectedLab && (
            <p className="mt-2 text-sm text-emerald-600">
              Lab terdeteksi: {detectedLab.name}
            </p>
          )}
        </div>

        {detectedLab && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                2. Pilih Standar Uji / Nama Contoh
              </label>
              <select
                value={selectedStandardId}
                onChange={(e) => setSelectedStandardId(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-sky-500 focus:border-sky-500"
                required
              >
                <option value="">-- Pilih Standar --</option>
                {availableStandards.map((std) => (
                  <option key={std.id} value={std.id}>
                    {std.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                3. Pilih Jenis Pengujian
              </label>
              <select
                value={testingType}
                onChange={(e) => setTestingType(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-sky-500 focus:border-sky-500"
              >
                <option value="FULL">Penuh (Full)</option>
                <option value="VERIFICATION">Verifikasi (Verification)</option>
              </select>
            </div>

            {testingType === "VERIFICATION" && selectedStandard && (
              <div className="p-4 border rounded-md bg-gray-50">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Pilih Klausul untuk Verifikasi
                </label>
                <div className="space-y-2">
                  {selectedStandard.template_data.map((klausul) => (
                    <label key={klausul.klausul} className="flex items-center">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300 text-sky-600 focus:ring-sky-500"
                        checked={selectedClauses.includes(klausul.klausul)}
                        onChange={() => handleClauseToggle(klausul.klausul)}
                      />
                      <span className="ml-3 text-sm text-gray-700">
                        {klausul.klausul} - {klausul.judul}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <h2 className="text-lg font-medium border-t pt-4 mt-4">
              4. Detail Sampel
            </h2>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Pemohon
              </label>
              <input
                type="text"
                value={applicant}
                onChange={(e) => setApplicant(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Nomor IWO (Opsional)
              </label>
              <input
                type="text"
                value={iwoNo}
                onChange={(e) => setIwoNo(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Merek
              </label>
              <input
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Tipe / Model
              </label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                required
              />
            </div>
          </>
        )}

        <div className="pt-4 text-right">
          <button
            type="submit"
            className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 disabled:opacity-50"
            disabled={isLoading || !detectedLab || !selectedStandardId}
          >
            {isLoading ? "Membuat..." : "Buat Worksheet & Mulai Uji"}
          </button>
        </div>
      </form>
    </div>
  );
}
