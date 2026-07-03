import type {
	Card,
	Direction,
	BombState,
	QuestionState,
	AceRequestState,
	PlayerAction,
} from "@kenyan-poker/engine";

export interface RoomPlayer {
	playerId: string;
	seatIndex: number;
	username: string;
}

// Mirrors packages/server/src/game-session.ts PublicGameState.
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

export interface WinnerEntry {
	id: string;
	username: string;
	placement: number;
}

export type ServerMessage =
	| { type: "room_state"; hostId: string; players: RoomPlayer[] }
	| { type: "player_joined"; player: RoomPlayer }
	| { type: "player_left"; playerId: string }
	| { type: "game_started"; starterPlayerIndex: number }
	| { type: "game_state"; state: PublicGameState }
	| { type: "game_over"; winners: WinnerEntry[] }
	| { type: "action_result"; success: boolean; message: string }
	| { type: "error"; message: string }
	| { type: "chat"; from: string; username: string; message: string };

export type ClientMessage =
	| { type: "action"; action: PlayerAction }
	| { type: "start_game" }
	| { type: "chat"; message: string };
