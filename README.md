# Sentinel AI - Cybersecurity Audit Platform

Sentinel AI is an AI-driven cybersecurity audit SaaS platform. It allows users to manage projects, run security scans (AI-orchestrated), view vulnerabilities, and generate actionable reports.

## Tech Stack
-   **Frontend:** React, Vite, TypeScript, Tailwind CSS, Lucide Icons.
-   **Backend:** Supabase (Auth, PostgreSQL, Row Level Security).
-   **Routing:** React Router DOM.
-   **AI:** Custom Gateway/Agent orchestrator.

## Getting Started

### Prerequisites
-   Node.js (v18+)
-   Supabase Project

### Installation
1.  Clone the repository.
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Copy `.env.example` to `.env` and fill in your Supabase credentials:
    ```bash
    cp .env.example .env
    ```
4.  Start the development server:
    ```bash
    npm run dev
    ```

## Project Structure
-   `src/components`: Reusable UI components.
-   `src/context`: Auth and application-wide state.
-   `src/lib`: Core business logic (AI Gateway, Agent Tools, Supabase Client).
-   `src/pages`: Main application views.
-   `supabase/migrations`: Database schema definitions.

## Database Setup
Run the migrations in the `supabase/migrations` folder against your Supabase instance to set up the necessary tables and RLS policies.
