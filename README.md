# e-Sheet Frontend

This is the frontend application for the e-Sheet (Electronic Datasheet) system, built with React and Vite. It provides the user interface for laboratory technicians, engineers, and admins to manage, fill out, and approve digital test worksheets, replacing a manual paper-based process.

This application is designed to connect to the [e-Sheet Backend API](https://github.com/mhilmisyarif/esheet-backend) (which we also built) for all data and authentication.

## ✨ Features

- **Global Authentication:** Manages user sessions (Technician, Engineer, Admin) using React Context and JWTs.
- **Role-Based Dashboards:** Automatically directs users to the correct dashboard based on their role (e.g., `TechnicianDashboard` vs. `EngineerDashboard`).
- **Protected Routes:** All workflow pages are protected and require a valid login.
- **Dynamic Report Creation:** A "Create Report" form that parses order numbers, auto-detects labs, and allows selection of "Full" vs. "Verification" testing types.
- **Interactive Report Editor:** The core of the app featuring a sticky sidebar for navigating test clauses.
- **Complex Form Handling:** Technicians can fill L/TB/G decisions, write notes ("Catatan"), and build dynamic attachment tables, all within the `KlausulButirTable` component.
- **File Uploads:** Integrated image uploader with caption saving for test evidence.
- **Autosave:** All changes (notes, decisions, tables) are automatically marked as "dirty" and saved in the background via a single API endpoint.
- **Approval Workflow:** Engineers see "Approve" / "Reject" buttons, allowing them to manage the report's status.
- **Report Download:** Allows users to download the final, server-generated `.docx` report.

## 🛠️ Tech Stack

- **Framework:** React 19
- **Bundler:** Vite
- **Routing:** React Router v7
- **Styling:** Tailwind CSS
- **API Client:** Axios
- **Notifications:** React Hot Toast
- **Icons:** React Icons

---

## 🚀 Getting Started

### 1\. Backend Requirement

This is a frontend application and **will not run** without its corresponding backend server.

1.  Ensure the `esheet-backend` project is running (e.g., on `http://localhost:5000`).

2.  Update the `baseURL` in `src/api.js` to point to your running backend API.

    ```javascript
    // src/api.js
    const apiClient = axios.create({
      baseURL: "http://localhost:5000/api", // <-- Make sure this matches your backend
      // ...
    });
    ```

### 2\. Installation

1.  **Clone the repository:**

    ```bash
    git clone [your-frontend-repo-url]
    cd esheet-frontend
    ```

2.  **Install dependencies:**

    ```bash
    npm install
    ```

### 3\. Running the Application

1.  **Run in development mode:**
    This will start the Vite development server, usually at `http://localhost:5173`.
    ```bash
    npm run dev
    ```

## 📜 Available Scripts

Inside `package.json`, you will find:

- `npm run dev`: Starts the development server with Hot Module Replacement (HMR).
- `npm run build`: Bundles the app for production.
- `npm run lint`: Runs ESLint to check for code quality.
- `npm run preview`: Starts a local server to preview the production build.
