// src/App.jsx
import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import TechnicianDashboard from './pages/TechnicianDashboard';
import ReportEditor from './pages/ReportEditor';
// import Dashboard from './pages/Dashboard';
import OrderDetail from './pages/OrderDetail';
// import ReportPage from './pages/ReportPage';



export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="text-xl font-semibold">e-Sheet Demo</Link>
          <nav className="text-sm text-gray-600">
            <Link to="/" className="mr-4">Dashboard</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4">
        <Routes>
          {/* <Route path="/" element={<Dashboard />} /> */}
          <Route path="/" element={<TechnicianDashboard />} />
          <Route path="/orders/:orderId" element={<OrderDetail />} />
          {/* <Route path="/reports/:sampleId" element={<ReportPage />} /> */}
          <Route path="/reports/:sampleId" element={<ReportEditor />} />
        </Routes>
      </main>   
    </div>
  );
}
