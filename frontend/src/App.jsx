import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import DashboardLayout from './components/layout/DashboardLayout';
import LoadingSpinner from './components/common/LoadingSpinner';
import ProfilePage from './pages/common/ProfilePage';
import SubscriptionLockedCard from './components/common/SubscriptionLockedCard';

// Public & Auth Pages
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/auth/LoginPage';
import RegisterStudentPage from './pages/auth/RegisterStudentPage';
import RegisterTeacherPage from './pages/auth/RegisterTeacherPage';

// Super Admin Portal Pages
import SuperAdminDashboard from './pages/superadmin/SuperAdminDashboard';
import SuperAdminMorePage from './pages/superadmin/SuperAdminMorePage';
import SuperAdminActionsPage from './pages/superadmin/SuperAdminActionsPage';

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
import SchoolBillingPage from './pages/admin/SchoolBillingPage';
import PaymentSuccessPage from './pages/admin/PaymentSuccessPage';

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
    if (user.role === 'superadmin') return <Navigate to="/superadmin/dashboard" replace />;
    if (user.role === 'admin') return <Navigate to="/admin/dashboard" replace />;
    if (user.role === 'teacher') return <Navigate to="/teacher/dashboard" replace />;
    if (user.role === 'student') return <Navigate to="/student/dashboard" replace />;
    return <Navigate to="/login" replace />;
  }

  return children;
};

/**
 * Route guard restricting access to operational modules when school subscription is PENDING_PAYMENT
 */
const SubscriptionGate = ({ children, moduleName = 'This feature' }) => {
  const { user } = useAuth();
  const isPendingPayment =
    user?.subscriptionStatus === 'PENDING_PAYMENT' || user?.isLocked === true;

  if (isPendingPayment) {
    return <SubscriptionLockedCard moduleName={moduleName} />;
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

      {/* Super Admin Portal Routes */}
      <Route
        path="/superadmin/*"
        element={
          <RoleRoute allowedRoles={['superadmin']}>
            <DashboardLayout>
              <Routes>
                <Route path="dashboard" element={<SuperAdminDashboard />} />
                <Route path="more" element={<SuperAdminMorePage />} />
                <Route path="billing" element={<SuperAdminMorePage />} />
                <Route path="actions" element={<SuperAdminActionsPage />} />
                <Route path="profile" element={<ProfilePage />} />
                <Route path="*" element={<Navigate to="/superadmin/dashboard" replace />} />
              </Routes>
            </DashboardLayout>
          </RoleRoute>
        }
      />

// Admin Portal Routes
      <Route
        path="/admin/*"
        element={
          <RoleRoute allowedRoles={['admin']}>
            <DashboardLayout>
              <Routes>
                <Route path="dashboard" element={<AdminDashboard />} />
                <Route
                  path="sections"
                  element={
                    <SubscriptionGate moduleName="Sections & Capacity Management">
                      <SectionsManagement />
                    </SubscriptionGate>
                  }
                />
                <Route
                  path="users"
                  element={
                    <SubscriptionGate moduleName="User & Student Directory">
                      <UsersManagement />
                    </SubscriptionGate>
                  }
                />
                <Route
                  path="academic"
                  element={
                    <SubscriptionGate moduleName="Academic Programs & Stream Criteria">
                      <AcademicManagement />
                    </SubscriptionGate>
                  }
                />
                <Route
                  path="teachers"
                  element={
                    <SubscriptionGate moduleName="Teacher Subject Assignments">
                      <TeacherAssignments />
                    </SubscriptionGate>
                  }
                />
                <Route
                  path="schedules"
                  element={
                    <SubscriptionGate moduleName="Master Class Schedules">
                      <SchedulesManagement />
                    </SubscriptionGate>
                  }
                />
                <Route
                  path="reports"
                  element={
                    <SubscriptionGate moduleName="Academic Reports & CSV Exports">
                      <ReportsPage />
                    </SubscriptionGate>
                  }
                />
                <Route
                  path="announcements"
                  element={
                    <SubscriptionGate moduleName="School Announcements">
                      <AnnouncementsPage />
                    </SubscriptionGate>
                  }
                />
                <Route
                  path="messages"
                  element={
                    <SubscriptionGate moduleName="Direct Messages">
                      <MessagesPage />
                    </SubscriptionGate>
                  }
                />
                <Route
                  path="audit-logs"
                  element={
                    <SubscriptionGate moduleName="Audit Logs & Compliance">
                      <AuditLogsPage />
                    </SubscriptionGate>
                  }
                />
                <Route
                  path="settings"
                  element={
                    <SubscriptionGate moduleName="School System Settings">
                      <SettingsPage />
                    </SubscriptionGate>
                  }
                />
                <Route path="billing" element={<SchoolBillingPage />} />
                <Route path="billing/success" element={<PaymentSuccessPage />} />
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
          <RoleRoute allowedRoles={['superadmin', 'admin', 'teacher', 'student']}>
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
