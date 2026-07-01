import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthGuard } from "./components/auth/AuthGuard.js";
import { Lobby } from "./components/lobby/Lobby.js";
import { GameRoom } from "./components/game/GameRoom.js";

export function App() {
	return (
		<BrowserRouter>
			<Routes>
				<Route path="/login" element={<div>Login Page (TODO)</div>} />
				<Route path="/signup" element={<div>Sign Up Page (TODO)</div>} />
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
