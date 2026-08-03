// src/pages/LoginPage.jsx
import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, Navigate } from "react-router-dom";
import logoUrl from "../assets/logo.png";

const inputCls =
  "w-full px-3.5 py-2.5 border border-line rounded-lg text-sm text-navy-800 bg-paper outline-none transition-colors focus:border-navy-600 focus:ring-[3px] focus:ring-navy-600/[0.12] placeholder:text-ink-400";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
        <div className="bg-paper rounded-3xl shadow-modal overflow-hidden">
          {/* Brand */}
          <div className="px-8 pt-8 pb-6 flex flex-col items-center text-center border-b border-line-soft">
            <img src={logoUrl} alt="" className="w-[120px] h-auto" />
            <div className="font-mono font-bold text-[22px] tracking-[-0.02em] text-navy-900 mt-1.5">
              E-Datasheet
            </div>
          </div>

          {/* Form */}
          <form
            onSubmit={handleSubmit}
            className="px-8 py-7 flex flex-col gap-[18px]"
          >
            <div className="text-center mb-1">
              <h1 className="text-xl font-semibold text-navy-800">Sign in</h1>
              <p className="text-[13px] text-ink-400 mt-1">
                Enter your credentials to access the portal
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-medium text-navy-800">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="user@example.com"
                className={inputCls}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-medium text-navy-800">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className={inputCls}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="mt-1 inline-flex items-center justify-center h-11 px-[18px] rounded-xl text-sm font-semibold bg-navy-800 text-white hover:bg-navy-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>

        <div className="text-center text-xs text-navy-200 mt-5">
          E-Datasheet v.a.0.0.1 &middot; &copy; SBU Lab - Lab Teknik
        </div>
      </div>
    </div>
  );
}
