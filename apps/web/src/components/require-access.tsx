import type { ReactNode } from "react";
import { Navigate } from "react-router";

import { useAuth } from "../auth";
import { canAccess, type AccessRule } from "../lib/permissions";

export function RequireAccess({
  children,
  rule,
}: {
  children: ReactNode;
  rule: AccessRule;
}) {
  const { user } = useAuth();

  return user && canAccess(user, rule) ? children : <Navigate replace to="/" />;
}
