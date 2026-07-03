import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { connectGameSocket, sendGameMessage } from "@/lib/ws";
import type { PlayerAction } from "@kenyan-poker/engine";
import type { PublicGameState, RoomPlayer, WinnerEntry } from "@/types";

type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

interface UseGameOptions {
	roomCode: string | undefined;
	onUnauthenticated: () => void;
}

export function useGame({ roomCode, onUnauthenticated }: UseGameOptions) {
	const [connectionStatus, setConnectionStatus] =
		useState<ConnectionStatus>("connecting");
	const [players, setPlayers] = useState<RoomPlayer[]>([]);
	const [hostId, setHostId] = useState<string | null>(null);
	const [userId, setUserId] = useState<string | null>(null);
	const [gameState, setGameState] = useState<PublicGameState | null>(null);
	const [winners, setWinners] = useState<WinnerEntry[] | null>(null);
	const [lastError, setLastError] = useState<string | null>(null);
	const wsRef = useRef<WebSocket | null>(null);

	// Keep the latest callback without making the connect effect depend on
	// its identity — GameRoom passes a fresh arrow function every render,
	// which would otherwise tear down and reconnect the socket on every
	// state update.
	const onUnauthenticatedRef = useRef(onUnauthenticated);
	onUnauthenticatedRef.current = onUnauthenticated;

	useEffect(() => {
		if (!roomCode) return;
		let cancelled = false;

		async function connect() {
			const {
				data: { session },
			} = await supabase.auth.getSession();
			if (!session?.access_token) {
				onUnauthenticatedRef.current();
				return;
			}
			if (cancelled) return;
			setUserId(session.user.id);

			const wsUrl = import.meta.env.VITE_WS_URL || "ws://localhost:3001/ws";
			const ws = connectGameSocket(wsUrl, session.access_token, roomCode!, {
				onOpen: () => setConnectionStatus("connected"),
				onClose: () => setConnectionStatus("disconnected"),
				onError: () => setConnectionStatus("error"),
				onMessage: (msg) => {
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
							setWinners(null);
							break;
						case "game_state":
							setGameState(msg.state);
							break;
						case "game_over":
							setWinners(msg.winners);
							break;
						case "action_result":
							setLastError(msg.success ? null : msg.message);
							break;
						case "error":
							setLastError(msg.message);
							break;
						case "chat":
							break;
					}
				},
			});
			wsRef.current = ws;
		}

		connect();
		return () => {
			cancelled = true;
			wsRef.current?.close();
			wsRef.current = null;
		};
	}, [roomCode]);

	const startGame = useCallback(() => {
		if (wsRef.current) sendGameMessage(wsRef.current, { type: "start_game" });
	}, []);

	const sendAction = useCallback((action: PlayerAction) => {
		if (wsRef.current) sendGameMessage(wsRef.current, { type: "action", action });
	}, []);

	const isHost = !!userId && userId === hostId;

	return {
		connectionStatus,
		players,
		hostId,
		userId,
		isHost,
		gameState,
		winners,
		lastError,
		startGame,
		sendAction,
	};
}
