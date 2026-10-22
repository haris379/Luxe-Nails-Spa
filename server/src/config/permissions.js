// Single source of truth for what each role may do. Roles live ONLY in the database (Admin.role) and are set
// only by the provisioning scripts, never by an API request.
//
//   admin      the business owner: reads services; manages appointments and messages.
//   developer  website maintenance: manages services (add / edit / images / delete).
//              Deliberately has NO access to customer data (appointments, messages) - least privilege.
//              To let the developer see customer data too, add the permissions below.
export const ROLES = ['admin', 'developer'];

export const PERMISSIONS = {
  admin: ['services:read', 'appointments:read', 'appointments:manage', 'messages:read', 'messages:manage'],
  developer: ['services:read', 'services:write'],
};

export const isRole = (value) => typeof value === 'string' && ROLES.includes(value);
// Own-property lookups only: a role such as "__proto__" or "constructor" must never resolve to anything.
const listFor = (role) => (isRole(role) && Object.hasOwn(PERMISSIONS, role) ? PERMISSIONS[role] : []);
export const permissionsFor = (role) => [...listFor(role)];
export const can = (role, permission) => listFor(role).includes(permission);
