import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { canAccessPath, hasModulePermission } from "@/lib/permissions";
import { routeConfigByPath, type AppModule, type PermissionAction } from "@/lib/roles";

interface ProtectedRouteProps {
  children: ReactNode;
  module?: AppModule;
  action?: PermissionAction;
}

const ProtectedRoute = ({ children, module, action = "view" }: ProtectedRouteProps) => {
  const { user, isAuthenticated, isLoading, permissions, homePath } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  const routeModule = module ?? routeConfigByPath[location.pathname]?.module;
  const isAllowed = routeModule
    ? hasModulePermission(permissions, routeModule, action)
    : canAccessPath(permissions, location.pathname);

  if (!isAllowed) {
    return <Navigate to={homePath} replace state={{ deniedPath: location.pathname }} />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
