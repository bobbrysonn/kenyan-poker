import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

interface RoomPlayer {
	playerId: string;
	seatIndex: number;
	username: string;
}

export function GameRoom() {
	const { roomCode } = useParams<{ roomCode: string }>();
	const navigate = useNavigate();
	const [players, setPlayers] = useState<RoomPlayer[]>([]);
	const [connected, setConnected] = useState(false);
	const [status, setStatus] = useState("connecting");
	const wsRef = useRef<WebSocket | null>(null);

	useEffect(() => {
		async function connect() {
			const {
				data: { session },
			} = await supabase.auth.getSession();
			if (!session?.access_token) {
				navigate("/login");
				return;
			}

			const wsUrl = `${import.meta.env.VITE_WS_URL || "ws://localhost:3001/ws"}?token=${session.access_token}&room=${roomCode}`;
			const ws = new WebSocket(wsUrl);
			wsRef.current = ws;

			ws.onopen = () => {
				setConnected(true);
				setStatus("connected");
			};

			ws.onmessage = (event) => {
				const msg = JSON.parse(event.data);
				switch (msg.type) {
					case "room_state":
						setPlayers(msg.players);
						break;
					case "player_joined":
						setPlayers((prev) => [...prev, msg.player]);
						break;
					case "player_left":
						setPlayers((prev) =>
							prev.filter((p) => p.playerId !== msg.playerId),
						);
						break;
					case "game_state":
						// TODO: render game board
						console.log("Game state:", msg.state);
						break;
					case "chat":
						// TODO: display chat
						break;
					case "error":
						console.error("Server error:", msg.message);
						break;
				}
			};

			ws.onclose = () => {
				setConnected(false);
				setStatus("disconnected");
			};

			ws.onerror = () => {
				setStatus("error");
			};
		}

		connect();

		return () => {
			wsRef.current?.close();
		};
	}, [roomCode, navigate]);

	const handleCopyCode = () => {
		navigator.clipboard.writeText(roomCode || "");
	};

	return (
		<div className="min-h-screen bg-felt p-4">
			<header className="flex items-center justify-between mb-6">
				<div>
					<h1 className="text-2xl font-bold text-gold">🎴 Room: {roomCode}</h1>
					<div className="flex items-center gap-2 mt-1">
						<span
							className={`inline-block w-2 h-2 rounded-full ${connected ? "bg-green-400" : "bg-red-400"}`}
						/>
						<span className="text-green-300 text-sm">{status}</span>
					</div>
				</div>
				<div className="flex gap-3">
					<button
						onClick={handleCopyCode}
						className="text-green-400 hover:text-gold transition text-sm border border-green-700 rounded-lg px-3 py-1"
					>
						Copy Code
					</button>
					<button
						onClick={() => navigate("/")}
						className="text-green-400 hover:text-red-400 transition text-sm"
					>
						Leave
					</button>
				</div>
			</header>

			<div className="bg-felt-light rounded-xl p-6">
				<h2 className="text-lg font-semibold mb-4">
					Players ({players.length})
				</h2>
				{players.length === 0 ? (
					<p className="text-green-500 text-sm">
						Waiting for players to join...
					</p>
				) : (
					<div className="space-y-2">
						{players.map((p, i) => (
							<div
								key={p.playerId}
								className="flex items-center gap-3 bg-green-900/50 rounded-lg px-4 py-3"
							>
								<span className="text-gold font-bold w-6">{i + 1}.</span>
								<span className="text-white">{p.username}</span>
								<span className="text-green-500 text-xs ml-auto">
									Seat {p.seatIndex + 1}
								</span>
							</div>
						))}
					</div>
				)}

				{players.length >= 2 && (
					<button className="mt-6 bg-gold text-black px-6 py-3 rounded-lg font-bold hover:bg-yellow-500 transition w-full">
						Start Game
					</button>
				)}
			</div>
		</div>
	);
}
