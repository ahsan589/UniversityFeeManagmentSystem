
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout/Layout';
import Login from './components/Auth/Login';
import SearchStudent from './components/Student/SearchStudent';
import StudentFeeReport from './components/Reports/StudentFeeReport';
import NewAdmission from './components/Student/NewAdmission';
import EditAdmission from './components/Student/EditAdmission';
import GenerateChallan from './components/Challan/GenerateChallan';
import AdvanceChallan from './components/Challan/AdvanceChallan';
import Payment from './components/Challan/Payment';
import Defaulters from './components/Reports/Defaulters';
import DailyCollection from './components/Reports/DailyCollection';
import MonthlyCollection from './components/Reports/MonthlyCollection';
import Expenses from './components/Expenses/Expenses';
import ClassWiseReports from './components/Reports/ClassWiseReports';

const ProtectedRoute = ({ children }) => {
  const { currentUser, loading } = useAuth();

  if (loading) return <div>Loading...</div>;

  return currentUser ? children : <Navigate to="/login" replace />;
};

const AdminRoute = ({ children }) => {
  const { currentUser, userRole, loading } = useAuth();

  if (loading) return <div>Loading...</div>;

  if (!currentUser) return <Navigate to="/login" replace />;

  if (userRole !== 'admin') return <Navigate to="/" replace />;

  return children;
};

// RoleBasedRoute to allow access based on userRole
const RoleBasedRoute = ({ children, allowedRoles }) => {
  const { currentUser, userRole, loading } = useAuth();

  if (loading) return <div>Loading...</div>;

  if (!currentUser) return <Navigate to="/login" replace />;

  if (!allowedRoles.includes(userRole)) return <Navigate to="/" replace />;

  return children;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/search-student" replace />} />
            <Route path="search-student" element={<SearchStudent />} />
            <Route path="student-fee-report" element={<StudentFeeReport />} />
            <Route path="student-fee-report/:studentId" element={<StudentFeeReport />} />
            <Route path="new-admission" element={<AdminRoute><NewAdmission /></AdminRoute>} />
            <Route path="edit-admission/:studentId" element={<AdminRoute><EditAdmission /></AdminRoute>} />
            <Route path="generate-challan" element={<GenerateChallan />} />
            <Route path="advance-challan" element={<AdvanceChallan />} />
            <Route path="payment" element={<Payment />} />
            <Route path="defaulters" element={<Defaulters />} />
            <Route path="daily-collection" element={<DailyCollection />} />
            <Route path="monthly-collection" element={<MonthlyCollection />} />
            <Route path="expenses" element={<AdminRoute><Expenses /></AdminRoute>} />
            <Route path="class-reports" element={<RoleBasedRoute allowedRoles={['admin', 'accountant']}><ClassWiseReports /></RoleBasedRoute>} />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
