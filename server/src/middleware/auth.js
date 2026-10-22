import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { Admin } from "../models/Admin.js";
import { AppError } from "../utils/AppError.js";
import { can, isRole, permissionsFor } from "../config/permissions.js";

// Data access for auth checks, kept in one object so tests can replace it without a database.
export const adminStore = {
  findById: (id) => Admin.findById(id).select("email role tokenVersion").lean(),
  bumpTokenVersion: (id) =>
    Admin.updateOne({ _id: id }, { $inc: { tokenVersion: 1 } }),
};

// The role in the token is informational only: every request re-reads the role from the database.
export function signToken(admin) {
  return jwt.sign(
    {
      sub: String(admin._id),
      email: admin.email,
      role: admin.role || "admin",
      tv: admin.tokenVersion || 0,
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn },
  );
}

/**
 * Guards every admin-only endpoint. The signed token alone is not enough: the admin must
 * still exist, still have the admin role in the database, and the token must not have been
 * invalidated by a logout. Nothing sent by the client is trusted without this check.
 */
export async function requireAdmin(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token)
    return next(new AppError(401, "Authentication required."));
  if (!env.jwtSecret)
    return next(new AppError(500, "Server authentication is not configured."));

  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret, { algorithms: ["HS256"] });
  } catch {
    return next(
      new AppError(401, "Your session has expired. Please sign in again."),
    );
  }
  if (!isRole(payload.role))
    return next(new AppError(403, "Not authorized.", undefined, "NOT_ADMIN"));
  if (typeof payload.sub !== "string" || !/^[a-f\d]{24}$/i.test(payload.sub)) {
    return next(new AppError(401, "Invalid session. Please sign in again."));
  }

  try {
    const admin = await adminStore.findById(payload.sub);
    if (!admin)
      return next(new AppError(401, "Invalid session. Please sign in again."));
    // Missing role = an account created before roles existed = business admin. Unknown values are refused.
    const role = admin.role ?? "admin";
    if (!isRole(role))
      return next(new AppError(403, "Not authorized.", undefined, "NOT_ADMIN"));
    if ((admin.tokenVersion || 0) !== (payload.tv || 0)) {
      return next(
        new AppError(401, "You have been signed out. Please sign in again."),
      );
    }
    // Permissions come from the database role, never from the token or anything the client sent.
    req.admin = {
      id: String(admin._id),
      email: admin.email,
      role,
      permissions: permissionsFor(role),
    };
    next();
  } catch (err) {
    next(err); // database trouble is a 500, not a bogus 401
  }
}

/**
 * Route guard: allows the request only if the signed-in admin's role has `permission`.
 * Must run after requireAdmin. Responds 403 (not 401) so the browser keeps the session.
 */
export function requirePermission(permission) {
  const permissionGuard = (req, res, next) => {
    if (!req.admin || !can(req.admin.role, permission)) {
      return next(
        new AppError(
          403,
          "Your account does not have permission to do this.",
          undefined,
          "FORBIDDEN",
        ),
      );
    }
    next();
  };
  permissionGuard.permission = permission; // lets tests prove every admin route is guarded
  return permissionGuard;
}
