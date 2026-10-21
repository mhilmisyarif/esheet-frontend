// src/main.jsx
import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "./context/AuthContext";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
        <Toaster
          position="top-right"
          reverseOrder={false}
          containerStyle={{
            top: 88,
            right: 24,
          }}
          toastOptions={{
            duration: 3500,
            style: {
              background: "#ffffff",
              color: "#07193f",
              border: "1px solid #d3dfe7",
              borderRadius: "14px",
              boxShadow:
                "0 8px 24px rgba(11, 35, 94, 0.12), 0 2px 6px rgba(11, 35, 94, 0.06)",
              fontSize: "13.5px",
              fontWeight: 500,
              padding: "10px 16px",
            },
            success: {
              iconTheme: {
                primary: "#164300",
                secondary: "#bcffad",
              },
            },
            error: {
              iconTheme: {
                primary: "#a3072b",
                secondary: "#fed2d9",
              },
            },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
