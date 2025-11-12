// import axios from 'axios';

// // Buat instance axios dengan URL dasar backend Anda
// const apiClient = axios.create({
//     baseURL: 'http://localhost:5000/api', // Pastikan backend Anda berjalan di port 5000
//     headers: {
//         'Content-Type': 'application/json',
//     },
// });

// // Interceptor untuk menambahkan token otentikasi ke setiap permintaan
// apiClient.interceptors.request.use(
//     (config) => {
//         const token = localStorage.getItem('token');
//         if (token) {
//             config.headers.Authorization = `Bearer ${token}`;
//         }
//         return config;
//     },
//     (error) => {
//         return Promise.reject(error);
//     }
// );

// export default apiClient;

