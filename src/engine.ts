import {
	type Card,
	type GameState,
	type Player,
	type Direction,
	type GameConfig,
	type PlayerAction,
	type ActionResult,
	isSpecial,
	isAceOfSpades,
	isRegularAce,
	cardColor,
	cardDisplay,
} from "./types.js";
import { createMultipleDecks, deal, drawStarter, drawCards } from "./deck.js";

// ── Helpers ─────────────────────────────────────────────────────────────────

function cloneState(state: GameState): GameState {
	return {
		...state,
		players: state.players.map((p) => ({ ...p, hand: [...p.hand] })),
		drawPile: [...state.drawPile],
		discardPile: [...state.discardPile],
		bomb: state.bomb ? { ...state.bomb } : null,
		question: state.question ? { ...state.question } : null,
		aceRequest: state.aceRequest ? { ...state.aceRequest } : null,
		aceOfSpadesUsedDefensive: new Set(state.aceOfSpadesUsedDefensive),
		aceOfSpadesUsedOffensive: new Set(state.aceOfSpadesUsedOffensive),
		playersOnVerge: new Set(state.playersOnVerge),
		failedDeclaration: new Set(state.failedDeclaration),
	};
}

function nextPlayerIndex(
	state: GameState,
	currentIndex: number,
	direction: Direction,
): number {
	const n = state.players.length;
	if (direction === "clockwise") {
		return (currentIndex + 1) % n;
	} else {
		return (currentIndex - 1 + n) % n;
	}
}

// ── Card legality ───────────────────────────────────────────────────────────

/** Check if a hand is "on the verge of winning" (≤ 2 cards with a non-special) */
function isHandOnVerge(hand: Card[]): boolean {
	if (hand.length === 0) return false;
	if (hand.length > 2) return false;
	return hand.some((c) => !isSpecial(c));
}

/** Apply verge-of-winning check after a play. If player is on the verge
 *  and didn't declare "card", penalize them. */
function applyVergeCheck(
	state: GameState,
	playerIndex: number,
	declared: boolean,
): void {
	const player = state.players[playerIndex];
	if (isHandOnVerge(player.hand)) {
		state.playersOnVerge.add(player.id);
		if (!declared) {
			state.failedDeclaration.add(player.id);
		}
	} else {
		state.playersOnVerge.delete(player.id);
	}
}

/**
 * Check if a card can legally be played on top of `topCard`.
 * Non-bomb context: must match suit, number, OR color (for jokers).
 */
export function isCardLegal(card: Card, topCard: Card): boolean {
	if (card.kind === "joker") {
		// Joker is legal when its color matches the top card's color
		return card.color === cardColor(topCard);
	}
	if (topCard.kind === "joker") {
		// Match against joker's color
		return cardColor(card) === topCard.color;
	}
	// Regular on regular: match suit or rank
	return card.suit === topCard.suit || card.rank === topCard.rank;
}

/** Check if a card is a bomb card (2, 3, or joker) */
export function isBombCard(card: Card): boolean {
	if (card.kind === "joker") return true;
	return card.rank === "2" || card.rank === "3";
}

/** Get bomb value for a card */
export function bombValue(card: Card): number {
	if (card.kind === "joker") return 5;
	if (card.rank === "2") return 2;
	if (card.rank === "3") return 3;
	return 0;
}

// ── Game initialization ─────────────────────────────────────────────────────

export function initGame(config: GameConfig): GameState {
	const playerCount = config.playerNames.length;
	const cardsPerPlayer = config.cardsPerPlayer ?? 5;

	// Auto-calculate deck count if not provided
	const threshold = config.playersPerDeckThreshold ?? 6;
	let deckCount = config.deckCount;
	if (deckCount == null) {
		deckCount = Math.max(1, Math.ceil(playerCount / threshold));
	}

	const fullDeck = createMultipleDecks(deckCount);
	const [hands, afterDeal] = deal(fullDeck, playerCount, cardsPerPlayer);

	const [starter, remainingDraw, burned] = drawStarter(afterDeal, isSpecial);

	const players: Player[] = config.playerNames.map((name, i) => ({
		id: i,
		name,
		hand: hands[i],
		cardless: false,
	}));

	// Random starting player
	const startIndex = Math.floor(Math.random() * playerCount);

	// Discard starts with the starter card on top, plus any burned specials below
	const discardPile = [...burned, starter];

	return {
		players,
		drawPile: remainingDraw,
		discardPile,
		topCard: starter,
		direction: "clockwise",
		currentPlayerIndex: startIndex,
		deckCount,
		cardsPerPlayer,
		bomb: null,
		question: null,
		aceRequest: null,
		aceOfSpadesUsedDefensive: new Set(),
		aceOfSpadesUsedOffensive: new Set(),
		winnerIds: [],
		gameOver: false,
		playersOnVerge: new Set(),
		failedDeclaration: new Set(),
	};
}

// ── State transitions ───────────────────────────────────────────────────────

/** After a card is played, apply its special effects and return updated state */
function applyCardPlay(
	state: GameState,
	playerId: number,
	card: Card,
	playerIndex: number,
): GameState {
	const s = cloneState(state);

	// Remove card from player's hand
	const player = s.players[playerIndex];
	// Find and remove the card (use index-based removal for duplicates)
	// The caller should pass cardIndex, but for simplicity we find by value
	const cardIdx = player.hand.findIndex(
		(c) =>
			c.kind === card.kind &&
			(c.kind === "joker"
				? card.kind === "joker" && c.color === (card as any).color
				: c.kind === "regular" &&
					card.kind === "regular" &&
					c.suit === (card as any).suit &&
					c.rank === (card as any).rank),
	);
	if (cardIdx !== -1) {
		player.hand.splice(cardIdx, 1);
	}

	// Add to discard pile
	s.discardPile.push(card);
	s.topCard = card;

	// Check for win (played last card that is non-special)
	if (player.hand.length === 0 && !isSpecial(card)) {
		// Block win if player failed to declare "card"
		if (!s.failedDeclaration.has(playerId)) {
			s.winnerIds.push(playerId);
			if (s.winnerIds.length === s.players.length - 1) {
				s.gameOver = true;
			}
		}
	}

	// Check for cardless (played last card that is special)
	if (player.hand.length === 0 && isSpecial(card)) {
		player.cardless = true;
	}

	// Apply card effects
	const rank = card.kind === "regular" ? card.rank : null;

	// Bomb cards (2, 3, joker) — initiate or add to bomb chain
	if (isBombCard(card)) {
		const val = bombValue(card);
		if (s.bomb) {
			// Chaining a bomb
			s.bomb.count += val;
		} else {
			s.bomb = { count: val, originPlayerId: playerId };
		}
	}

	// Question cards (8, Q)
	else if (rank === "8" || rank === "Q") {
		if (s.question) {
			s.question.chainCount += 1;
		} else {
			s.question = { chainCount: 1, playerId };
		}
	}

	// Jump (J)
	else if (rank === "J") {
		// Jump is handled by the turn processor — skip next player
		// We set a flag... actually let me handle this differently.
		// The J effect is immediate: skip next player.
		// We'll handle multi-J chaining in the turn processor.
		// For now, skip 1 player.
		const skipped = nextPlayerIndex(s, s.currentPlayerIndex, s.direction);
		// Store that we need to skip
		(s as any)._jumpSkip = skipped;
	}

	// Kickback (K)
	else if (rank === "K") {
		// Direction toggles per K. Single K: toggle and end turn.
		// Multiple K's handled by chaining in turn processor.
		s.direction =
			s.direction === "clockwise" ? "counterclockwise" : "clockwise";
	}

	// Ace of Spades
	else if (isAceOfSpades(card)) {
		// When played legally (not in bomb context), request suit AND number
		// The card itself is legal, so we set up the ace request
		// The suit/number request will be set by the caller based on player choice
		// For now, we just mark that A♠ was played
	}

	// Regular Ace (non-spades)
	else if (isRegularAce(card)) {
		// When played legally, can request suit OR number
		// Set up by caller
	}

	// Non-special card — nothing special
	return s;
}

/** Handle bomb resolution: player either picks cards or counters */
function resolveBomb(
	state: GameState,
	choice: "pick" | { kind: "counter"; card: Card; cardIndex: number },
): { state: GameState; turnEnds: boolean } {
	const s = cloneState(state);
	if (!s.bomb) return { state: s, turnEnds: true };

	if (choice === "pick") {
		// Pick the cumulative bomb count
		const [drawn, newDraw, newDiscard] = drawCards(
			s.bomb.count,
			s.drawPile,
			s.discardPile,
			s.topCard,
		);
		const player = s.players[s.currentPlayerIndex];
		player.hand.push(...drawn);
		s.drawPile = newDraw;
		s.discardPile = newDiscard;
		s.bomb = null;

		// Clear verge flags since hand grew
		s.playersOnVerge.delete(player.id);
		s.failedDeclaration.delete(player.id);

		return { state: s, turnEnds: true };
	}

	// Counter
	const { card, cardIndex } = choice;

	if (isBombCard(card)) {
		// Add to bomb chain
		s.bomb.count += bombValue(card);
		// Remove card from hand
		const player = s.players[s.currentPlayerIndex];
		player.hand.splice(cardIndex, 1);
		s.discardPile.push(card);
		s.topCard = card;

		// Update verge flags after playing a counter card
		applyVergeCheck(s, s.currentPlayerIndex, false);

		// Check for cardless
		if (player.hand.length === 0 && isSpecial(card)) {
			player.cardless = true;
		}
		return { state: s, turnEnds: true };
	}

	if (card.kind === "regular" && card.rank === "A") {
		// Ace stops the bomb
		const player = s.players[s.currentPlayerIndex];
		player.hand.splice(cardIndex, 1);
		s.discardPile.push(card);
		s.topCard = card;
		s.bomb = null;

		// Update verge flags after playing Ace to counter
		applyVergeCheck(s, s.currentPlayerIndex, false);

		// A♠ when used defensively: can still request suit OR number
		if (isAceOfSpades(card)) {
			s.aceOfSpadesUsedDefensive.add(player.id);
			// Don't set aceRequest here — the calling code should handle it via extended action
		}

		// Check for cardless/win
		if (player.hand.length === 0) {
			if (isSpecial(card)) {
				player.cardless = true;
			} else {
				s.winnerIds.push(player.id);
			}
		}

		return { state: s, turnEnds: true };
	}

	// Invalid counter card
	return { state, turnEnds: false };
}

/** Resolve question: player answers with non-special card or picks */
function resolveQuestion(
	state: GameState,
	choice: "pick" | { kind: "answer"; card: Card; cardIndex: number },
): { state: GameState; success: boolean; message: string } {
	const s = cloneState(state);
	if (!s.question) return { state: s, success: true, message: "" };

	if (choice === "pick") {
		// Pick a card from the draw pile
		const [drawn, newDraw, newDiscard] = drawCards(
			1,
			s.drawPile,
			s.discardPile,
			s.topCard,
		);
		const player = s.players[s.currentPlayerIndex];
		player.hand.push(...drawn);
		s.drawPile = newDraw;
		s.discardPile = newDiscard;
		s.question = null;

		// Clear verge flags since hand grew
		s.playersOnVerge.delete(player.id);
		s.failedDeclaration.delete(player.id);

		return { state: s, success: true, message: "Picked a card" };
	}

	const { card, cardIndex } = choice;

	// Must be non-special AND legal
	if (isSpecial(card)) {
		return { state: s, success: false, message: "Answer must be non-special" };
	}

	// For question answers, we check legality against the top card
	// (the 8 or Q that was played is now the top card)
	if (!isCardLegal(card, s.topCard)) {
		return {
			state: s,
			success: false,
			message: "Answer must match suit or number",
		};
	}

	const player = s.players[s.currentPlayerIndex];
	player.hand.splice(cardIndex, 1);
	s.discardPile.push(card);
	s.topCard = card;

	// Update verge flags after card removal
	applyVergeCheck(s, s.currentPlayerIndex, true); // answers can't declare, just cleanup

	// Check for win (answered with non-special last card)
	if (player.hand.length === 0) {
		s.winnerIds.push(player.id);
	}

	s.question = null;
	return { state: s, success: true, message: "Answered successfully" };
}

// ── Main turn processor ─────────────────────────────────────────────────────

export function processAction(
	state: GameState,
	action: PlayerAction,
): ActionResult {
	let s = cloneState(state);
	const player = s.players[s.currentPlayerIndex];
	const playerId = player.id;

	// ── 1. Cardless check ─────────────────────────────────────────────────
	if (player.cardless) {
		const [drawn, newDraw, newDiscard] = drawCards(
			1,
			s.drawPile,
			s.discardPile,
			s.topCard,
		);
		player.hand.push(...drawn);
		s.drawPile = newDraw;
		s.discardPile = newDiscard;
		player.cardless = false;

		// Clear verge flags since hand grew
		s.playersOnVerge.delete(player.id);
		s.failedDeclaration.delete(player.id);
		// They just drew 1 card — if it's non-special, they can now potentially win
		// But the rule says: "no one can win that round until the cardless user picks up
		// a card from the extra pile during his round." So they can only win on a
		// SUBSEQUENT turn after picking up.

		s.currentPlayerIndex = nextPlayerIndex(
			s,
			s.currentPlayerIndex,
			s.direction,
		);
		return {
			success: true,
			message: `${player.name} picked a card (was cardless)`,
			newState: s,
		};
	}

	// ── 2. Bomb response ──────────────────────────────────────────────────
	if (s.bomb) {
		if (action.kind !== "bomb_response") {
			return {
				success: false,
				message: "You are being bombed! Respond with bomb_response",
				newState: s,
			};
		}

		const choice = action.action === "pick" ? "pick" : undefined;
		const counterCard = choice
			? undefined
			: (() => {
					const ca = action.action as { kind: "counter"; cardIndex: number };
					return { card: player.hand[ca.cardIndex], cardIndex: ca.cardIndex };
				})();

		const result = resolveBomb(
			s,
			choice === "pick" ? "pick" : { kind: "counter", ...counterCard! },
		);

		if (!result.turnEnds) {
			return {
				success: false,
				message: "Invalid bomb response",
				newState: state,
			};
		}

		s = result.state;
		// After bomb resolution, advance to next player
		s.currentPlayerIndex = nextPlayerIndex(
			s,
			s.currentPlayerIndex,
			s.direction,
		);
		return { success: true, message: "Bomb resolved", newState: s };
	}

	// ── 3. Question response ──────────────────────────────────────────────
	if (s.question && s.question.playerId === playerId) {
		if (action.kind !== "answer") {
			return {
				success: false,
				message: `You must answer ${s.question.chainCount} question(s)! Use 'answer' action`,
				newState: s,
			};
		}

		const result = resolveQuestion(
			s,
			action.cardIndex === -1
				? "pick"
				: {
						kind: "answer",
						card: player.hand[action.cardIndex],
						cardIndex: action.cardIndex,
					},
		);

		if (!result.success) {
			return { success: false, message: result.message, newState: state };
		}

		s = result.state;
		s.currentPlayerIndex = nextPlayerIndex(
			s,
			s.currentPlayerIndex,
			s.direction,
		);
		return { success: true, message: result.message, newState: s };
	}

	// ── 4. Normal turn ────────────────────────────────────────────────────
	if (action.kind === "pick") {
		// Pick from draw pile
		const [drawn, newDraw, newDiscard] = drawCards(
			1,
			s.drawPile,
			s.discardPile,
			s.topCard,
		);
		player.hand.push(...drawn);
		s.drawPile = newDraw;
		s.discardPile = newDiscard;

		// Clear verge flags since hand grew
		s.playersOnVerge.delete(player.id);
		s.failedDeclaration.delete(player.id);

		s.currentPlayerIndex = nextPlayerIndex(
			s,
			s.currentPlayerIndex,
			s.direction,
		);
		return {
			success: true,
			message: `${player.name} picked a card`,
			newState: s,
		};
	}

	if (action.kind === "play") {
		const card = player.hand[action.cardIndex];
		if (!card) {
			return { success: false, message: "Invalid card index", newState: state };
		}

		const rank = card.kind === "regular" ? card.rank : null;

		// ── A♠ special handling ───────────────────────────────────────────
		if (isAceOfSpades(card)) {
			// A♠ is always legal? Or must it match? Let me re-check...
			// "A user can place a legal ace of spades, to request any card"
			// "legal" implies it must match the top card. But A♠ has special powers
			// that might override. Based on user's description, I think A♠ must
			// be legal (match suit/number) like any other card, or be used defensively.
			// BUT: in some interpretations, A♠ might be a wildcard...
			// Let me check with the user's words: "A user can place a legal ace of
			// spades" — the word "legal" is key. It must match.
			if (!isCardLegal(card, s.topCard)) {
				return {
					success: false,
					message: "A♠ must match the top card suit or number",
					newState: state,
				};
			}

			// A♠ played legally: request suit AND number
			// But we need the player to specify what they want.
			// For now, if the action doesn't include ace specifics, we error.
			const aAction = action as any;
			if (!aAction.requestSuit || !aAction.requestRank) {
				return {
					success: false,
					message: "A♠ requires specifying requestSuit and requestRank",
					newState: state,
				};
			}

			s = applyCardPlay(s, playerId, card, s.currentPlayerIndex);

			applyVergeCheck(
				s,
				s.currentPlayerIndex,
				(action as any).declareCard ?? false,
			);

			s.aceRequest = {
				suit: aAction.requestSuit,
				rank: aAction.requestRank,
				active: true,
			};

			// Advance to next player (they must honor the request)
			s.currentPlayerIndex = nextPlayerIndex(
				s,
				s.currentPlayerIndex,
				s.direction,
			);
			return {
				success: true,
				message: `${player.name} played A♠ — requesting ${aAction.requestRank} of ${aAction.requestSuit}`,
				newState: s,
			};
		}

		// ── Regular Ace handling ───────────────────────────────────────────
		if (isRegularAce(card)) {
			if (!isCardLegal(card, s.topCard)) {
				return {
					success: false,
					message: "Ace must match top card suit or number",
					newState: state,
				};
			}

			const aAction = action as any;
			if (!aAction.requestSuit && !aAction.requestRank) {
				return {
					success: false,
					message: "Regular Ace requires specifying requestSuit OR requestRank",
					newState: state,
				};
			}

			s = applyCardPlay(s, playerId, card, s.currentPlayerIndex);

			applyVergeCheck(
				s,
				s.currentPlayerIndex,
				(action as any).declareCard ?? false,
			);

			s.aceRequest = {
				suit: aAction.requestSuit,
				rank: aAction.requestRank,
				active: true,
			};

			s.currentPlayerIndex = nextPlayerIndex(
				s,
				s.currentPlayerIndex,
				s.direction,
			);
			return {
				success: true,
				message: `${player.name} played Ace — requesting ${aAction.requestRank || aAction.requestSuit}`,
				newState: s,
			};
		}

		// ── J (Jump) handling ──────────────────────────────────────────────
		if (rank === "J") {
			if (!isCardLegal(card, s.topCard)) {
				return {
					success: false,
					message: "J must match top card suit or number",
					newState: state,
				};
			}

			// Count how many J's are being chained
			const jAction = action as any;
			const jCount = jAction.chainJCount ?? 1;

			// Remove the J cards from hand
			let cardsRemoved = 0;
			const indicesToRemove: number[] = [];
			for (let i = 0; i < player.hand.length && cardsRemoved < jCount; i++) {
				const c = player.hand[i];
				if (c.kind === "regular" && c.rank === "J") {
					indicesToRemove.push(i);
					cardsRemoved++;
				}
			}

			// Remove in reverse order to preserve indices
			for (const idx of indicesToRemove.reverse()) {
				const removed = player.hand.splice(idx, 1)[0];
				s.discardPile.push(removed);
			}

			// Top card is the last J played
			s.topCard = s.discardPile[s.discardPile.length - 1];

			applyVergeCheck(
				s,
				s.currentPlayerIndex,
				(action as any).declareCard ?? false,
			);

			// Skip jCount players: advance past current, then skip jCount more
			let nextIdx = nextPlayerIndex(s, s.currentPlayerIndex, s.direction);
			for (let i = 0; i < jCount; i++) {
				nextIdx = nextPlayerIndex(s, nextIdx, s.direction);
			}
			s.currentPlayerIndex = nextIdx;

			return {
				success: true,
				message: `${player.name} jumped ${jCount} player(s)`,
				newState: s,
			};
		}

		// ── K (Kickback) handling ──────────────────────────────────────────
		if (rank === "K") {
			if (!isCardLegal(card, s.topCard)) {
				return {
					success: false,
					message: "K must match top card suit or number",
					newState: state,
				};
			}

			// Count chained K's
			const kAction = action as any;
			const kCount = kAction.chainKCount ?? 1;

			// Remove K cards
			let kRemoved = 0;
			const kIndices: number[] = [];
			for (let i = 0; i < player.hand.length && kRemoved < kCount; i++) {
				const c = player.hand[i];
				if (c.kind === "regular" && c.rank === "K") {
					kIndices.push(i);
					kRemoved++;
				}
			}
			for (const idx of kIndices.reverse()) {
				const removed = player.hand.splice(idx, 1)[0];
				s.discardPile.push(removed);
			}
			s.topCard = s.discardPile[s.discardPile.length - 1];

			applyVergeCheck(
				s,
				s.currentPlayerIndex,
				(action as any).declareCard ?? false,
			);

			if (kCount % 2 === 0) {
				// Even K's: direction doesn't change, player plays again
				// (currentPlayerIndex stays the same)
				return {
					success: true,
					message: `${player.name} played ${kCount} K's (even) — plays again`,
					newState: s,
				};
			} else {
				// Odd K's: direction changes, next player in new direction
				s.direction =
					s.direction === "clockwise" ? "counterclockwise" : "clockwise";
				s.currentPlayerIndex = nextPlayerIndex(
					s,
					s.currentPlayerIndex,
					s.direction,
				);
				return {
					success: true,
					message: `${player.name} played ${kCount} K(s) — direction reversed to ${s.direction}`,
					newState: s,
				};
			}
		}

		// ── 8/Q (Question) handling ────────────────────────────────────────
		if (rank === "8" || rank === "Q") {
			if (!isCardLegal(card, s.topCard)) {
				return {
					success: false,
					message: `${rank} must match top card suit or number`,
					newState: state,
				};
			}

			// Count chained 8s and Qs
			const qAction = action as any;
			const chainCount = qAction.chainQuestionCount ?? 1;

			let qRemoved = 0;
			const qIndices: number[] = [];
			for (let i = 0; i < player.hand.length && qRemoved < chainCount; i++) {
				const c = player.hand[i];
				if (c.kind === "regular" && (c.rank === "8" || c.rank === "Q")) {
					qIndices.push(i);
					qRemoved++;
				}
			}
			for (const idx of qIndices.reverse()) {
				const removed = player.hand.splice(idx, 1)[0];
				s.discardPile.push(removed);
			}
			s.topCard = s.discardPile[s.discardPile.length - 1];

			applyVergeCheck(
				s,
				s.currentPlayerIndex,
				(action as any).declareCard ?? false,
			);

			// Check cardless
			if (player.hand.length === 0) {
				// All played cards were special (8/Q)
				player.cardless = true;
				s.currentPlayerIndex = nextPlayerIndex(
					s,
					s.currentPlayerIndex,
					s.direction,
				);
				return {
					success: true,
					message: `${player.name} is cardless after playing ${rank}`,
					newState: s,
				};
			}

			s.question = { chainCount, playerId };
			// Player stays — they must now answer
			return {
				success: true,
				message: `${player.name} played ${chainCount} question(s) — must answer with non-special card`,
				newState: s,
			};
		}

		// ── 2/3 (Bomb) handling ────────────────────────────────────────────
		if (isBombCard(card)) {
			if (!isCardLegal(card, s.topCard)) {
				return {
					success: false,
					message: "Bomb card must match top card suit or number",
					newState: state,
				};
			}

			s = applyCardPlay(s, playerId, card, s.currentPlayerIndex);

			applyVergeCheck(
				s,
				s.currentPlayerIndex,
				(action as any).declareCard ?? false,
			);

			// Bomb is set up — next player must respond
			s.currentPlayerIndex = nextPlayerIndex(
				s,
				s.currentPlayerIndex,
				s.direction,
			);
			return {
				success: true,
				message: `${player.name} dropped a bomb (${bombValue(card)} cards)!`,
				newState: s,
			};
		}

		// ── Joker handling ─────────────────────────────────────────────────
		if (card.kind === "joker") {
			if (!isCardLegal(card, s.topCard)) {
				return {
					success: false,
					message: "Joker color must match top card color",
					newState: state,
				};
			}

			s = applyCardPlay(s, playerId, card, s.currentPlayerIndex);

			applyVergeCheck(
				s,
				s.currentPlayerIndex,
				(action as any).declareCard ?? false,
			);

			s.currentPlayerIndex = nextPlayerIndex(
				s,
				s.currentPlayerIndex,
				s.direction,
			);
			return {
				success: true,
				message: `${player.name} played a ${card.color} Joker (bomb +5)!`,
				newState: s,
			};
		}

		// ── Normal card ────────────────────────────────────────────────────
		if (!isCardLegal(card, s.topCard)) {
			return {
				success: false,
				message: `${cardDisplay(card)} doesn't match ${cardDisplay(s.topCard)}`,
				newState: state,
			};
		}

		s = applyCardPlay(s, playerId, card, s.currentPlayerIndex);

		applyVergeCheck(
			s,
			s.currentPlayerIndex,
			(action as any).declareCard ?? false,
		);

		// Re-get player after state mutation
		const updatedPlayer = s.players[s.currentPlayerIndex];

		// Check win
		if (s.winnerIds.includes(playerId)) {
			s.currentPlayerIndex = nextPlayerIndex(
				s,
				s.currentPlayerIndex,
				s.direction,
			);
			return { success: true, message: `${player.name} wins!`, newState: s };
		}

		// If player failed to declare but has 0 cards (non-special last),
		// they can't win — force them to pick a card
		if (updatedPlayer.hand.length === 0 && s.failedDeclaration.has(playerId)) {
			const [drawn, newDraw, newDiscard] = drawCards(
				1,
				s.drawPile,
				s.discardPile,
				s.topCard,
			);
			updatedPlayer.hand.push(...drawn);
			s.drawPile = newDraw;
			s.discardPile = newDiscard;
			s.failedDeclaration.delete(playerId); // Reset after penalty
			s.playersOnVerge.delete(playerId);
			s.currentPlayerIndex = nextPlayerIndex(
				s,
				s.currentPlayerIndex,
				s.direction,
			);
			return {
				success: true,
				message: `${player.name} was penalized — failed to declare "card"! Picks 1 card.`,
				newState: s,
			};
		}

		s.currentPlayerIndex = nextPlayerIndex(
			s,
			s.currentPlayerIndex,
			s.direction,
		);
		return {
			success: true,
			message: `${player.name} played ${cardDisplay(card)}`,
			newState: s,
		};
	}

	return { success: false, message: "Unknown action", newState: state };
}

// ── Public API ──────────────────────────────────────────────────────────────

export function getCurrentPlayer(state: GameState): Player {
	return state.players[state.currentPlayerIndex];
}

export function getLegalCards(
	state: GameState,
): { card: Card; index: number; legal: boolean }[] {
	return state.players[state.currentPlayerIndex].hand.map((card, index) => ({
		card,
		index,
		legal: isCardLegal(card, state.topCard),
	}));
}

/** Get a summary of the game state for display */
export function getStateSummary(state: GameState): string {
	const cp = getCurrentPlayer(state);
	const lines: string[] = [];

	lines.push(`Top card: ${cardDisplay(state.topCard)}`);
	lines.push(`Direction: ${state.direction}`);
	lines.push(`Draw pile: ${state.drawPile.length} cards`);
	lines.push(`Discard pile: ${state.discardPile.length} cards`);
	lines.push(`Current player: ${cp.name} (${cp.hand.length} cards)`);

	if (state.bomb) {
		lines.push(
			`⚠️  BOMB active: ${state.bomb.count} cards targeting ${cp.name}`,
		);
	}
	if (state.question) {
		const qp = state.players[state.question.playerId];
		lines.push(
			`❓ QUESTIONS: ${state.question.chainCount} pending — ${qp.name} must answer`,
		);
	}
	if (state.aceRequest?.active) {
		lines.push(
			`🅰️  ACE REQUEST: ${state.aceRequest.rank ?? "?"} of ${state.aceRequest.suit ?? "?"}`,
		);
	}

	if (state.winnerIds.length > 0) {
		const names = state.winnerIds.map((id) => state.players[id].name);
		lines.push(`🏆 Winners: ${names.join(", ")}`);
	}

	const cardless = state.players.filter((p) => p.cardless);
	if (cardless.length > 0) {
		lines.push(`🔄 Cardless: ${cardless.map((p) => p.name).join(", ")}`);
	}

	return lines.join("\n");
}
