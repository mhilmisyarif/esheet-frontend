// src/pages/DashboardRedirect.jsx
import React from "react";
import { useAuth } from "../context/AuthContext";
import TechnicianDashboard from "./TechnicianDashboard";
import EngineerDashboard from "./EngineerDashboard";
// Import AdminDashboard here in the future

export default function DashboardRedirect() {
  const { user } = useAuth();

  if (user?.role === "ENGINEER" || user?.role === "ADMIN") {
    return <EngineerDashboard />;
  }

  // Default to Technician Dashboard
  return <TechnicianDashboard />;
}
