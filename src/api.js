import axios from 'axios';

// API base URL — set VITE_API_URL at build time for deployments
// (e.g. https://api.your-domain.com/api). The dev default is a RELATIVE
// path: requests go to the Vite origin and its /api proxy forwards them to
// http://localhost:5000 (see vite.config.js). One origin for desktop AND
// phones on the LAN — no hardcoded IPs, no CORS, no mixed content.
const apiClient = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '/api',
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

// Expired/invalid token → drop the stale session and send the user to login
// instead of letting every request fail with 401 in the background.
apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (
            error.response?.status === 401 &&
            !window.location.pathname.startsWith('/login')
        ) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default apiClient;