// src/pages/LoginPage.jsx
import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, Navigate } from "react-router-dom";
import { FiEye, FiEyeOff } from "react-icons/fi";
import logoUrl from "../assets/logo.png";

const inputCls =
  "w-full px-3.5 py-2.5 border border-line rounded-lg text-sm text-navy-800 bg-paper outline-none transition-colors focus:border-navy-600 focus:ring-[3px] focus:ring-navy-600/[0.12] placeholder:text-ink-400";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { login, user } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    const success = await login(email, password);
    setIsLoading(false);
    if (success) navigate("/");
  };

  // Already logged in → straight to the dashboard.
  if (user) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-navy-900 flex items-center justify-center p-6">
      <div className="w-full max-w-[420px]">
        <div className="bg-paper rounded-3xl shadow-modal overflow-hidden p-8">
          {/* Brand & Subtitle */}
          <div className="flex flex-col items-center text-center mb-6">
            <img
              src={logoUrl}
              alt="Logo Sucofindo"
              className="w-[120px] h-auto object-contain"
            />
            <h1 className="font-mono font-bold text-[22px] tracking-[-0.02em] text-navy-900 mt-3">
              E-Datasheet System
            </h1>
            <p className="text-[13px] text-ink-400 mt-1">
              Masukkan kredensial Anda untuk mengakses portal
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-[18px]">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="email"
                className="text-[13px] font-medium text-navy-800"
              >
                Alamat Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="nama@sucofindo.co.id"
                className={inputCls}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="password"
                className="text-[13px] font-medium text-navy-800"
              >
                Kata Sandi
              </label>
              <div className="relative flex items-center">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Masukkan kata sandi"
                  className={`${inputCls} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 text-ink-400 hover:text-navy-700 transition-colors focus:outline-none cursor-pointer flex items-center justify-center"
                  aria-label={
                    showPassword
                      ? "Sembunyikan kata sandi"
                      : "Tampilkan kata sandi"
                  }
                  title={
                    showPassword
                      ? "Sembunyikan kata sandi"
                      : "Tampilkan kata sandi"
                  }
                >
                  {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="mt-2 inline-flex items-center justify-center h-11 px-[18px] rounded-xl text-sm font-semibold bg-navy-800 text-white hover:bg-navy-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              {isLoading ? "Memproses…" : "Masuk"}
            </button>
          </form>
        </div>

        <div className="text-center text-xs text-navy-200 mt-5">
          E-Datasheet System v.a.0.0.1 &middot; &copy; SBU Lab - Lab Teknik
        </div>
      </div>
    </div>
  );
}
