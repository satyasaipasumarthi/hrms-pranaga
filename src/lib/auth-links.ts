export type AuthActionType = "recovery" | "invite";

export const getAuthActionTypeFromHash = (hash: string): AuthActionType | null => {
  const normalizedHash = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!normalizedHash) {
    return null;
  }

  const params = new URLSearchParams(normalizedHash);
  const type = params.get("type");

  return type === "recovery" || type === "invite" ? type : null;
};

export const hasPendingAuthAction = (hash: string) => getAuthActionTypeFromHash(hash) !== null;
