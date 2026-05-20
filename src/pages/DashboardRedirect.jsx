// src/pages/DashboardRedirect.jsx
import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function DashboardRedirect() {
  const { user } = useAuth();

  if (user?.role === "TECHNICIAN")
    return <Navigate to="/technician-dashboard" replace />;
  if (user?.role === "ENGINEER" || user?.role === "ADMIN")
    return <Navigate to="/engineer-dashboard" replace />;
  if (user?.role === "DRAFTER")
    return <Navigate to="/engineer-dashboard" replace />;

  return <Navigate to="/login" replace />;
}
