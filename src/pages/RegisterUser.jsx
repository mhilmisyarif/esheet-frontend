// src/pages/RegisterUser.jsx
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import toast from "react-hot-toast";
import { FiArrowLeft, FiCheck, FiUserPlus } from "react-icons/fi";
import apiClient from "../api"; // Reusing your configured Axios client

// 1. Reusing your exact input base styles for consistency
const inputBase =
  "w-full px-3.5 py-2.5 border rounded-lg text-sm bg-paper outline-none transition-colors focus:ring-[3px]";
const inputState = (error) =>
  error
    ? "border-bad-fg focus:border-bad-fg focus:ring-bad-fg/10"
    : "border-line focus:border-navy-600 focus:ring-navy-600/[0.12]";

// 2. Reusing your highly effective TextField component
function TextField({
  label,
  value,
  onChange,
  placeholder,
  error,
  hint,
  type = "text",
}) {
  const cls = `${inputBase} text-navy-800 ${inputState(error)}`;
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[13px] font-medium text-navy-800">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cls}
      />
      {error ? (
        <span className="text-xs text-bad-fg">{error}</span>
      ) : hint ? (
        <span className="text-xs text-ink-400">{hint}</span>
      ) : null}
    </div>
  );
}

// 3. Reusing your SelectField component
function SelectField({ label, value, onChange, children, hint }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[13px] font-medium text-navy-800">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputBase} ${inputState(false)} text-navy-800`}
      >
        {children}
      </select>
      {hint && <span className="text-xs text-ink-400">{hint}</span>}
    </div>
  );
}

// 4. Reusing your button styles
const btnPrimary =
  "inline-flex items-center justify-center gap-2 h-11 px-[18px] rounded-xl text-sm font-semibold bg-navy-800 text-white hover:bg-navy-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors";
const btnGhost =
  "inline-flex items-center justify-center gap-2 h-11 px-[18px] rounded-xl text-sm font-semibold bg-paper text-navy-800 border border-line hover:bg-navy-50 transition-colors";

export default function RegisterUser() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  // Form state mapped to the required backend fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("TECHNICIAN");
  const [errors, setErrors] = useState({});

  // Form submission handler
  const handleSubmit = async () => {
    // Basic client-side validation to match your backend rules
    const e = {};
    if (!name.trim()) e.name = "Name is required.";
    if (!email.trim()) e.email = "Email is required.";
    if (!password) {
      e.password = "Password is required.";
    } else if (password.length < 8) {
      e.password = "Password must be at least 8 characters.";
    }

    setErrors(e);
    if (Object.keys(e).length > 0) return;

    setIsLoading(true);
    try {
      // Sending data to the backend route
      // Note: Adjust the URL path if your routes are mounted differently (e.g. '/api/auth/register')
      await apiClient.post("/auth/register-user", {
        name,
        email,
        password,
        role,
      });

      toast.success("User registered successfully!");

      // Optionally redirect back to an admin dashboard or user list
      navigate("/admin-dashboard");
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to register user");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-[500px] mx-auto">
      {/* Page head using your exact layout */}
      <Link
        to="/admin-dashboard"
        className="inline-flex items-center gap-1.5 text-[13px] text-ink-500 hover:text-navy-800 mb-3 transition-colors"
      >
        <FiArrowLeft size={14} /> Back to dashboard
      </Link>
      <h1 className="text-2xl nav:text-[28px] font-semibold text-navy-800 tracking-[-0.01em]">
        Register New User
      </h1>
      <p className="text-sm text-ink-400 mt-1 mb-6">
        Create a new lab system account. Internal use only.
      </p>

      {/* Panel */}
      <section className="bg-paper border border-line rounded-2xl shadow-card overflow-hidden">
        <div className="px-5 py-4 nav:px-6 nav:py-5 border-b border-line-soft">
          <h2 className="text-lg font-semibold text-navy-800 flex items-center gap-2">
            <FiUserPlus className="text-navy-600" /> Account Details
          </h2>
        </div>

        {/* Body */}
        <div className="p-5 nav:p-6 flex flex-col gap-[18px]">
          <TextField
            label="Full Name"
            value={name}
            onChange={setName}
            placeholder="e.g. Jane Doe"
            error={errors.name}
          />

          <TextField
            label="Email Address"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="e.g. jane@labsystem.com"
            error={errors.email}
          />

          <TextField
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            placeholder="Minimum 8 characters"
            error={errors.password}
            hint="Temporary password for the new user."
          />

          {/* Role select strictly follows the allowed backend ENUMs */}
          <SelectField
            label="System Role"
            value={role}
            onChange={setRole}
            hint="Defines the user's access level in the lab system."
          >
            <option value="TECHNICIAN">Technician</option>
            <option value="ENGINEER">Engineer</option>
            <option value="DRAFTER">Drafter</option>
            <option value="ADMIN">Admin</option>
          </SelectField>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-5 py-4 nav:px-6 border-t border-line-soft bg-navy-50">
          <div className="flex items-center gap-2">
            <button
              className={btnGhost}
              onClick={() => navigate("/admin-dashboard")}
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              className={btnPrimary}
              disabled={isLoading}
              onClick={handleSubmit}
            >
              <FiCheck size={16} />
              {isLoading ? "Registering..." : "Register User"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
