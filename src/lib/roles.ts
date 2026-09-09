import { RoleType } from "../context/AuthContext";

export const isProjectAdmin = (role?: RoleType | null) =>
  role === "Administrator" || role === "MunicipalAccountant";

export const isRoleAllowed = (role: RoleType | undefined | null, allowedRoles?: RoleType[]) =>
  !allowedRoles || Boolean(role && (isProjectAdmin(role) || allowedRoles.includes(role)));
