import { Outlet, Navigate } from "react-router-dom";
import HRMSSidebar from "./HRMSSidebar";
import Topbar from "./Topbar";
import { useAuth } from "@/hooks/useAuth";

const MainLayout = () => {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen flex w-full bg-background grid-overlay">
      <HRMSSidebar />
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
