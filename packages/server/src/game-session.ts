import {
	initGame,
	processAction,
	type Card,
	type GameState,
	type PlayerAction,
	type Direction,
	type BombState,
	type QuestionState,
	type AceRequestState,
} from "@kenyan-poker/engine";

const TURN_TIMEOUT_MS = 30_000;

interface RoomPlayerInput {
	playerId: string;
	seatIndex: number;
	username: string;
}

interface SessionRecord {
	roomId: string;
	gameState: GameState;
	userIdByPlayerId: string[];
	playerIdByUserId: Map<string, number>;
	turnsPlayed: number;
	turnTimer: ReturnType<typeof setTimeout> | null;
}

export interface PublicPlayerView {
	id: number;
	userId: string;
	name: string;
	handCount: number;
	hand?: Card[];
	cardless: boolean;
}

export interface PublicGameState {
	yourPlayerId: number;
	players: PublicPlayerView[];
	topCard: Card;
	drawPileCount: number;
	discardPileCount: number;
	direction: Direction;
	currentPlayerIndex: number;
	bomb: BombState | null;
	question: QuestionState | null;
	aceRequest: AceRequestState | null;
	winnerIds: number[];
	gameOver: boolean;
	playersOnVerge: number[];
	failedDeclaration: number[];
}

export type SubmitResult =
	| { ok: true; message: string }
	| { ok: false; message: string };

const sessions = new Map<string, SessionRecord>();

export function hasSession(roomCode: string): boolean {
	return sessions.has(roomCode);
}

export function startSession(
	roomCode: string,
	roomId: string,
	players: RoomPlayerInput[],
	config?: { cardsPerPlayer?: number | null; deckCount?: number | null },
): GameState {
	const ordered = [...players].sort((a, b) => a.seatIndex - b.seatIndex);

	const gameState = initGame({
		playerNames: ordered.map((p) => p.username),
		cardsPerPlayer: config?.cardsPerPlayer ?? undefined,
		deckCount: config?.deckCount ?? undefined,
	});

	const userIdByPlayerId = ordered.map((p) => p.playerId);
	const playerIdByUserId = new Map(
		ordered.map((p, index) => [p.playerId, index]),
	);

	sessions.set(roomCode, {
		roomId,
		gameState,
		userIdByPlayerId,
		playerIdByUserId,
		turnsPlayed: 0,
		turnTimer: null,
	});

	return gameState;
}

export function endSession(roomCode: string): void {
	clearTurnTimer(roomCode);
	sessions.delete(roomCode);
}

export function getCurrentTurnUserId(roomCode: string): string | null {
	const session = sessions.get(roomCode);
	if (!session) return null;
	return session.userIdByPlayerId[session.gameState.currentPlayerIndex] ?? null;
}

export function submitAction(
	roomCode: string,
	userId: string,
	action: PlayerAction,
): SubmitResult {
	const session = sessions.get(roomCode);
	if (!session) return { ok: false, message: "No active game in this room" };
	if (session.gameState.gameOver) {
		return { ok: false, message: "Game is already over" };
	}

	const playerId = session.playerIdByUserId.get(userId);
	if (playerId === undefined) {
		return { ok: false, message: "You are not a player in this game" };
	}
	if (playerId !== session.gameState.currentPlayerIndex) {
		return { ok: false, message: "It's not your turn" };
	}

	const result = processAction(session.gameState, action);
	if (!result.success) {
		return { ok: false, message: result.message };
	}

	session.gameState = result.newState;
	session.turnsPlayed += 1;
	return { ok: true, message: result.message };
}

/** Auto-play the appropriate action for whoever's turn it is (used on timer expiry). */
export function forceAutoAction(roomCode: string): SubmitResult {
	const session = sessions.get(roomCode);
	if (!session) return { ok: false, message: "No active game in this room" };
	if (session.gameState.gameOver) {
		return { ok: false, message: "Game is already over" };
	}

	const gs = session.gameState;
	const currentPlayer = gs.players[gs.currentPlayerIndex];

	let action: PlayerAction;
	if (gs.bomb) {
		action = { kind: "bomb_response", action: "pick" };
	} else if (gs.question && gs.question.playerId === currentPlayer.id) {
		action = { kind: "answer", cardIndex: -1, isAnswer: true };
	} else {
		action = { kind: "pick" };
	}

	const result = processAction(gs, action);
	if (!result.success) {
		// Should not normally happen — fall back to a plain pick.
		const fallback = processAction(gs, { kind: "pick" });
		session.gameState = fallback.newState;
		session.turnsPlayed += 1;
		return { ok: fallback.success, message: fallback.message };
	}

	session.gameState = result.newState;
	session.turnsPlayed += 1;
	return { ok: true, message: `(auto) ${result.message}` };
}

export function scheduleTurnTimer(roomCode: string, onTimeout: () => void): void {
	clearTurnTimer(roomCode);
	const session = sessions.get(roomCode);
	if (!session || session.gameState.gameOver) return;

	session.turnTimer = setTimeout(onTimeout, TURN_TIMEOUT_MS);
}

export function clearTurnTimer(roomCode: string): void {
	const session = sessions.get(roomCode);
	if (session?.turnTimer) {
		clearTimeout(session.turnTimer);
		session.turnTimer = null;
	}
}

export function getPublicState(
	roomCode: string,
	forUserId: string,
): PublicGameState | null {
	const session = sessions.get(roomCode);
	if (!session) return null;

	const gs = session.gameState;
	const yourPlayerId = session.playerIdByUserId.get(forUserId) ?? -1;

	return {
		yourPlayerId,
		players: gs.players.map((p, index) => ({
			id: p.id,
			userId: session.userIdByPlayerId[index],
			name: p.name,
			handCount: p.hand.length,
			hand: index === yourPlayerId ? p.hand : undefined,
			cardless: p.cardless,
		})),
		topCard: gs.topCard,
		drawPileCount: gs.drawPile.length,
		discardPileCount: gs.discardPile.length,
		direction: gs.direction,
		currentPlayerIndex: gs.currentPlayerIndex,
		bomb: gs.bomb,
		question: gs.question,
		aceRequest: gs.aceRequest,
		winnerIds: gs.winnerIds,
		gameOver: gs.gameOver,
		playersOnVerge: [...gs.playersOnVerge],
		failedDeclaration: [...gs.failedDeclaration],
	};
}

/** Final placements + per-player results for game_history, once gameOver is true. */
export function getFinalResults(roomCode: string): {
	roomId: string;
	playerId: string;
	placement: number;
	turnsPlayed: number;
	cardsRemaining: number;
}[] | null {
	const session = sessions.get(roomCode);
	if (!session || !session.gameState.gameOver) return null;

	const gs = session.gameState;
	const placementByEngineId = new Map<number, number>();
	gs.winnerIds.forEach((id, index) => placementByEngineId.set(id, index + 1));

	const lastPlace = gs.players.length;
	gs.players.forEach((p) => {
		if (!placementByEngineId.has(p.id)) placementByEngineId.set(p.id, lastPlace);
	});

	return gs.players.map((p, index) => ({
		roomId: session.roomId,
		playerId: session.userIdByPlayerId[index],
		placement: placementByEngineId.get(p.id)!,
		turnsPlayed: session.turnsPlayed,
		cardsRemaining: p.hand.length,
	}));
}
