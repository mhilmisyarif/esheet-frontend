import React, { useState } from 'react';

// --- Mock Data (replace with API calls later) ---
const mockUser = {
  name: 'Budi Hartono',
  role: 'technician',
};

const mockWorksheets = [
  { id: 1, labNo: 'CBT/3801/20-104-04/000030/01/2023', commodity: 'Luminer Tanam', date: '2023-10-18', status: 'Submitted' },
  { id: 2, labNo: 'CBT/3801/20-104-04/000028/01/2023', commodity: 'Luminer PJU', date: '2023-10-17', status: 'Draft' },
  { id: 3, labNo: 'CBT/3801/20-104-04/000025/01/2023', commodity: 'Luminer Sorot', date: '2023-10-15', status: 'Approved' },
  { id: 4, labNo: 'CBT/3801/20-104-04/000021/01/2023', commodity: 'Luminer Portable', date: '2023-10-12', status: 'Corrected' },
];

// --- Helper & Icon Components ---

const StatusBadge = ({ status }) => {
  const statusStyles = {
    Draft: 'bg-red-100 text-red-800',
    Submitted: 'bg-orange-100 text-orange-800',
    Corrected: 'bg-yellow-100 text-yellow-800',
    Approved: 'bg-green-100 text-green-800',
  };

  return (
    <span className={`px-3 py-1 text-xs font-semibold rounded-full ${statusStyles[status] || 'bg-gray-100 text-gray-800'}`}>
      {status}
    </span>
  );
};

const PlusIcon = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

const LogoutIcon = ({ className }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
);


// --- Page Components ---

const LoginPage = ({ onLogin }) => {
  const handleLogin = (e) => {
    e.preventDefault();
    // In a real app, you'd validate credentials here
    onLogin(mockUser);
  };

  return (
    <div className="bg-gray-50 flex items-center justify-center min-h-screen">
      <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-sm">
        <img src="https://www.sucofindo.co.id/themes/default/assets/images/logo.png" alt="Sucofindo Logo" className="w-40 mx-auto mb-6" />
        <h1 className="text-2xl font-bold text-center text-gray-800 mb-2">E-SHEET Login</h1>
        <p className="text-center text-gray-500 mb-6">Silakan masuk untuk melanjutkan</p>
        <form onSubmit={handleLogin}>
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="email">
              Email
            </label>
            <input
              type="email"
              id="email"
              defaultValue="budi.hartono@sucofindo.co.id"
              className="w-full px-4 py-3 bg-gray-100 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your email"
            />
          </div>
          <div className="mb-6">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="password">
              Password
            </label>
            <input
              type="password"
              id="password"
              defaultValue="password"
              className="w-full px-4 py-3 bg-gray-100 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your password"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition duration-300"
          >
            Login
          </button>
        </form>
      </div>
    </div>
  );
};

const TechnicianDashboard = ({ user, worksheets, onNewWorksheet, onSelectWorksheet, onLogout }) => {
  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Selamat Datang, {user.name}!</h1>
            <p className="text-sm text-gray-500">Dashboard Teknisi</p>
          </div>
          <button onClick={onLogout} className="text-gray-500 hover:text-red-600 transition">
            <LogoutIcon className="w-6 h-6"/>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Riwayat Worksheet Anda</h2>
        <div className="space-y-4">
          {worksheets.map(ws => (
            <div
              key={ws.id}
              onClick={() => onSelectWorksheet(ws)}
              className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 cursor-pointer hover:shadow-md hover:border-blue-500 transition-all"
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-bold text-gray-800">{ws.commodity}</p>
                  <p className="text-sm text-gray-500">{ws.labNo}</p>
                </div>
                <StatusBadge status={ws.status} />
              </div>
              <p className="text-xs text-gray-400 mt-3">Dibuat pada: {ws.date}</p>
            </div>
          ))}
        </div>
      </main>

      {/* Floating Action Button */}
      <button
        onClick={onNewWorksheet}
        className="fixed bottom-8 right-8 bg-blue-600 text-white rounded-full p-4 shadow-lg hover:bg-blue-700 transition transform hover:scale-110"
        aria-label="Buat Worksheet Baru"
      >
        <PlusIcon className="w-6 h-6" />
      </button>
    </div>
  );
};

const WorksheetPage = ({ worksheet, onBack }) => {
  return (
    <div className="p-8">
      <button onClick={onBack} className="bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded-lg mb-6 hover:bg-gray-300">
        &larr; Kembali ke Dashboard
      </button>
      <h1 className="text-3xl font-bold mb-4">Worksheet: {worksheet.labNo}</h1>
      <p>Ini adalah halaman untuk mengisi data worksheet komoditi <strong>{worksheet.commodity}</strong>.</p>
      <p className="mt-4 p-4 bg-yellow-100 text-yellow-800 rounded-lg">
        Tampilan form entri data dan navigasi klausul akan dibangun di sini.
      </p>
    </div>
  );
};


// --- Main App Component ---

function App() {
  const [page, setPage] = useState('login'); // 'login', 'dashboard', 'worksheet'
  const [user, setUser] = useState(null);
  const [selectedWorksheet, setSelectedWorksheet] = useState(null);

  const handleLogin = (loggedInUser) => {
    setUser(loggedInUser);
    setPage('dashboard');
  };

  const handleLogout = () => {
    setUser(null);
    setPage('login');
  };
  
  const handleSelectWorksheet = (worksheet) => {
    setSelectedWorksheet(worksheet);
    setPage('worksheet');
  };

  const handleNewWorksheet = () => {
    // In a real app, you might create a new blank worksheet object
    setSelectedWorksheet({ id: 'new', labNo: 'BARU', commodity: 'Belum Dipilih' });
    setPage('worksheet');
  };

  const handleBackToDashboard = () => {
    setSelectedWorksheet(null);
    setPage('dashboard');
  };

  // --- Page Renderer ---
  if (page === 'login') {
    return <LoginPage onLogin={handleLogin} />;
  }

  if (page === 'dashboard') {
    return (
      <TechnicianDashboard
        user={user}
        worksheets={mockWorksheets}
        onSelectWorksheet={handleSelectWorksheet}
        onNewWorksheet={handleNewWorksheet}
        onLogout={handleLogout}
      />
    );
  }

  if (page === 'worksheet') {
    return <WorksheetPage worksheet={selectedWorksheet} onBack={handleBackToDashboard} />;
  }

  return <div>Halaman tidak ditemukan</div>;
}

export default App;

