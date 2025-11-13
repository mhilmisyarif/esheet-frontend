// src/context/AuthContext.jsx
import React, { createContext, useState, useContext, useEffect } from "react";
import apiClient from "../api";
import toast from "react-hot-toast";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token") || null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // When the app loads, check if a token exists
    if (token) {
      // Set the token on our API client
      apiClient.defaults.headers.common["Authorization"] = `Bearer ${token}`;

      // You could add a 'GET /api/auth/me' endpoint to verify the token
      // and get fresh user data, but for now, we'll trust the token.
      // We'll just re-parse the user from the token (if we stored it)
      // For simplicity, we'll just set loading to false.
      // A real app would fetch the user here.
      setIsLoading(false);
      // Let's assume we stored user data in localStorage too
      const storedUser = localStorage.getItem("user");
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
    } else {
      setIsLoading(false);
    }
  }, [token]);

  const login = async (email, password) => {
    try {
      const response = await apiClient.post("/auth/login", { email, password });
      const { token, user } = response.data;

      // Store in state
      setToken(token);
      setUser(user);

      // Store in localStorage
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));

      // Set default header for all future requests
      apiClient.defaults.headers.common["Authorization"] = `Bearer ${token}`;

      return true;
    } catch (err) {
      console.error("Login failed:", err);
      toast.error(err.response?.data?.error || "Login failed");
      return false;
    }
  };

  const logout = () => {
    // Clear state
    setToken(null);
    setUser(null);

    // Clear localStorage
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    // Remove auth header
    delete apiClient.defaults.headers.common["Authorization"];
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
      {!isLoading && children}
    </AuthContext.Provider>
  );
}

// Custom hook to easily use the auth context
export function useAuth() {
  return useContext(AuthContext);
}
