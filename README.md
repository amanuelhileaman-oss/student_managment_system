# EthioHighHub — Production High School Management System (PERN Stack)

A complete, production-grade, full-stack **High School Management System** built with **PostgreSQL 18**, **Express.js**, **React.js 18**, **Node.js**, and **Tailwind CSS**.

Designed according to the standard Ethiopian High School academic structure (strictly **Grades 9 through 12**, with **General**, **Natural Science**, and **Social Science** streams).

---

## 🏛️ System Architecture

```
STUDE/
├── backend/
│   ├── data/pg_data/            # Local PostgreSQL 18 cluster (port 5433)
│   ├── scripts/                 # Verification suites, DB control scripts
│   ├── src/
│   │   ├── config/              # PostgreSQL pool & serverless client (Neon / pg)
│   │   ├── controllers/         # Auth, academic, attendance, student, teacher, admin, reports, audit
│   │   ├── database/            # schema.sql (24 relational tables, triggers, constraints) & seed.js
│   │   ├── middleware/          # JWT auth, role guards (requireRole), error handling, multer uploads
│   │   ├── routes/              # Express API route modules
│   │   ├── services/            # Stream eligibility, atomic enrollment, grading propagation, audit logger
│   │   └── server.js            # Express API server entry point (port 5000)
│   ├── .env.example             # Backend environment template
│   └── package.json
├── frontend/
│   ├── public/                  # Static assets & academic crest favicon
│   ├── src/
│   │   ├── components/          # Reusable UI widgets (DataTable, Alert with countdown, Modal, StatCard)
│   │   ├── context/             # AuthContext (JWT session) & ThemeContext (Dark/Light mode)
│   │   ├── pages/               # Portals for Admin, Faculty (Teacher), and Student
│   │   ├── services/api.js      # Axios client with bearer interceptor & 401 handling
│   │   ├── App.jsx              # Role-protected routing (RoleRoute)
│   │   └── main.jsx             # React entry point
│   ├── .env.example             # Frontend environment template
│   ├── tailwind.config.js       # Modern typography & color token config
│   └── package.json
├── .gitignore                   # Comprehensive ignores for secrets, uploads & dependencies
└── README.md
```

---

## 🚀 Core Production Features

### 1. Multi-Tier Role-Based Access Control (RBAC)
- **Administrator**: Single-admin architectural guarantee enforced at the PostgreSQL database level (`single_admin_idx` partial unique index & trigger).
- **Teacher (Faculty)**: Subject assignment management, interactive student attendance sheet, grade book, digital library uploads, group grading.
- **Student**: Grade 8 admission document submission, section enrollment, live timetable tracking, academic results, digital library, and attendance history.

### 2. Real-World Student Attendance Management
- **Interactive Daily Attendance Sheet**: Color-coded toggle buttons for **Present (P)**, **Late (L)**, **Absent (A)**, and **Excused (E)**.
- **Bulk Action Controls**: One-click **"Mark All Present"** and **"Mark All Absent"** buttons.
- **Remarks & Notes**: Inline excuse notes (medical certificate, late reason, parental notification).
- **Live Class Analytics**: Real-time counter cards showing attendance rate %, present, late, absent, and excused counts.
- **Attendance History & Logs**: Chronological table of past attendance sessions with inspect/edit capabilities.
- **At-Risk Student Early Warning**: Identifies students with attendance below 75% or 3+ absences for academic counseling.
- **Student Portal Visibility**: Students track their personal attendance rate and presence history in real time.

### 3. Curriculum & Custom Subject Management
- Dedicated subject management in Academic & Streams.
- Create, modify, and delete curriculum courses with grade level validation (9–12), stream alignment (General for 9/10, Natural/Social for 11/12), and weekly credit hours.
- Safe deletion protection preventing accidental deletion of courses with active grades or teacher assignments.

### 4. User Directory & Filter Engine
- Dynamic filtering by **Grade (9–12)**, **Section (A–D)**, **Stream (General, Natural, Social)**, and **Status**.
- Faculty filters by department/specialization and grades taught.
- Instant **Reset Filters** action and live search across names, IDs, emails, and roles.

### 5. Stream Specialization & Criteria Engine
- **Grades 9 & 10**: General stream curriculum for all students.
- **Grades 11 & 12**: Automated qualification engine for **Natural Science** (benchmarked minimum GPA and science scores) and **Social Science**.

### 6. Atomic Section Capacity & Concurrency Protection
- Enforces strict student capacity caps (50 students per section) using database row-locking (`SELECT ... FOR UPDATE`) to prevent race conditions during simultaneous student enrollments.
- Dynamic **"+ Create Other Section"** capability for administrators.

### 7. Study Materials & Digital Library
- Teachers upload textbooks, lecture notes, worksheets, exam preparation guides, and literature books.
- Students filter and download learning resources categorized by subject, grade level, and material type.

### 8. Direct Messaging & Communications
- Integrated direct messaging hub across teachers, students, and administrators.
- School-wide broadcast announcements with audience targeting (All, Students, Teachers, or specific Grades/Streams).

### 9. Remarkable & Responsive UI
- Built with Tailwind CSS and Lucide icons.
- Sleek dark mode / light mode toggle with zero flash of unstyled theme (FOUC).
- Auto-dismissing animated notification alerts with live countdown progress bars and pause-on-hover interaction.

---

## 🔑 Default Credentials & Demo Accounts

| Role | Email | Password | Details |
| :--- | :--- | :--- | :--- |
| **Admin** | `aman12@gmail.com` | `aman1221` | Principal / System Administrator |
| **Teacher (Math)** | `teacher.math@highschool.edu` | `Teacher@123` | Abebe Kebede — Mathematics Faculty |
| **Teacher (Physics)** | `teacher.physics@highschool.edu` | `Teacher@123` | Dr. Helen Mengistu — Science Faculty |
| **Student (Grade 9)** | `student.g9@highschool.edu` | `Student@123` | Dawit Bekele — Grade 9 Section A |
| **Student (G10 Natural)** | `student.g10.natural@highschool.edu` | `Student@123` | Natnael Desta — Natural Science Qualified |
| **Student (G10 Social)** | `student.g10.social@highschool.edu` | `Student@123` | Bethlehem Girma — Social Science Qualified |

---

## 🛠️ Local Development Setup

### 1. Database Setup
```bash
cd backend
./scripts/start-db.sh   # Starts local PostgreSQL cluster on port 5433
npm run db:init         # Creates all 24 relational tables and triggers
npm run db:seed         # Seeds initial demo accounts and academic data
```

### 2. Backend Server
```bash
cd backend
npm install
npm run dev             # Starts Express server on http://localhost:5000
```

### 3. Frontend Application
```bash
cd frontend
npm install
npm run dev             # Starts Vite dev server on http://localhost:5173
```

---

## 🧪 Automated Test Suites

```bash
# Run complete verification suite
node backend/scripts/verify-all.js

# Run attendance system verification
node backend/scripts/verify-attendance-system.js

# Run frontend build check
cd frontend && npm run build
```

---

## 🌐 Production Deployment Guide

### Option 1: Vercel + Render + Neon (Recommended)
1. **Database**: Create a serverless PostgreSQL database on **Neon** or **Supabase**.
2. **Backend**: Deploy `backend/` on **Render** or **Railway** as a Node.js Web Service:
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Set Environment Variables:
     - `DATABASE_URL`: Your cloud PostgreSQL connection string with `?sslmode=require`
     - `JWT_SECRET`: Random 64-character secret
     - `ADMIN_EMAIL`: Your school administrator email
     - `ADMIN_PASSWORD`: Strong administrator password
     - `FRONTEND_URL`: Your hosted frontend URL (for CORS)
     - `NODE_ENV`: `production`
   - Run `npm run db:init` once to initialize the database tables.
3. **Frontend**: Deploy `frontend/` on **Vercel** or **Netlify**:
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Set Environment Variable: `VITE_API_URL=https://your-backend.onrender.com/api`

### Option 2: Self-Hosted Ubuntu VPS (Nginx + PM2)
1. Build frontend bundle: `cd frontend && npm run build`
2. Serve static files from `frontend/dist` using Nginx.
3. Proxy `/api` and `/uploads` requests to the Express backend running on PM2:
   ```bash
   pm2 start src/server.js --name "ethio-high-hub-backend"
   ```

---

## 📄 License
MIT License. Built for high schools and educational institutions.
