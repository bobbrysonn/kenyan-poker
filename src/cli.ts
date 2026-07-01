import * as readline from "node:readline";
import { initGame, processAction, getCurrentPlayer } from "./engine.js";
import {
	cardDisplay,
	isSpecial,
	isAceOfSpades,
	isRegularAce,
} from "./types.js";
import type { GameState, PlayerAction, Card } from "./types.js";

// ── Terminal colors ─────────────────────────────────────────────────────────

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const BLUE = "\x1b[34m";
const MAGENTA = "\x1b[35m";
const CYAN = "\x1b[36m";

function red(s: string) {
	return RED + s + RESET;
}
function green(s: string) {
	return GREEN + s + RESET;
}
function yellow(s: string) {
	return YELLOW + s + RESET;
}
function blue(s: string) {
	return BLUE + s + RESET;
}
function magenta(s: string) {
	return MAGENTA + s + RESET;
}
function cyan(s: string) {
	return CYAN + s + RESET;
}
function bold(s: string) {
	return BOLD + s + RESET;
}
function dim(s: string) {
	return DIM + s + RESET;
}

// ── Readline ────────────────────────────────────────────────────────────────

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
});

function question(prompt: string): Promise<string> {
	return new Promise((resolve) => rl.question(prompt, resolve));
}

// ── Display helpers ─────────────────────────────────────────────────────────

function clearScreen() {
	process.stdout.write("\x1b[2J\x1b[H");
}

function displayGameState(state: GameState) {
	const cp = getCurrentPlayer(state);

	console.log();
	console.log(bold("═══════════════════════════════════════"));
	console.log(
		`  ${bold(cp.name)}'s turn  |  ${dim("Direction:")} ${state.direction}`,
	);
	console.log(`  ${dim("Top card:")} ${bold(cardDisplay(state.topCard))}`);
	console.log();

	// Active states
	if (state.bomb) {
		console.log(
			`  ${red("💣 BOMB!")} Pick ${bold(String(state.bomb.count))} cards or counter!`,
		);
	}
	if (state.question) {
		const qp = state.players[state.question.playerId];
		console.log(
			`  ${magenta("❓ QUESTION!")} ${qp.name} must answer with non-special card`,
		);
	}
	if (state.aceRequest?.active) {
		const req = state.aceRequest;
		if (req.rank && req.suit) {
			console.log(`  ${cyan("🅰️  ACE REQUEST:")} ${req.rank} of ${req.suit}`);
		} else if (req.rank) {
			console.log(`  ${cyan("🅰️  ACE REQUEST:")} rank ${req.rank}`);
		} else if (req.suit) {
			console.log(`  ${cyan("🅰️  ACE REQUEST:")} suit ${req.suit}`);
		}
	}

	// Players summary
	console.log();
	console.log(bold("── Players ──"));
	for (const p of state.players) {
		const verge =
			state.playersOnVerge.has(p.id) && !state.winnerIds.includes(p.id)
				? yellow(" 📢 CARD!")
				: "";
		const failed = state.failedDeclaration.has(p.id) ? red(" ⚠️ MISSED!") : "";
		const marker = p.cardless ? yellow(" [CARDLESS]") : "";
		const winner = state.winnerIds.includes(p.id) ? green(" 🏆 WINNER") : "";
		const turn = p.id === cp.id ? blue(" ◀") : "";
		console.log(
			`  ${p.name}: ${p.hand.length} cards${marker}${winner}${verge}${failed}${turn}`,
		);
	}
	console.log();
	console.log(
		`  ${dim("Draw pile:")} ${state.drawPile.length}  ${dim("Discard:")} ${state.discardPile.length}`,
	);
	console.log(bold("═══════════════════════════════════════"));
	console.log();
}

function displayYourHand(cards: Card[], topCard: Card) {
	console.log(bold("Your hand:"));
	for (let i = 0; i < cards.length; i++) {
		const card = cards[i];
		// Check legality (using simple inline check)
		let legal = true;
		if (card.kind === "joker") {
			const topColor =
				topCard.kind === "joker"
					? topCard.color
					: topCard.suit === "hearts" || topCard.suit === "diamonds"
						? "red"
						: "black";
			legal = card.color === topColor;
		} else if (topCard.kind === "joker") {
			const cardCol =
				card.suit === "hearts" || card.suit === "diamonds" ? "red" : "black";
			legal = cardCol === topCard.color;
		} else {
			legal = card.suit === topCard.suit || card.rank === topCard.rank;
		}

		const marker = legal ? green("✓") : red("✗");
		const special = isSpecial(card)
			? yellow(
					` [${card.kind === "joker" ? "BOMB+5" : card.kind === "regular" ? card.rank : "?"}]`,
				)
			: "";
		console.log(`  [${i}] ${marker} ${cardDisplay(card)}${special}`);
	}
}

// ── Input parsing ───────────────────────────────────────────────────────────

/** Check if a hand will be on the verge of winning after removing N cards */
function willBeOnVerge(hand: Card[], removeCount: number): boolean {
	const remaining = hand.length - removeCount;
	if (remaining <= 0 || remaining > 2) return false;
	// Check if remaining cards include at least one non-special
	// We need to know WHICH cards remain — approximate by checking hand
	const specialCount = hand.filter((c) => isSpecial(c)).length;
	const nonSpecialCount = hand.length - specialCount;
	return nonSpecialCount - Math.max(0, removeCount - specialCount) >= 1;
}

async function promptDeclareCard(
	hand: Card[],
	removeCount: number,
): Promise<boolean> {
	if (!willBeOnVerge(hand, removeCount)) return false;
	console.log();
	console.log(yellow(bold("⚠️  You're on the verge of winning!")));
	const answer = await question('  Declare "card"? (y/n): ');
	return answer.trim().toLowerCase() === "y";
}

async function getAction(state: GameState): Promise<PlayerAction> {
	const cp = getCurrentPlayer(state);
	const hand = cp.hand;

	// If being bombed
	if (state.bomb) {
		console.log();
		console.log(
			red(
				bold(
					`You're being bombed! Pick up ${state.bomb.count} cards or counter (2, 3, joker, Ace).`,
				),
			),
		);
		const input = await question('  Counter with card index, or "pick": ');
		if (input.trim().toLowerCase() === "pick") {
			return { kind: "bomb_response", action: "pick" };
		}
		const idx = parseInt(input.trim(), 10);
		if (isNaN(idx) || idx < 0 || idx >= hand.length) {
			console.log(red("  Invalid index!"));
			return getAction(state);
		}
		return {
			kind: "bomb_response",
			action: { kind: "counter", cardIndex: idx },
		};
	}

	// If must answer question
	if (state.question && state.question.playerId === cp.id) {
		console.log();
		console.log(
			magenta(
				bold(
					`You must answer ${state.question.chainCount} question(s)! Play a non-special card or pick.`,
				),
			),
		);
		const input = await question('  Play card index, or "pick": ');
		if (input.trim().toLowerCase() === "pick") {
			return { kind: "answer", cardIndex: -1, isAnswer: true };
		}
		const idx = parseInt(input.trim(), 10);
		if (isNaN(idx) || idx < 0 || idx >= hand.length) {
			console.log(red("  Invalid index!"));
			return getAction(state);
		}
		return { kind: "answer", cardIndex: idx, isAnswer: true };
	}

	// Normal turn
	console.log();
	displayYourHand(hand, state.topCard);
	console.log();
	const input = await question('  Play card index, or "pick": ');
	if (input.trim().toLowerCase() === "pick") {
		return { kind: "pick" };
	}

	const idx = parseInt(input.trim(), 10);
	if (isNaN(idx) || idx < 0 || idx >= hand.length) {
		console.log(red("  Invalid index!"));
		return getAction(state);
	}

	const card = hand[idx];

	// Special card handling — ask for additional info
	if (isAceOfSpades(card)) {
		const dc = await promptDeclareCard(hand, 1);
		return await handleAcePlay(idx, true, dc);
	}

	if (isRegularAce(card)) {
		const dc = await promptDeclareCard(hand, 1);
		return await handleAcePlay(idx, false, dc);
	}

	// J chaining
	if (card.kind === "regular" && card.rank === "J") {
		const jInHand = hand.filter(
			(c) => c.kind === "regular" && c.rank === "J",
		).length;
		if (jInHand > 1) {
			console.log(`  You have ${jInHand} J's. How many to chain?`);
			const countStr = await question(`  Count (1-${jInHand}): `);
			const count = parseInt(countStr.trim(), 10);
			if (!isNaN(count) && count >= 1 && count <= jInHand) {
				const dc = await promptDeclareCard(hand, count);
				return {
					kind: "play",
					cardIndex: idx,
					chainJCount: count,
					declareCard: dc,
				} as any;
			}
		}
	}

	// K chaining
	if (card.kind === "regular" && card.rank === "K") {
		const kInHand = hand.filter(
			(c) => c.kind === "regular" && c.rank === "K",
		).length;
		if (kInHand > 1) {
			console.log(`  You have ${kInHand} K's. How many to chain?`);
			const countStr = await question(`  Count (1-${kInHand}): `);
			const count = parseInt(countStr.trim(), 10);
			if (!isNaN(count) && count >= 1 && count <= kInHand) {
				const dc = await promptDeclareCard(hand, count);
				return {
					kind: "play",
					cardIndex: idx,
					chainKCount: count,
					declareCard: dc,
				} as any;
			}
		}
	}

	// 8/Q chaining
	if (card.kind === "regular" && (card.rank === "8" || card.rank === "Q")) {
		const qInHand = hand.filter(
			(c) => c.kind === "regular" && (c.rank === "8" || c.rank === "Q"),
		).length;
		if (qInHand > 1) {
			console.log(`  You have ${qInHand} 8's and Q's. How many to chain?`);
			const countStr = await question(`  Count (1-${qInHand}): `);
			const count = parseInt(countStr.trim(), 10);
			if (!isNaN(count) && count >= 1 && count <= qInHand) {
				const dc = await promptDeclareCard(hand, count);
				return {
					kind: "play",
					cardIndex: idx,
					chainQuestionCount: count,
					declareCard: dc,
				} as any;
			}
		}
	}

	const dc = await promptDeclareCard(hand, 1);
	return { kind: "play", cardIndex: idx, declareCard: dc };
}

async function handleAcePlay(
	cardIndex: number,
	isSpades: boolean,
	declareCard: boolean,
): Promise<PlayerAction> {
	console.log();
	if (isSpades) {
		console.log(cyan(bold("A♠ played! You can request suit AND number.")));
		const suit = await question(
			"  Request suit (hearts/diamonds/clubs/spades): ",
		);
		const rank = await question(
			"  Request rank (A/2/3/4/5/6/7/8/9/10/J/Q/K): ",
		);
		if (
			["hearts", "diamonds", "clubs", "spades"].includes(suit.trim()) &&
			[
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
			].includes(rank.trim().toUpperCase())
		) {
			return {
				kind: "play",
				cardIndex,
				requestSuit: suit.trim(),
				requestRank: rank.trim().toUpperCase(),
				declareCard,
			} as any;
		}
		console.log(red("  Invalid suit or rank!"));
		return handleAcePlay(cardIndex, isSpades, declareCard);
	} else {
		console.log(cyan(bold("Ace played! Request suit OR number (not both).")));
		const choice = await question('  Request "suit" or "rank"? ');
		if (choice.trim().toLowerCase() === "suit") {
			const suit = await question(
				"  Which suit (hearts/diamonds/clubs/spades)? ",
			);
			if (["hearts", "diamonds", "clubs", "spades"].includes(suit.trim())) {
				return {
					kind: "play",
					cardIndex,
					requestSuit: suit.trim(),
					declareCard,
				} as any;
			}
		} else if (choice.trim().toLowerCase() === "rank") {
			const rank = await question(
				"  Which rank (A/2/3/4/5/6/7/8/9/10/J/Q/K)? ",
			);
			if (
				[
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
				].includes(rank.trim().toUpperCase())
			) {
				return {
					kind: "play",
					cardIndex,
					requestRank: rank.trim().toUpperCase(),
				} as any;
			}
		}
		console.log(red("  Invalid choice!"));
		return handleAcePlay(cardIndex, isSpades, declareCard);
	}
}

// ── Main game loop ──────────────────────────────────────────────────────────

async function main() {
	console.log(bold(green("\n🎴 KENYAN POKER 🎴\n")));

	// Setup
	const playerCountStr = await question("How many players? ");
	const playerCount = parseInt(playerCountStr.trim(), 10);
	if (isNaN(playerCount) || playerCount < 2) {
		console.log(red("Need at least 2 players!"));
		rl.close();
		return;
	}

	const names: string[] = [];
	for (let i = 0; i < playerCount; i++) {
		const name = await question(`Player ${i + 1} name: `);
		names.push(name.trim() || `Player ${i + 1}`);
	}

	const cardsStr = await question("Cards per player (default 5): ");
	const cardsPerPlayer = parseInt(cardsStr.trim(), 10) || 5;

	// Init game
	let state = initGame({ playerNames: names, cardsPerPlayer });

	// Game loop
	while (!state.gameOver) {
		clearScreen();

		// Cardless auto-pick
		const cp = getCurrentPlayer(state);
		if (cp.cardless) {
			console.log(yellow(`\n${cp.name} is cardless — auto-picking a card...`));
			await question("Press Enter to continue...");
			const result = processAction(state, { kind: "pick" });
			state = result.newState;
			console.log(green(`  ${result.message}`));
			continue;
		}

		displayGameState(state);

		let result;
		try {
			const action = await getAction(state);
			result = processAction(state, action);
		} catch (e) {
			console.log(red(`Error: ${e}`));
			await question("Press Enter to continue...");
			continue;
		}

		if (!result.success) {
			console.log(red(`\n  ${result.message}`));
			await question("Press Enter to try again...");
			continue;
		}

		console.log(green(`\n  ${result.message}`));
		state = result.newState;

		if (state.gameOver) {
			clearScreen();
			console.log(bold(green("\n🏆 GAME OVER! 🏆\n")));
			const winners = state.winnerIds.map((id) => state.players[id].name);
			console.log(`  Winners: ${winners.join(", ")}`);
			const last = state.players.find((p) => !state.winnerIds.includes(p.id));
			if (last) {
				console.log(`  Loser: ${red(last.name)} 😢`);
			}
			break;
		}

		await question("\nPress Enter for next turn...");
	}

	rl.close();
}

main().catch(console.error);
