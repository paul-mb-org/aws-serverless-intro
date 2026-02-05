import { ReactNode } from "react";
import { LoginPage } from "../pages/LoginPage";

interface AuthGuardProps {
  barmanId: string | null;
  barmanName: string | null;
  onLogin: (id: string, name: string) => void;
  children: ReactNode;
}

export function AuthGuard({
  barmanId,
  barmanName,
  onLogin,
  children,
}: AuthGuardProps) {
  if (!barmanId || !barmanName) {
    return <LoginPage onLogin={onLogin} />;
  }

  return <>{children}</>;
}
