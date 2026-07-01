import type { ReactNode } from "react";

interface AuthGuardProps {
	children: ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
	// TODO: Check Supabase auth session
	// For now, always render children (dev mode)
	return <>{children}</>;
}
