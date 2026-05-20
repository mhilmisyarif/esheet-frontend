// src/App.jsx
import React from "react";
import { Routes, Route, Link, useNavigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";

// Pages
import TechnicianDashboard from "./pages/TechnicianDashboard";
import ReportEditor from "./pages/ReportEditor";
import CreateReport from "./pages/CreateReport";
import OrderDetail from "./pages/OrderDetail";
import LoginPage from "./pages/LoginPage";
import ProtectedRoute from "./components/ProtectedRoute";
import EngineerDashboard from "./pages/EngineerDashboard";
import DashboardRedirect from "./pages/DashboardRedirect";
import ManageStandards from "./pages/ManageStandards";
import DatasheetDetail from "./pages/DatasheetDetail";
import AppShell from "./components/AppShell";

function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <header className="bg-white shadow">
      <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
        <Link to="/" className="text-xl font-semibold">
          e-Sheet Demo
        </Link>
        <nav className="text-sm text-gray-600 flex items-center">
          {user ? (
            <>
              <span className="mr-4">Welcome, {user.name}!</span>
              <button
                onClick={handleLogout}
                className="px-3 py-1 border rounded bg-gray-100 hover:bg-gray-200"
              >
                Logout
              </button>
            </>
          ) : (
            <Link to="/login" className="mr-4">
              Login
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}

// Legacy layout — kept for every screen that hasn't been redesigned yet.
function LegacyLayout({ children }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-6xl mx-auto p-4">{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      {/* Public Route — full-screen, no layout chrome */}
      <Route path="/login" element={<LoginPage />} />

      {/* Protected Routes */}
      <Route element={<ProtectedRoute />}>
        {/* Redesigned — uses the E-Datasheet app shell */}
        <Route
          path="/technician-dashboard"
          element={
            <AppShell>
              <TechnicianDashboard />
            </AppShell>
          }
        />

        {/* Legacy layout */}
        <Route
          path="/"
          element={<LegacyLayout><DashboardRedirect /></LegacyLayout>}
        />
        <Route
          path="/engineer-dashboard"
          element={<LegacyLayout><EngineerDashboard /></LegacyLayout>}
        />
        <Route
          path="/create-report"
          element={
            <AppShell crumbs={["Technician", "New Datasheet"]}>
              <CreateReport />
            </AppShell>
          }
        />
        <Route
          path="/orders/:orderId"
          element={<LegacyLayout><OrderDetail /></LegacyLayout>}
        />
        <Route
          path="/datasheet/:sampleId"
          element={
            <AppShell crumbs={["Technician", "Dashboard", "Datasheet"]}>
              <DatasheetDetail />
            </AppShell>
          }
        />
        <Route
          path="/reports/:sampleId"
          element={
            <AppShell crumbs={["Technician", "Datasheet", "Klausul"]}>
              <ReportEditor />
            </AppShell>
          }
        />
        <Route
          path="/manage-standards"
          element={<LegacyLayout><ManageStandards /></LegacyLayout>}
        />
      </Route>
    </Routes>
  );
}
