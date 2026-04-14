export type AuthActionType = "recovery" | "invite";

const AUTH_ACTION_STORAGE_KEY = "hrms_pending_auth_action";

const normalizeAuthActionType = (value: string | null): AuthActionType | null => {
  return value === "recovery" || value === "invite" ? value : null;
};

export const getAuthActionTypeFromHash = (hash: string): AuthActionType | null => {
  const normalizedHash = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!normalizedHash) {
    return null;
  }

  const params = new URLSearchParams(normalizedHash);
  return normalizeAuthActionType(params.get("type"));
};

export const getAuthActionTypeFromSearch = (search: string): AuthActionType | null => {
  const normalizedSearch = search.startsWith("?") ? search.slice(1) : search;
  if (!normalizedSearch) {
    return null;
  }

  const params = new URLSearchParams(normalizedSearch);
  return normalizeAuthActionType(params.get("auth_action"));
};

const getStoredAuthActionType = (): AuthActionType | null => {
  if (typeof window === "undefined") {
    return null;
  }

  return normalizeAuthActionType(window.sessionStorage.getItem(AUTH_ACTION_STORAGE_KEY));
};

export const primePendingAuthAction = (hash: string, search = ""): AuthActionType | null => {
  const action = getAuthActionTypeFromHash(hash) ?? getAuthActionTypeFromSearch(search);
  if (typeof window === "undefined") {
    return action;
  }

  if (action) {
    window.sessionStorage.setItem(AUTH_ACTION_STORAGE_KEY, action);
  }

  return action;
};

export const clearPendingAuthAction = () => {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(AUTH_ACTION_STORAGE_KEY);
};

export const getAuthActionTypeFromLocation = (hash: string, search = "") =>
  primePendingAuthAction(hash, search) ?? getStoredAuthActionType();

export const hasPendingAuthAction = (hash: string, search = "") =>
  getAuthActionTypeFromLocation(hash, search) !== null;
