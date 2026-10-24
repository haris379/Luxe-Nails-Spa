import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  timeout: 15000,
});

const TOKEN_KEY = "luxe_admin_token";
export const getToken = () => {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};
export const setToken = (t) => {
  try {
    t
      ? sessionStorage.setItem(TOKEN_KEY, t)
      : sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable */
  }
};

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token && config.url?.startsWith("/admin"))
    config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// A 401 from an admin call (or a 403 that says the account is not an admin at all) means the session is no
// longer valid: drop the token and go to the login page. A plain 403 "FORBIDDEN" is different: the person is
// signed in but this role may not do that, so they stay signed in and see the message.
// Calls that handle this themselves (session check, logout, login) pass { skipAuthRedirect: true }.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const cfg = err.config || {};
    const status = err.response?.status;
    const sessionInvalid =
      status === 401 ||
      (status === 403 && err.response?.data?.code === "NOT_ADMIN");
    if (
      sessionInvalid &&
      (cfg.url || "").startsWith("/admin") &&
      !(cfg.url || "").startsWith("/admin/login") &&
      !cfg.skipAuthRedirect
    ) {
      setToken(null);
      if (!window.location.pathname.startsWith("/admin/login"))
        window.location.replace("/admin/login?reason=expired");
    }
    return Promise.reject(err);
  },
);

/** Ends the admin session: invalidates the token on the server, then clears it locally. */
export async function adminLogout() {
  try {
    await api.post("/admin/logout", null, { skipAuthRedirect: true });
  } catch {
    /* even if the server is unreachable, the local session is cleared below */
  } finally {
    setToken(null);
  }
}

// Uploaded images are stored by the backend and saved as "/uploads/services/<name>". When the API lives on
// another domain (production) those paths must be loaded from the API's origin. In development the Vite proxy
// forwards /uploads to the backend, so the base stays empty. Override with VITE_UPLOADS_URL if needed.
const originOf = (u) => {
  try {
    return new URL(u, window.location.href).origin;
  } catch {
    return "";
  }
};
const UPLOADS_BASE = (
  import.meta.env.VITE_UPLOADS_URL ||
  (import.meta.env.VITE_API_URL ? originOf(import.meta.env.VITE_API_URL) : "")
).replace(/\/+$/, "");

/** Works for every kind of stored image value: uploaded paths, frontend assets (/images/...), and full URLs. */
export function resolveImageUrl(src) {
  if (!src) return "";
  if (
    /^(https?:)?\/\//i.test(src) ||
    src.startsWith("data:") ||
    src.startsWith("blob:")
  )
    return src;
  if (src.startsWith("/uploads/")) return `${UPLOADS_BASE}${src}`;
  return src;
}

/** Normalises any axios error to { message, fieldErrors, status }. */
export function parseError(err) {
  if (err.response) {
    return {
      status: err.response.status,
      code: err.response.data?.code || "",
      message:
        err.response.data?.message || "Something went wrong. Please try again.",
      fieldErrors: err.response.data?.errors || {},
    };
  }
  if (err.code === "ECONNABORTED")
    return {
      status: 0,
      message: "The request timed out. Please try again.",
      fieldErrors: {},
    };
  return {
    status: 0,
    message: "Cannot reach the server. Check your connection and try again.",
    fieldErrors: {},
  };
}

export const formatPrice = (n, starting) =>
  `${starting ? "From " : ""}₱${Number(n).toLocaleString("en-PH")}`;
export const formatDuration = (m) =>
  m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ""}` : `${m} min`;
