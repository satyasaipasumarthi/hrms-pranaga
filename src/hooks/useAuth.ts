import { create } from "zustand";
import { fetchAccessContext } from "@/lib/hrms-api";
import { getHomePath, type PermissionMap } from "@/lib/permissions";
import { type AuthUser, type ResolvedModulePermission } from "@/lib/roles";
import { supabase } from "@/lib/supabase";

interface AuthState {
  user: AuthUser | null;
  permissions: PermissionMap;
  permissionRows: ResolvedModulePermission[];
  homePath: string;
  accessSource: "backend" | "fallback" | null;
  accessError: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  initialize: () => Promise<void>;
  refreshAccess: () => Promise<boolean>;
  clearAccessError: () => void;
}

const defaultState = {
  user: null,
  permissions: {} as PermissionMap,
  permissionRows: [] as ResolvedModulePermission[],
  homePath: "/login",
  accessSource: null,
  accessError: null,
  isAuthenticated: false,
};

let authSubscription: { unsubscribe: () => void } | null = null;
let initializePromise: Promise<void> | null = null;

const clearCheckInCache = (userId?: string | null) => {
  const keysToRemove: string[] = [];

  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key?.startsWith("hrms_checkin_")) {
      if (!userId || key === `hrms_checkin_${userId}`) {
        keysToRemove.push(key);
      }
    }
  }

  keysToRemove.forEach((key) => localStorage.removeItem(key));
};

const applySignedOutState = (set: (partial: Partial<AuthState>) => void, accessError: string | null = null) => {
  set({
    ...defaultState,
    accessError,
    isLoading: false,
  });
};

const hydrateAccessContext = async (
  authUserId: string,
  set: (partial: Partial<AuthState>) => void,
) => {
  const context = await fetchAccessContext(authUserId);

  set({
    user: context.user,
    permissions: context.permissionMap,
    permissionRows: context.permissions,
    homePath: getHomePath(context.permissionMap),
    accessSource: context.usedFallbackPermissions ? "fallback" : "backend",
    accessError: null,
    isAuthenticated: true,
  });

  return true;
};

const attachAuthListener = (set: (partial: Partial<AuthState>) => void) => {
  if (authSubscription) {
    return;
  }

  const listener = supabase.auth.onAuthStateChange((event, session) => {
    void Promise.resolve().then(async () => {
      if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") && session?.user) {
        set({ isLoading: true });

        try {
          const hydrated = await hydrateAccessContext(session.user.id, set);
          if (!hydrated) {
            await supabase.auth.signOut();
          }
        } catch (error) {
          console.error("Auth state refresh error:", error);
          await supabase.auth.signOut();
          applySignedOutState(set, error instanceof Error ? error.message : "Session refresh failed.");
        } finally {
          set({ isLoading: false });
        }

        return;
      }

      if (event === "SIGNED_OUT") {
        applySignedOutState(set);
      }
    });
  });

  authSubscription = listener.data.subscription;
};

export const useAuth = create<AuthState>((set, get) => ({
  ...defaultState,
  isLoading: true,
  login: async (email, password) => {
    set({ isLoading: true, accessError: null });

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        throw error;
      }

      if (!data.user) {
        set({ isLoading: false });
        return { success: false, error: "User not found." };
      }

      const hydrated = await hydrateAccessContext(data.user.id, set);
      if (!hydrated) {
        await supabase.auth.signOut();
        return { success: false, error: "Role access could not be resolved." };
      }

      return { success: true };
    } catch (error) {
      console.error("Login error:", error);
      applySignedOutState(set, error instanceof Error ? error.message : "Login failed.");
      return { success: false, error: error instanceof Error ? error.message : "Login failed." };
    } finally {
      set({ isLoading: false });
    }
  },
  logout: async () => {
    const currentUserId = get().user?.id ?? null;

    clearCheckInCache(currentUserId);
    sessionStorage.clear();
    applySignedOutState(set);

    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Logout error:", error);
    }
  },
  initialize: async () => {
    if (initializePromise) {
      return initializePromise;
    }

    set({ isLoading: true, accessError: null });

    initializePromise = (async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          throw error;
        }

        if (session?.user) {
          const hydrated = await hydrateAccessContext(session.user.id, set);
          if (!hydrated) {
            await supabase.auth.signOut();
          }
        } else {
          applySignedOutState(set);
        }
      } catch (error) {
        console.error("Initialization error:", error);
        applySignedOutState(set, error instanceof Error ? error.message : "Authentication bootstrap failed.");
      } finally {
        set({ isLoading: false });
        attachAuthListener(set);
        initializePromise = null;
      }
    })();

    return initializePromise;
  },
  refreshAccess: async () => {
    const currentUser = get().user;
    if (!currentUser) {
      return false;
    }

    set({ isLoading: true, accessError: null });

    try {
      const hydrated = await hydrateAccessContext(currentUser.id, set);
      if (!hydrated) {
        await supabase.auth.signOut();
        return false;
      }

      return true;
    } catch (error) {
      console.error("Access refresh error:", error);
      set({ accessError: error instanceof Error ? error.message : "Access refresh failed." });
      return false;
    } finally {
      set({ isLoading: false });
    }
  },
  clearAccessError: () => set({ accessError: null }),
}));
