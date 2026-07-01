import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";

interface AuthGuardProps {
	children: ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
	const { user, loading } = useAuth();

	if (loading) {
		return (
			<div className="min-h-screen bg-felt flex items-center justify-center">
				<div className="text-green-300 text-lg animate-pulse">Loading...</div>
			</div>
		);
	}

	if (!user) {
		return <Navigate to="/login" replace />;
	}

	return <>{children}</>;
}
