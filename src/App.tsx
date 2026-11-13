import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { lazy, Suspense, useEffect, useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import ProtectedRoute from "@/components/layout/ProtectedRoute";
import { useAuth } from "@/hooks/useAuth";
import { hasPendingAuthAction, primePendingAuthAction } from "@/lib/auth-links";

const EmployeeOnboarding = lazy(() => import("./pages/EmployeeOnboarding"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Attendance = lazy(() => import("./pages/Attendance"));
const LeaveApply = lazy(() => import("./pages/LeaveApply"));
const LeaveOperations = lazy(() => import("./pages/LeaveOperations"));
const Payroll = lazy(() => import("./pages/Payroll"));
//const Performance = lazy(() => import("./pages/Performance"));
const Employees = lazy(() => import("./pages/Employees"));
const Recruitment = lazy(() => import("./pages/Recruitment"));
const Team = lazy(() => import("./pages/Team"));
//const WallOfFame = lazy(() => import("./pages/WallOfFame"));
//const AccessControl = lazy(() => import("./pages/AccessControl"));
//const TicketDashboard = lazy(() => import("./pages/TicketDashboard"));
//const CreateTicket = lazy(() => import("./pages/CreateTicket"));
const Settings = lazy(() => import("./pages/Settings"));
const Login = lazy(() => import("./pages/Login"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

if (typeof window !== "undefined") {
  primePendingAuthAction(window.location.hash, window.location.search);
}

const Loading = () => (
  <div className="flex items-center justify-center h-64">
    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

const AuthRedirect = () => {
  const { isAuthenticated, homePath } = useAuth();
  const shouldShowAuthAction =
    typeof window !== "undefined" && hasPendingAuthAction(window.location.hash, window.location.search);

  if (isAuthenticated && !shouldShowAuthAction) return <Navigate to={homePath} replace />;
  return <Login />;
};

const AuthActionRedirector = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!hasPendingAuthAction(location.hash, location.search) || location.pathname === "/login") {
      return;
    }

    navigate(
      {
        pathname: "/login",
        search: location.search,
        hash: location.hash,
      },
      { replace: true },
    );
  }, [location.hash, location.pathname, location.search, navigate]);

  return null;
};

const App = () => {
  const { initialize, isLoading } = useAuth();

  useEffect(() => {
    void initialize();
  }, [initialize]);

  if (isLoading) return <Loading />;

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />

        <BrowserRouter>
          <AuthActionRedirector />
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route path="/login" element={<AuthRedirect />} />
              <Route element={<MainLayout />}>
                <Route path="/" element={<ProtectedRoute module="dashboard"><Dashboard /></ProtectedRoute>} />
                <Route path="/attendance" element={<ProtectedRoute module="attendance"><Attendance /></ProtectedRoute>} />
                <Route path="/applyleave" element={<ProtectedRoute module="leave"><LeaveApply /></ProtectedRoute>} />
                <Route path="/leaveoperations" element={<ProtectedRoute module="leave"><LeaveOperations /></ProtectedRoute>} />
                {/* Old leave URLs redirect to the button-named routes */}
                <Route path="/leave" element={<Navigate to="/applyleave" replace />} />
                <Route path="/leave/apply" element={<Navigate to="/applyleave" replace />} />
                <Route path="/leave/operations" element={<Navigate to="/leaveoperations" replace />} />
                <Route path="/payroll" element={<ProtectedRoute module="payroll"><Payroll /></ProtectedRoute>} />
               

                {/*<Route path="/performance" element={<ProtectedRoute module="performance"><Performance /></ProtectedRoute>} />*/}

                <Route
  path="/employees"
  element={
    <ProtectedRoute module="employees">
      <Employees />
    </ProtectedRoute>
  }
/>
<Route
  path="/employees/new"
  element={<EmployeeOnboarding />}
/>
                <Route path="/recruitment" element={<ProtectedRoute module="recruitment"><Recruitment /></ProtectedRoute>} />
                <Route path="/teams" element={<ProtectedRoute module="team"><Team /></ProtectedRoute>} />
                <Route path="/team" element={<Navigate to="/teams" replace />} />
                {/*<Route path="/wall-of-fame" element={<ProtectedRoute module="wall_of_fame"><WallOfFame /></ProtectedRoute>} />*/}
               {/* <Route path="/access-control" element={<ProtectedRoute module="access_control"><AccessControl /></ProtectedRoute>} />*/}
                <Route path="/settings" element={<ProtectedRoute module="settings"><Settings /></ProtectedRoute>} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
