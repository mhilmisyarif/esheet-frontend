// src/main.jsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
// react-hot-toast
import { Toaster } from 'react-hot-toast';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      <Toaster position="top-right" reverseOrder={false} />
    </BrowserRouter>
  </React.StrictMode>
);