export type AuthActionType = "recovery" | "invite";

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

export const getAuthActionTypeFromLocation = (hash: string, search = "") =>
  getAuthActionTypeFromHash(hash) ?? getAuthActionTypeFromSearch(search);

export const hasPendingAuthAction = (hash: string, search = "") =>
  getAuthActionTypeFromLocation(hash, search) !== null;
