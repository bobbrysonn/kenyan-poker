import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

interface RoomPlayer {
	playerId: string;
	seatIndex: number;
	username: string;
}

// Matches the server's PublicGameState (packages/server/src/game-session.ts).
// Placeholder view until the dedicated Game UI components land.
interface PublicGameState {
	yourPlayerId: number;
	players: {
		id: number;
		userId: string;
		name: string;
		handCount: number;
		hand?: unknown[];
		cardless: boolean;
	}[];
	topCard: unknown;
	drawPileCount: number;
	discardPileCount: number;
	direction: string;
	currentPlayerIndex: number;
	gameOver: boolean;
}

export function GameRoom() {
	const { roomCode } = useParams<{ roomCode: string }>();
	const navigate = useNavigate();
	const [players, setPlayers] = useState<RoomPlayer[]>([]);
	const [connected, setConnected] = useState(false);
	const [status, setStatus] = useState("connecting");
	const [hostId, setHostId] = useState<string | null>(null);
	const [userId, setUserId] = useState<string | null>(null);
	const [gameState, setGameState] = useState<PublicGameState | null>(null);
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
			setUserId(session.user.id);

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
						setHostId(msg.hostId);
						break;
					case "player_joined":
						setPlayers((prev) => [...prev, msg.player]);
						break;
					case "player_left":
						setPlayers((prev) =>
							prev.filter((p) => p.playerId !== msg.playerId),
						);
						break;
					case "game_started":
						setStatus("playing");
						break;
					case "game_state":
						// TODO: replace with GameBoard/PlayerHand/etc. once built
						setGameState(msg.state);
						break;
					case "game_over":
						setStatus("finished");
						break;
					case "chat":
						// TODO: display chat
						break;
					case "action_result":
						if (!msg.success) console.warn("Action rejected:", msg.message);
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

	const handleStartGame = () => {
		wsRef.current?.send(JSON.stringify({ type: "start_game" }));
	};

	const isHost = !!userId && userId === hostId;

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

				{isHost && status === "connected" && players.length >= 2 && (
					<button
						onClick={handleStartGame}
						className="mt-6 bg-gold text-black px-6 py-3 rounded-lg font-bold hover:bg-yellow-500 transition w-full"
					>
						Start Game
					</button>
				)}
			</div>

			{gameState && (
				<div className="bg-felt-light rounded-xl p-6 mt-6">
					<h2 className="text-lg font-semibold mb-2 text-gold">
						{gameState.gameOver ? "Game Over" : "Game in progress"}
					</h2>
					<p className="text-green-300 text-sm">
						Direction: {gameState.direction} · Draw pile:{" "}
						{gameState.drawPileCount} · Discard pile: {gameState.discardPileCount}
					</p>
					<div className="mt-4 space-y-1">
						{gameState.players.map((p) => (
							<div
								key={p.userId}
								className={`flex items-center gap-3 rounded-lg px-4 py-2 ${
									p.id === gameState.currentPlayerIndex
										? "bg-gold/20 border border-gold"
										: "bg-green-900/50"
								}`}
							>
								<span className="text-white">{p.name}</span>
								<span className="text-green-500 text-xs ml-auto">
									{p.handCount} card{p.handCount === 1 ? "" : "s"}
								</span>
							</div>
						))}
					</div>
					{/* TODO: replace with Card/PlayerHand/GameBoard components */}
					<pre className="mt-4 text-xs text-green-400 overflow-x-auto">
						{JSON.stringify(gameState, null, 2)}
					</pre>
				</div>
			)}
		</div>
	);
}
