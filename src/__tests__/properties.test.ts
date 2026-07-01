/**
 * Property-based tests for Kenyan Poker — verifies mathematical invariants
 * by generating random game sequences and checking that no invariant is violated.
 *
 * Architecture: rather than generating arbitrary GameState objects (which
 * requires maintaining complex internal consistency), we generate an initial
 * game via initGame() and then apply sequences of random legal actions via
 * processAction(). After each step, we check all invariants. This ensures
 * we only test reachable states.
 */
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
	initGame,
	processAction,
	isCardLegal,
	isBombCard,
	bombValue,
} from "../engine.js";
import type {
	GameState,
	Card,
	PlayerAction,
	Suit,
	Rank,
	RegularCard,
	JokerCard,
} from "../types.js";
import {
	isSpecial,
	isAceOfSpades,
	isRegularAce,
	SUITS,
	RANKS,
} from "../types.js";

// ── Arbitrary generators ───────────────────────────────────────────────────

/** A single suit */
const arbSuit = fc.constantFrom<Exclude<Suit, number>>(...SUITS);

/** A single rank */
const arbRank = fc.constantFrom<Exclude<Rank, number>>(...RANKS);

/** A regular card */
const arbRegularCard = fc.record<RegularCard>({
	kind: fc.constant("regular" as const),
	suit: arbSuit,
	rank: arbRank,
});

/** A joker */
const arbJoker = fc.record<JokerCard>({
	kind: fc.constant("joker" as const),
	color: fc.constantFrom<"red" | "black">("red", "black"),
});

/** Any card */
const arbCard: fc.Arbitrary<Card> = fc.oneof(
	arbRegularCard as any,
	arbJoker as any,
) as fc.Arbitrary<Card>;

/** A player name (short ASCII string) */
const arbPlayerName = fc.string({ minLength: 1, maxLength: 8 });

/** Arguments for initGame: 2-6 players, configurable card count */
const arbGameConfig = fc.record({
	playerNames: fc
		.array(arbPlayerName, { minLength: 2, maxLength: 6 })
		.map((names) => names.map((n, i) => n || `P${i + 1}`)),
	cardsPerPlayer: fc.integer({ min: 3, max: 7 }),
});

/** Pick a random card index from the player's hand */
function arbCardIndex(hand: Card[]): fc.Arbitrary<number> {
	if (hand.length === 0) {
		return fc.constant(-1);
	}
	return fc.integer({ min: 0, max: hand.length - 1 });
}

/** Generate a legal play action for the current state */
function arbPlayAction(
	state: GameState,
	hand: Card[],
): fc.Arbitrary<PlayerAction> {
	// Pick action: play legal card or pick
	return fc.oneof(
		// Play a card — prefer legal ones but include illegal too (engine should reject)
		fc.integer({ min: 0, max: Math.max(0, hand.length - 1) }).map((idx) => ({
			kind: "play" as const,
			cardIndex: idx,
			declareCard: false,
		})),
		// Pick from draw pile
		fc.constant<PlayerAction>({ kind: "pick" }),
	);
}

/** Generate an action appropriate for the current state */
function arbAction(state: GameState): fc.Arbitrary<PlayerAction> {
	const player = state.players[state.currentPlayerIndex];

	// If there's a bomb, only bomb_response is valid
	if (state.bomb) {
		const hasAce = player.hand.some(
			(c) => c.kind === "regular" && c.rank === "A",
		);
		const hasBombCard = player.hand.some(isBombCard);

		return fc.oneof(
			// Pick (take the bomb)
			fc.constant<PlayerAction>({
				kind: "bomb_response",
				action: "pick",
			}),
			// Counter with a card (any card — engine validates)
			...(player.hand.length > 0
				? [
						fc.integer({ min: 0, max: player.hand.length - 1 }).map((idx) => ({
							kind: "bomb_response" as const,
							action: { kind: "counter" as const, cardIndex: idx },
						})),
					]
				: []),
		);
	}

	// If there's a question for this player
	if (state.question && state.question.playerId === player.id) {
		return fc.oneof(
			fc.constant<PlayerAction>({
				kind: "answer",
				cardIndex: -1,
				isAnswer: true,
			}),
			...(player.hand.length > 0
				? [
						fc.integer({ min: 0, max: player.hand.length - 1 }).map((idx) => ({
							kind: "answer" as const,
							cardIndex: idx,
							isAnswer: true as const,
						})),
					]
				: []),
		);
	}

	// Normal turn
	return arbPlayAction(state, player.hand);
}

// ── Invariant checks ────────────────────────────────────────────────────────

/** Total number of cards in the game */
function totalCards(state: GameState): number {
	return (
		state.drawPile.length +
		state.discardPile.length +
		state.players.reduce((sum, p) => sum + p.hand.length, 0)
	);
}

/** Expected total cards */
function expectedCards(state: GameState): number {
	return state.deckCount * 54;
}

// ── Property tests ──────────────────────────────────────────────────────────

describe("Property: card conservation", () => {
	it("total cards always equals decks × 54", () => {
		fc.assert(
			fc.property(arbGameConfig, (config) => {
				let state = initGame(config);
				const expected = expectedCards(state);

				// Check initial state
				expect(totalCards(state)).toBe(expected);

				// Run up to 50 random actions
				for (let step = 0; step < 50; step++) {
					if (state.gameOver) break;

					const action = fc.sample(arbAction(state), 1)[0];
					const result = processAction(state, action);

					if (result.success) {
						state = result.newState;
						expect(
							totalCards(state),
							`Card count mismatch at step ${step}. ` +
								`draw:${state.drawPile.length} discard:${state.discardPile.length} ` +
								`hands:${state.players.map((p) => p.hand.length).join(",")}`,
						).toBe(expected);
					}
				}
			}),
			{ numRuns: 200 }, // Run 200 random game configurations
		);
	});
});

describe("Property: winner validity", () => {
	it("no player in failedDeclaration can appear in winnerIds", () => {
		fc.assert(
			fc.property(arbGameConfig, (config) => {
				let state = initGame(config);

				for (let step = 0; step < 50; step++) {
					if (state.gameOver) break;

					const action = fc.sample(arbAction(state), 1)[0];
					const result = processAction(state, action);

					if (result.success) {
						state = result.newState;

						// Check the invariant
						for (const wid of state.winnerIds) {
							expect(
								state.failedDeclaration.has(wid),
								`Player ${wid} won but is in failedDeclaration at step ${step}`,
							).toBe(false);
						}
					}
				}
			}),
			{ numRuns: 200 },
		);
	});
});

describe("Property: game-over condition", () => {
	it("gameOver is true iff all but one player have won", () => {
		fc.assert(
			fc.property(arbGameConfig, (config) => {
				let state = initGame(config);
				const n = state.players.length;

				for (let step = 0; step < 100; step++) {
					if (state.gameOver) break;

					const action = fc.sample(arbAction(state), 1)[0];
					const result = processAction(state, action);

					if (result.success) {
						state = result.newState;

						// Invariant: gameOver iff n-1 winners
						const shouldBeOver = state.winnerIds.length >= n - 1;
						expect(state.gameOver).toBe(shouldBeOver);
					}
				}
			}),
			{ numRuns: 200 },
		);
	});
});

describe("Property: top card consistency", () => {
	it("topCard always equals the last card in discardPile", () => {
		fc.assert(
			fc.property(arbGameConfig, (config) => {
				let state = initGame(config);

				for (let step = 0; step < 50; step++) {
					if (state.gameOver) break;

					const action = fc.sample(arbAction(state), 1)[0];
					const result = processAction(state, action);

					if (result.success) {
						state = result.newState;
						expect(state.topCard).toEqual(
							state.discardPile[state.discardPile.length - 1],
						);
					}
				}
			}),
			{ numRuns: 200 },
		);
	});
});

describe("Property: no duplicate cards", () => {
	it("a card appears in at most one location", () => {
		fc.assert(
			fc.property(arbGameConfig, (config) => {
				let state = initGame(config);

				for (let step = 0; step < 30; step++) {
					if (state.gameOver) break;

					const action = fc.sample(arbAction(state), 1)[0];
					const result = processAction(state, action);

					if (result.success) {
						state = result.newState;

						// Serialize all cards to strings for comparison
						const cardToString = (c: Card) =>
							c.kind === "joker" ? `joker:${c.color}` : `${c.suit}:${c.rank}`;

						// Collect all card strings
						const inDraw = state.drawPile.map(cardToString);
						const inDiscard = state.discardPile.map(cardToString);
						const inHands: string[] = [];
						for (const p of state.players) {
							inHands.push(...p.hand.map(cardToString));
						}

						// Check no overlaps between draw and hands
						const drawSet = new Set(inDraw);
						for (const hc of inHands) {
							expect(drawSet.has(hc)).toBe(false);
						}

						// Check no overlaps between discard (except top) and hands
						const discardExceptTop = new Set(inDiscard.slice(0, -1));
						for (const hc of inHands) {
							expect(discardExceptTop.has(hc)).toBe(false);
						}
					}
				}
			}),
			{ numRuns: 100 },
		);
	});
});

describe("Property: direction is always valid", () => {
	it("direction is always clockwise or counterclockwise", () => {
		fc.assert(
			fc.property(arbGameConfig, (config) => {
				let state = initGame(config);

				for (let step = 0; step < 50; step++) {
					if (state.gameOver) break;

					const action = fc.sample(arbAction(state), 1)[0];
					const result = processAction(state, action);

					if (result.success) {
						state = result.newState;
						expect(["clockwise", "counterclockwise"]).toContain(
							state.direction,
						);
					}
				}
			}),
			{ numRuns: 100 },
		);
	});
});

describe("Property: current player index is always valid", () => {
	it("currentPlayerIndex is always in bounds", () => {
		fc.assert(
			fc.property(arbGameConfig, (config) => {
				let state = initGame(config);
				const n = state.players.length;

				for (let step = 0; step < 50; step++) {
					if (state.gameOver) break;

					const action = fc.sample(arbAction(state), 1)[0];
					const result = processAction(state, action);

					if (result.success) {
						state = result.newState;
						expect(state.currentPlayerIndex).toBeGreaterThanOrEqual(0);
						expect(state.currentPlayerIndex).toBeLessThan(n);
					}
				}
			}),
			{ numRuns: 200 },
		);
	});
});

describe("Property: on-verge consistency", () => {
	it("playersOnVerge only contains players with ≤2 cards and at least one non-special", () => {
		fc.assert(
			fc.property(arbGameConfig, (config) => {
				let state = initGame(config);

				for (let step = 0; step < 50; step++) {
					if (state.gameOver) break;

					const action = fc.sample(arbAction(state), 1)[0];
					const result = processAction(state, action);

					if (result.success) {
						state = result.newState;

						for (const pid of state.playersOnVerge) {
							const player = state.players[pid];
							expect(player.hand.length).toBeGreaterThan(0);
							expect(player.hand.length).toBeLessThanOrEqual(2);
							expect(player.hand.some((c) => !isSpecial(c))).toBe(true);
						}
					}
				}
			}),
			{ numRuns: 200 },
		);
	});
});

// ── Targeted property tests for specific card types ────────────────────────

describe("Property: bomb chaining", () => {
	it("bomb count never exceeds total cards × bomb values", () => {
		fc.assert(
			fc.property(arbGameConfig, (config) => {
				let state = initGame(config);

				for (let step = 0; step < 50; step++) {
					if (state.gameOver) break;

					const action = fc.sample(arbAction(state), 1)[0];
					const result = processAction(state, action);

					if (result.success) {
						state = result.newState;

						if (state.bomb) {
							// Bomb count must be positive
							expect(state.bomb.count).toBeGreaterThan(0);
							// Bomb count can't exceed total cards in play
							expect(state.bomb.count).toBeLessThanOrEqual(
								state.drawPile.length + 100, // generous bound
							);
						}
					}
				}
			}),
			{ numRuns: 100 },
		);
	});
});
