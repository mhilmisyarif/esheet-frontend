// src/pages/CreateReport.jsx
import { useState, useEffect, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import toast from "react-hot-toast";
import {
  FiArrowLeft,
  FiChevronLeft,
  FiChevronRight,
  FiCheck,
  FiCheckCircle,
  FiAlertCircle,
} from "react-icons/fi";
import apiClient from "../api";

const inputBase =
  "w-full px-3.5 py-2.5 border rounded-lg text-sm bg-paper outline-none transition-colors focus:ring-[3px]";
const inputState = (error) =>
  error
    ? "border-bad-fg focus:border-bad-fg focus:ring-bad-fg/10"
    : "border-line focus:border-navy-600 focus:ring-navy-600/[0.12]";

function TextField({
  label,
  value,
  onChange,
  placeholder,
  error,
  hint,
  optional,
  multiline,
}) {
  const cls = `${inputBase} text-navy-800 ${inputState(error)}`;
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[13px] font-medium text-navy-800">
        {label}
        {optional && (
          <span className="font-normal text-ink-400"> · optional</span>
        )}
      </label>
      {multiline ? (
        <textarea
          rows={2}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`${cls} resize-y min-h-[72px]`}
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cls}
        />
      )}
      {error ? (
        <span className="text-xs text-bad-fg">{error}</span>
      ) : hint ? (
        <span className="text-xs text-ink-400">{hint}</span>
      ) : null}
    </div>
  );
}

function SelectField({ label, value, onChange, children, disabled, hint }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[13px] font-medium text-navy-800">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`${inputBase} ${inputState(false)} ${
          disabled
            ? "text-ink-400 bg-navy-50 cursor-not-allowed"
            : "text-navy-800"
        }`}
      >
        {children}
      </select>
      {hint && <span className="text-xs text-ink-400">{hint}</span>}
    </div>
  );
}

const btnPrimary =
  "inline-flex items-center justify-center gap-2 h-11 px-[18px] rounded-xl text-sm font-semibold bg-navy-800 text-white hover:bg-navy-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors";
const btnGhost =
  "inline-flex items-center justify-center gap-2 h-11 px-[18px] rounded-xl text-sm font-semibold bg-paper text-navy-800 border border-line hover:bg-navy-50 transition-colors";

export default function CreateReport() {
  const navigate = useNavigate();
  const [labs, setLabs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState(1);

  // Form state
  const [orderNo, setOrderNo] = useState("");
  const [applicant, setApplicant] = useState("");
  const [applicantAddress, setApplicantAddress] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [factory, setFactory] = useState("");
  const [factoryAddress, setFactoryAddress] = useState("");
  const [countryOrigin, setCountryOrigin] = useState("");
  const [iwoNo, setIwoNo] = useState("");
  const [selectedStandardId, setSelectedStandardId] = useState("");
  const [testingType, setTestingType] = useState("FULL");
  const [selectedClauses, setSelectedClauses] = useState([]);
  const [errors, setErrors] = useState({});

  // Derived state
  const [detectedLab, setDetectedLab] = useState(null);
  const [availableStandards, setAvailableStandards] = useState([]);

  useEffect(() => {
    apiClient
      .get("/labs")
      .then((res) => setLabs(res.data))
      .catch(() => toast.error("Gagal memuat data lab"));
  }, []);

  // Auto-detect lab from the order number
  useEffect(() => {
    const match = orderNo.match(/20-104-(\d{2})/);
    const foundLab =
      match && match[1]
        ? labs.find((lab) => lab.lab_code === match[1])
        : null;
    setDetectedLab(foundLab || null);
    setAvailableStandards(foundLab ? foundLab.TestStandards : []);
    setSelectedStandardId("");
    setSelectedClauses([]);
  }, [orderNo, labs]);

  const selectedStandard = useMemo(
    () =>
      availableStandards.find(
        (s) => s.id === parseInt(selectedStandardId, 10)
      ) || null,
    [availableStandards, selectedStandardId]
  );

  const toggleClause = (klausul) => {
    setSelectedClauses((prev) =>
      prev.includes(klausul)
        ? prev.filter((c) => c !== klausul)
        : [...prev, klausul]
    );
  };

  const canContinue = Boolean(detectedLab) && Boolean(selectedStandardId);

  const handleSubmit = async () => {
    const e = {};
    if (!applicant.trim()) e.applicant = "Applicant is required.";
    if (!applicantAddress.trim()) e.applicantAddress = "Address is required.";
    if (!brand.trim()) e.brand = "Brand is required.";
    if (!model.trim()) e.model = "Model is required.";
    if (!factory.trim()) e.factory = "Factory is required.";
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    setIsLoading(true);
    try {
      const payload = {
        order_no: orderNo,
        applicant,
        applicant_address: applicantAddress,
        testStandardId: parseInt(selectedStandardId, 10),
        testingType,
        factory,
        brand,
        model,
        factory_address: factoryAddress,
        country_origin: countryOrigin,
        iwo_no: iwoNo,
        selectedClauses: testingType === "VERIFICATION" ? selectedClauses : [],
      };
      const response = await apiClient.post(
        "/workflow/create-report",
        payload
      );
      toast.success("Worksheet berhasil dibuat!");
      navigate(`/reports/${response.data.sampleId}`);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Gagal membuat worksheet");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-[760px] mx-auto">
      {/* Page head */}
      <Link
        to="/technician-dashboard"
        className="inline-flex items-center gap-1.5 text-[13px] text-ink-500 hover:text-navy-800 mb-3 transition-colors"
      >
        <FiArrowLeft size={14} /> Back to dashboard
      </Link>
      <h1 className="text-2xl nav:text-[28px] font-semibold text-navy-800 tracking-[-0.01em]">
        New Datasheet
      </h1>
      <p className="text-sm text-ink-400 mt-1 mb-6">
        Register a new lab test worksheet
      </p>

      {/* Panel */}
      <section className="bg-paper border border-line rounded-2xl shadow-card overflow-hidden">
        <div className="px-5 py-4 nav:px-6 nav:py-5 border-b border-line-soft">
          <h2 className="text-lg font-semibold text-navy-800">
            {step === 1 ? "Order & test standard" : "Sample details"}
          </h2>
          <p className="text-[13px] text-ink-400 mt-0.5">
            {step === 1
              ? "Enter the order number, then pick the test standard."
              : "Describe the sample and its manufacturer."}
          </p>
        </div>

        {/* Body */}
        <div className="p-5 nav:p-6 flex flex-col gap-[18px]">
          {step === 1 ? (
            <>
              <div className="flex flex-col gap-1.5">
                <TextField
                  label="Order Number"
                  value={orderNo}
                  onChange={setOrderNo}
                  placeholder="CBT/3801/20-104-XX/…"
                />
                {orderNo.trim() &&
                  (detectedLab ? (
                    <div className="flex items-center gap-2 text-[13px] text-ok-fg">
                      <FiCheckCircle size={15} />
                      Lab detected: <strong>{detectedLab.name}</strong>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-[13px] text-warn-fg">
                      <FiAlertCircle size={15} />
                      No lab matched — check the order number format.
                    </div>
                  ))}
              </div>

              <SelectField
                label="Test Standard / Sample Name"
                value={selectedStandardId}
                onChange={(v) => {
                  setSelectedStandardId(v);
                  setSelectedClauses([]);
                }}
                disabled={!detectedLab}
                hint={
                  !detectedLab
                    ? "Enter a valid order number first."
                    : !selectedStandardId
                    ? "Pick a standard to continue."
                    : undefined
                }
              >
                <option value="">
                  {detectedLab
                    ? "Select a standard…"
                    : "Awaiting order number…"}
                </option>
                {availableStandards.map((std) => (
                  <option key={std.id} value={std.id}>
                    {std.name}
                  </option>
                ))}
              </SelectField>

              <SelectField
                label="Testing Type"
                value={testingType}
                onChange={(v) => {
                  setTestingType(v);
                  setSelectedClauses([]);
                }}
              >
                <option value="FULL">Full test</option>
                <option value="VERIFICATION">Verification</option>
              </SelectField>

              {testingType === "VERIFICATION" && selectedStandard && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[13px] font-medium text-navy-800">
                    Clauses to verify
                  </label>
                  <div className="bg-navy-50 border border-navy-200 rounded-xl p-4 flex flex-col gap-1 max-h-[260px] overflow-y-auto">
                    {(selectedStandard.template_data || []).map((k) => (
                      <label
                        key={k.klausul}
                        className="flex items-center gap-3 py-1.5 cursor-pointer text-sm text-navy-800"
                      >
                        <input
                          type="checkbox"
                          className="w-4 h-4 accent-navy-700"
                          checked={selectedClauses.includes(k.klausul)}
                          onChange={() => toggleClause(k.klausul)}
                        />
                        <span>
                          {k.klausul} — {k.judul}
                        </span>
                      </label>
                    ))}
                  </div>
                  <span className="text-xs text-ink-400">
                    {selectedClauses.length} selected
                  </span>
                </div>
              )}
            </>
          ) : (
            <>
              <TextField
                label="Applicant"
                value={applicant}
                onChange={setApplicant}
                placeholder="e.g. PT. Ganda Jaya Abadi"
                error={errors.applicant}
              />
              <TextField
                label="Applicant Address"
                value={applicantAddress}
                onChange={setApplicantAddress}
                placeholder="Street, city, province"
                error={errors.applicantAddress}
                multiline
              />
              <div className="grid grid-cols-1 nav:grid-cols-2 gap-[18px]">
                <TextField
                  label="Brand"
                  value={brand}
                  onChange={setBrand}
                  placeholder="e.g. Philips"
                  error={errors.brand}
                />
                <TextField
                  label="Model / Type"
                  value={model}
                  onChange={setModel}
                  placeholder="e.g. LED-9W-E27"
                  error={errors.model}
                />
              </div>
              <TextField
                label="Factory"
                value={factory}
                onChange={setFactory}
                placeholder="Manufacturer name"
                error={errors.factory}
              />
              <TextField
                label="Factory Address"
                value={factoryAddress}
                onChange={setFactoryAddress}
                placeholder="Manufacturer address"
                optional
                multiline
              />
              <div className="grid grid-cols-1 nav:grid-cols-2 gap-[18px]">
                <TextField
                  label="Country of Origin"
                  value={countryOrigin}
                  onChange={setCountryOrigin}
                  placeholder="e.g. Indonesia"
                  optional
                />
                <TextField
                  label="IWO No."
                  value={iwoNo}
                  onChange={setIwoNo}
                  placeholder="Internal work order"
                  optional
                />
              </div>

              <div className="bg-navy-50 border border-navy-200 rounded-xl p-4 text-[13px] text-navy-800">
                <strong className="block mb-1 font-semibold">
                  Ready to create
                </strong>
                {selectedStandard ? selectedStandard.name : "—"} ·{" "}
                {testingType === "FULL" ? "Full test" : "Verification"}
                {testingType === "VERIFICATION" &&
                  ` (${selectedClauses.length} clauses)`}{" "}
                · order {orderNo}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 nav:px-6 border-t border-line-soft bg-navy-50">
          <div className="flex items-center gap-2 text-[13px] text-ink-400">
            <span
              className={`w-2 h-2 rounded-full ${
                step >= 1 ? "bg-navy-800" : "bg-ink-300"
              }`}
            />
            <span
              className={`w-2 h-2 rounded-full ${
                step >= 2 ? "bg-navy-800" : "bg-ink-300"
              }`}
            />
            <span className="ml-1">Step {step} of 2</span>
          </div>
          <div className="flex items-center gap-2">
            {step === 1 ? (
              <>
                <button
                  className={btnGhost}
                  onClick={() => navigate("/technician-dashboard")}
                >
                  Cancel
                </button>
                <button
                  className={btnPrimary}
                  disabled={!canContinue}
                  onClick={() => {
                    setErrors({});
                    setStep(2);
                  }}
                >
                  Continue <FiChevronRight size={16} />
                </button>
              </>
            ) : (
              <>
                <button className={btnGhost} onClick={() => setStep(1)}>
                  <FiChevronLeft size={16} /> Back
                </button>
                <button
                  className={btnPrimary}
                  disabled={isLoading}
                  onClick={handleSubmit}
                >
                  <FiCheck size={16} />
                  {isLoading ? "Creating…" : "Create datasheet"}
                </button>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
