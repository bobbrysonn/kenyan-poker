import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthGuard } from "./components/auth/AuthGuard.js";
import { LoginForm } from "./components/auth/LoginForm.js";
import { SignUpForm } from "./components/auth/SignUpForm.js";
import { Lobby } from "./components/lobby/Lobby.js";
import { GameRoom } from "./components/game/GameRoom.js";
import { useAuth } from "./hooks/useAuth.js";

export function App() {
	const { authenticated, loading } = useAuth();

	if (loading) {
		return (
			<div className="min-h-screen bg-felt flex items-center justify-center">
				<div className="text-green-300 text-lg animate-pulse">Loading...</div>
			</div>
		);
	}

	return (
		<BrowserRouter>
			<Routes>
				<Route
					path="/login"
					element={authenticated ? <Navigate to="/" replace /> : <LoginForm />}
				/>
				<Route
					path="/signup"
					element={authenticated ? <Navigate to="/" replace /> : <SignUpForm />}
				/>
				<Route
					path="/"
					element={
						<AuthGuard>
							<Lobby />
						</AuthGuard>
					}
				/>
				<Route
					path="/game/:roomCode"
					element={
						<AuthGuard>
							<GameRoom />
						</AuthGuard>
					}
				/>
			</Routes>
		</BrowserRouter>
	);
}
