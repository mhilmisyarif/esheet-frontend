import axios from 'axios';

// API base URL — set VITE_API_URL at build time for deployments
// (e.g. https://api.your-domain.com/api). Falls back to localhost for dev.
const apiClient = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
    headers: {
        'Content-Type': 'application/json',
    },
});

// THIS IS THE KEY: Interceptor to add the token
apiClient.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token'); // Get token from storage
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

export default apiClient;