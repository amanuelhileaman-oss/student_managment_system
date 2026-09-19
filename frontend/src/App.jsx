import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import DashboardLayout from './components/layout/DashboardLayout';
import LoadingSpinner from './components/common/LoadingSpinner';
import ProfilePage from './pages/common/ProfilePage';

// Public & Auth Pages
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/auth/LoginPage';
import RegisterStudentPage from './pages/auth/RegisterStudentPage';
import RegisterTeacherPage from './pages/auth/RegisterTeacherPage';

// Admin Portal Pages
import AdminDashboard from './pages/admin/AdminDashboard';
import SectionsManagement from './pages/admin/SectionsManagement';
import UsersManagement from './pages/admin/UsersManagement';
import AcademicManagement from './pages/admin/AcademicManagement';
import TeacherAssignments from './pages/admin/TeacherAssignments';
import SchedulesManagement from './pages/admin/SchedulesManagement';
import ReportsPage from './pages/admin/ReportsPage';
import AnnouncementsPage from './pages/admin/AnnouncementsPage';
import MessagesPage from './pages/admin/MessagesPage';
import AuditLogsPage from './pages/admin/AuditLogsPage';
import SettingsPage from './pages/admin/SettingsPage';

// Teacher Portal Pages
import TeacherDashboard from './pages/teacher/TeacherDashboard';
import TeacherAttendancePage from './pages/teacher/TeacherAttendancePage';
import TeacherMaterialsPage from './pages/teacher/TeacherMaterialsPage';
import GradeRecordsPage from './pages/teacher/GradeRecordsPage';
import AssignmentsPage from './pages/teacher/AssignmentsPage';
import TeacherSchedulePage from './pages/teacher/TeacherSchedulePage';
import TeacherStudentsPage from './pages/teacher/TeacherStudentsPage';
import TeacherMessagesPage from './pages/teacher/TeacherMessagesPage';

// Student Portal Pages
import StudentDashboard from './pages/student/StudentDashboard';
import StudentMaterialsPage from './pages/student/StudentMaterialsPage';
import EnrollmentPage from './pages/student/EnrollmentPage';
import StudentResultsPage from './pages/student/StudentResultsPage';
import StudentAssignmentsPage from './pages/student/StudentAssignmentsPage';
import StudentSchedulePage from './pages/student/StudentSchedulePage';
import StudentMessagesPage from './pages/student/StudentMessagesPage';

/**
 * Route guard restricting access to specific roles
 */
const RoleRoute = ({ allowedRoles, children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner message="Verifying security credentials..." />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    // Redirect user to their own authorized dashboard
    if (user.role === 'admin') return <Navigate to="/admin/dashboard" replace />;
    if (user.role === 'teacher') return <Navigate to="/teacher/dashboard" replace />;
    if (user.role === 'student') return <Navigate to="/student/dashboard" replace />;
    return <Navigate to="/login" replace />;
  }

  return children;
};

function AppRoutes() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register/student" element={<RegisterStudentPage />} />
      <Route path="/register/teacher" element={<RegisterTeacherPage />} />

      {/* Admin Portal Routes */}
      <Route
        path="/admin/*"
        element={
          <RoleRoute allowedRoles={['admin']}>
            <DashboardLayout>
              <Routes>
                <Route path="dashboard" element={<AdminDashboard />} />
                <Route path="sections" element={<SectionsManagement />} />
                <Route path="users" element={<UsersManagement />} />
                <Route path="academic" element={<AcademicManagement />} />
                <Route path="teachers" element={<TeacherAssignments />} />
                <Route path="schedules" element={<SchedulesManagement />} />
                <Route path="reports" element={<ReportsPage />} />
                <Route path="announcements" element={<AnnouncementsPage />} />
                <Route path="messages" element={<MessagesPage />} />
                <Route path="audit-logs" element={<AuditLogsPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="profile" element={<ProfilePage />} />
                <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
              </Routes>
            </DashboardLayout>
          </RoleRoute>
        }
      />

      {/* Teacher Portal Routes */}
      <Route
        path="/teacher/*"
        element={
          <RoleRoute allowedRoles={['teacher']}>
            <DashboardLayout>
              <Routes>
                <Route path="dashboard" element={<TeacherDashboard />} />
                <Route path="attendance" element={<TeacherAttendancePage />} />
                <Route path="materials" element={<TeacherMaterialsPage />} />
                <Route path="grades" element={<GradeRecordsPage />} />
                <Route path="assignments" element={<AssignmentsPage />} />
                <Route path="schedule" element={<TeacherSchedulePage />} />
                <Route path="students" element={<TeacherStudentsPage />} />
                <Route path="messages" element={<TeacherMessagesPage />} />
                <Route path="profile" element={<ProfilePage />} />
                <Route path="*" element={<Navigate to="/teacher/dashboard" replace />} />
              </Routes>
            </DashboardLayout>
          </RoleRoute>
        }
      />

      {/* Student Portal Routes */}
      <Route
        path="/student/*"
        element={
          <RoleRoute allowedRoles={['student']}>
            <DashboardLayout>
              <Routes>
                <Route path="dashboard" element={<StudentDashboard />} />
                <Route path="materials" element={<StudentMaterialsPage />} />
                <Route path="enrollment" element={<EnrollmentPage />} />
                <Route path="results" element={<StudentResultsPage />} />
                <Route path="assignments" element={<StudentAssignmentsPage />} />
                <Route path="schedule" element={<StudentSchedulePage />} />
                <Route path="messages" element={<StudentMessagesPage />} />
                <Route path="profile" element={<ProfilePage />} />
                <Route path="*" element={<Navigate to="/student/dashboard" replace />} />
              </Routes>
            </DashboardLayout>
          </RoleRoute>
        }
      />

      {/* Shared Profile Route across all roles */}
      <Route
        path="/profile"
        element={
          <RoleRoute allowedRoles={['admin', 'teacher', 'student']}>
            <DashboardLayout>
              <ProfilePage />
            </DashboardLayout>
          </RoleRoute>
        }
      />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <Router
      future={{
        v7_relativeSplatPath: true,
        v7_startTransition: true,
      }}
    >
      <ThemeProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </ThemeProvider>
    </Router>
  );
}
