# Cerventech HR Management System

## Project Overview

The Cerventech HR Management System is a comprehensive web application designed to streamline human resources operations, employee management, and time tracking. Built with modern web technologies, it provides a robust platform for both employees to track their work and administrators to oversee HR functions efficiently.

## Features

### Employee Portal
*   **Profile Management:** Employees can view their personal and professional details.
*   **Time Tracking:** A dedicated interface for clocking in and out, tracking daily work hours, and viewing work log history.
*   **AI Analyst Integration:** (Planned/Future) Leverage AI to provide insights or assistance to employees, possibly related to productivity or task management.

### Admin Dashboard
*   **Dashboard Home:** An overview of key HR metrics and employee status.
*   **Employee Management:**
    *   **Employee List:** View all registered employees with their details.
    *   **Employee Details:** Detailed view of each employee's profile.
    *   **Add Employee:** Functionality to onboard new employees.
*   **Time Log Management:**
    *   **Edit Time:** Administrators can edit an employee's time-in and time-out records to correct discrepancies. Features a searchable dropdown for employee selection and an editable log interface.
    *   **Export Data:** Export employee time-in and time-out data within a specified date range to a CSV file for reporting and analysis.
*   **Reporting & Analytics:** (Planned/Future) Advanced features for generating reports and analyzing employee data.

## Technologies Used

*   **Frontend Framework:** Next.js
*   **UI Library:** React
*   **Styling:** Tailwind CSS
*   **Icons:** Lucide React
*   **Charting (if applicable):** Recharts (from `package.json`)
*   **Date Management:** date-fns (from `package.json`)
*   **AI Integration:** `@google/genai` (from `package.json`)
*   **Authentication:** `next-auth` (from `package.json`)

## Getting Started

Follow these instructions to set up and run the project locally.

### Prerequisites

*   Node.js (version 18 or higher recommended)
*   npm (Node Package Manager)

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/cerventech-hr-management.git
    cd cerventech-hr-management
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Set up Environment Variables:**
    Create a `.env.local` file in the root directory of the project and add your environment variables.
    ```
    # Example for Gemini API Key, if AI Analyst feature is active
    GEMINI_API_KEY=your_gemini_api_key_here 
    ```
    *(Note: The `GEMINI_API_KEY` is specifically for AI functionalities within the project. Refer to the Gemini API documentation for more details on obtaining a key.)*

### Running Locally

To start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

## Contribution

(Optional section for future contributions guidelines)

## License

(Optional section for licensing information)