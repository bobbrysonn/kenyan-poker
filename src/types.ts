// ── Card types ──────────────────────────────────────────────────────────────

export type Suit = "hearts" | "diamonds" | "clubs" | "spades";

export type Rank =
	| "A"
	| "2"
	| "3"
	| "4"
	| "5"
	| "6"
	| "7"
	| "8"
	| "9"
	| "10"
	| "J"
	| "Q"
	| "K";

export type JokerColor = "red" | "black";

export interface RegularCard {
	kind: "regular";
	suit: Suit;
	rank: Rank;
}

export interface JokerCard {
	kind: "joker";
	color: JokerColor;
}

export type Card = RegularCard | JokerCard;

// ── Helpers ─────────────────────────────────────────────────────────────────

export const SUITS: Suit[] = ["hearts", "diamonds", "clubs", "spades"];
export const RANKS: Rank[] = [
	"A",
	"2",
	"3",
	"4",
	"5",
	"6",
	"7",
	"8",
	"9",
	"10",
	"J",
	"Q",
	"K",
];

/** Cards that are "special" —  can't win with these as last card */
const SPECIAL_RANKS: Set<Rank> = new Set(["A", "2", "3", "8", "J", "Q", "K"]);

export function isSpecial(card: Card): boolean {
	if (card.kind === "joker") return true;
	return SPECIAL_RANKS.has(card.rank);
}

export function cardColor(card: Card): "red" | "black" {
	if (card.kind === "joker") return card.color;
	return card.suit === "hearts" || card.suit === "diamonds" ? "red" : "black";
}

export function cardDisplay(card: Card): string {
	if (card.kind === "joker") return `🃏 ${card.color} Joker`;
	const suitSymbols: Record<Suit, string> = {
		hearts: "♥",
		diamonds: "♦",
		clubs: "♣",
		spades: "♠",
	};
	return `${card.rank}${suitSymbols[card.suit]}`;
}

export function isAceOfSpades(card: Card): boolean {
	return card.kind === "regular" && card.suit === "spades" && card.rank === "A";
}

/** Is this an Ace that's NOT the Ace of Spades? */
export function isRegularAce(card: Card): boolean {
	return card.kind === "regular" && card.rank === "A" && card.suit !== "spades";
}

// ── Game direction ──────────────────────────────────────────────────────────

export type Direction = "clockwise" | "counterclockwise";

// ── Player ──────────────────────────────────────────────────────────────────

export interface Player {
	id: number;
	name: string;
	hand: Card[];
	/** True if the player has no cards but played a special card as their last */
	cardless: boolean;
}

// ── Game state ──────────────────────────────────────────────────────────────

export interface BombState {
	/** Total cards the current target must pick (cumulative) */
	count: number;
	/** Who initiated this bomb chain (chains get credited to them in some variants) */
	originPlayerId: number;
}

export interface QuestionState {
	/** Number of consecutive 8/Q played (pending answer) */
	chainCount: number;
	/** Which player must answer */
	playerId: number;
}

export interface AceRequestState {
	/** The suit requested by A♠ (or undefined if only number was requested) */
	suit?: Suit;
	/** The number/rank requested by A♠ (or undefined if only suit was requested) */
	rank?: Rank;
	/** Active until the requested card is played or everyone passes */
	active: boolean;
}

export interface GameState {
	players: Player[];
	drawPile: Card[];
	discardPile: Card[];
	/** The top card of the discard pile — what players must match */
	topCard: Card;
	direction: Direction;
	currentPlayerIndex: number;
	/** The number of decks used */
	deckCount: number;
	cardsPerPlayer: number;

	// Active special state
	bomb: BombState | null;
	question: QuestionState | null;
	aceRequest: AceRequestState | null;

	// A♠ tracking (a player's A♠ can be used once defensively + once offensively)
	// Track which players have used their A♠ power this round
	aceOfSpadesUsedDefensive: Set<number>;
	aceOfSpadesUsedOffensive: Set<number>;

	// Game-over info
	winnerIds: number[];
	gameOver: boolean;

	// "Card" declaration (UNO-style): players who are on the verge of winning
	// and MUST declare "card" on their next turn, or be penalized
	playersOnVerge: Set<number>;
	/** Players who failed to declare — they cannot win this round */
	failedDeclaration: Set<number>;
}

// ── Actions players can take ────────────────────────────────────────────────

export type PlayerAction =
	| { kind: "play"; cardIndex: number; declareCard?: boolean }
	| { kind: "pick" }
	| { kind: "answer"; cardIndex: number; isAnswer: true }
	| {
			kind: "bomb_response";
			action: "pick" | { kind: "counter"; cardIndex: number };
	  }
	| {
			kind: "ace_request_response";
			action: "play" | "pick";
			cardIndex?: number;
	  };

// ── Action results ──────────────────────────────────────────────────────────

export interface ActionResult {
	success: boolean;
	message: string;
	newState: GameState;
}

// ── Config ──────────────────────────────────────────────────────────────────

export interface GameConfig {
	playerNames: string[];
	cardsPerPlayer?: number; // default 5
	deckCount?: number; // auto-calculated if not provided
	/** Auto-add decks when players exceed threshold per deck */
	playersPerDeckThreshold?: number; // default 6
}
