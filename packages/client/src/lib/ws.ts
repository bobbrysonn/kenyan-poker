import type { ClientMessage, ServerMessage } from "@/types";

export interface GameSocketHandlers {
	onOpen?: () => void;
	onMessage: (msg: ServerMessage) => void;
	onClose?: () => void;
	onError?: () => void;
}

export function connectGameSocket(
	wsUrl: string,
	token: string,
	roomCode: string,
	handlers: GameSocketHandlers,
): WebSocket {
	const url = `${wsUrl}?token=${encodeURIComponent(token)}&room=${encodeURIComponent(roomCode)}`;
	const ws = new WebSocket(url);

	ws.onopen = () => handlers.onOpen?.();
	ws.onclose = () => handlers.onClose?.();
	ws.onerror = () => handlers.onError?.();
	ws.onmessage = (event) => {
		try {
			const msg = JSON.parse(event.data) as ServerMessage;
			handlers.onMessage(msg);
		} catch {
			// Ignore malformed messages
		}
	};

	return ws;
}

export function sendGameMessage(ws: WebSocket, msg: ClientMessage): void {
	if (ws.readyState === WebSocket.OPEN) {
		ws.send(JSON.stringify(msg));
	}
}
