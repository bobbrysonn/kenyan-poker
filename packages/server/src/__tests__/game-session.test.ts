import { describe, it, expect, beforeEach } from "vitest";
import { isCardLegal, isSpecial, type Card } from "@kenyan-poker/engine";
import * as session from "../game-session.js";

const ROOM_CODE = "TEST01";
const ROOM_ID = "00000000-0000-0000-0000-000000000001";

const HOST = { playerId: "host-user", seatIndex: 0, username: "Host" };
const GUEST = { playerId: "guest-user", seatIndex: 1, username: "Guest" };

describe("game-session", () => {
	beforeEach(() => {
		session.endSession(ROOM_CODE);
	});

	it("orders players by seatIndex regardless of input order", () => {
		const gameState = session.startSession(ROOM_CODE, ROOM_ID, [GUEST, HOST]);
		expect(gameState.players[0].name).toBe("Host");
		expect(gameState.players[1].name).toBe("Guest");
	});

	it("rejects actions from a user who isn't in the game", () => {
		session.startSession(ROOM_CODE, ROOM_ID, [HOST, GUEST]);
		const result = session.submitAction(ROOM_CODE, "stranger", { kind: "pick" });
		expect(result.ok).toBe(false);
		expect(result.message).toMatch(/not a player/i);
	});

	it("rejects actions from a player when it isn't their turn", () => {
		const gameState = session.startSession(ROOM_CODE, ROOM_ID, [HOST, GUEST]);
		const notTurnUserId =
			gameState.currentPlayerIndex === 0 ? GUEST.playerId : HOST.playerId;

		const result = session.submitAction(ROOM_CODE, notTurnUserId, { kind: "pick" });
		expect(result.ok).toBe(false);
		expect(result.message).toMatch(/not your turn/i);
	});

	it("accepts a legal action from the current player and advances the turn", () => {
		const gameState = session.startSession(ROOM_CODE, ROOM_ID, [HOST, GUEST]);
		const turnUserId =
			gameState.currentPlayerIndex === 0 ? HOST.playerId : GUEST.playerId;

		const result = session.submitAction(ROOM_CODE, turnUserId, { kind: "pick" });
		expect(result.ok).toBe(true);

		const stateAfter = session.getPublicState(ROOM_CODE, HOST.playerId)!;
		expect(stateAfter.currentPlayerIndex).not.toBe(gameState.currentPlayerIndex);
	});

	it("redacts other players' hands but exposes the viewer's own hand", () => {
		session.startSession(ROOM_CODE, ROOM_ID, [HOST, GUEST]);
		const hostView = session.getPublicState(ROOM_CODE, HOST.playerId)!;

		const self = hostView.players.find((p) => p.id === hostView.yourPlayerId)!;
		const other = hostView.players.find((p) => p.id !== hostView.yourPlayerId)!;

		expect(Array.isArray(self.hand)).toBe(true);
		expect(self.hand!.length).toBe(self.handCount);
		expect(other.hand).toBeUndefined();
		expect(other.handCount).toBeGreaterThan(0);
	});

	it("forceAutoAction plays a pick for the current player when no bomb/question is active", () => {
		const gameState = session.startSession(ROOM_CODE, ROOM_ID, [HOST, GUEST]);
		expect(gameState.bomb).toBeNull();
		expect(gameState.question).toBeNull();

		const result = session.forceAutoAction(ROOM_CODE);
		expect(result.ok).toBe(true);

		const stateAfter = session.getPublicState(ROOM_CODE, HOST.playerId)!;
		expect(stateAfter.currentPlayerIndex).not.toBe(gameState.currentPlayerIndex);
	});

	it("getFinalResults is null until the game is over", () => {
		session.startSession(ROOM_CODE, ROOM_ID, [HOST, GUEST]);
		expect(session.getFinalResults(ROOM_CODE)).toBeNull();
	});

	it("endSession removes the session", () => {
		session.startSession(ROOM_CODE, ROOM_ID, [HOST, GUEST]);
		expect(session.hasSession(ROOM_CODE)).toBe(true);
		session.endSession(ROOM_CODE);
		expect(session.hasSession(ROOM_CODE)).toBe(false);
	});

	it("playing a full game to completion produces valid final placements", () => {
		session.startSession(ROOM_CODE, ROOM_ID, [HOST, GUEST]);

		let guardRail = 0;
		while (!session.getPublicState(ROOM_CODE, HOST.playerId)!.gameOver) {
			guardRail += 1;
			if (guardRail > 5000) throw new Error("Game did not terminate in time");

			const state = session.getPublicState(ROOM_CODE, HOST.playerId)!;
			const turnUserId =
				state.currentPlayerIndex === HOST_INDEX(state) ? HOST.playerId : GUEST.playerId;
			const turnState = session.getPublicState(ROOM_CODE, turnUserId)!;
			const myHand = turnState.players.find((p) => p.id === turnState.yourPlayerId)!
				.hand as Card[];

			// Bomb/question responses need special action shapes; otherwise play
			// the first legal, non-bomb card if available, else pick.
			if (turnState.bomb) {
				session.submitAction(ROOM_CODE, turnUserId, {
					kind: "bomb_response",
					action: "pick",
				});
				continue;
			}
			if (turnState.question) {
				const answerIdx = myHand.findIndex(
					(c) => !isSpecial(c) && isCardLegal(c, turnState.topCard as Card),
				);
				session.submitAction(ROOM_CODE, turnUserId, {
					kind: "answer",
					cardIndex: answerIdx,
					isAnswer: true,
				});
				continue;
			}

			const isAce = (c: Card) => c.kind === "regular" && c.rank === "A";
			const topCard = turnState.topCard as Card;
			const legalCards = myHand
				.map((c, index) => ({ c, index }))
				.filter(({ c }) => isCardLegal(c, topCard));
			const nonAce = legalCards.find(({ c }) => !isAce(c));
			const ace = legalCards.find(({ c }) => isAce(c));

			if (nonAce) {
				session.submitAction(ROOM_CODE, turnUserId, {
					kind: "play",
					cardIndex: nonAce.index,
					declareCard: true,
				});
			} else if (ace) {
				session.submitAction(ROOM_CODE, turnUserId, {
					kind: "play",
					cardIndex: ace.index,
					declareCard: true,
					requestSuit: "hearts",
					requestRank: "4",
				} as any);
			} else {
				session.submitAction(ROOM_CODE, turnUserId, { kind: "pick" });
			}
		}

		const results = session.getFinalResults(ROOM_CODE)!;
		expect(results).not.toBeNull();
		expect(results).toHaveLength(2);
		const placements = results.map((r) => r.placement).sort();
		expect(placements).toEqual([1, 2]);
		for (const r of results) {
			expect(r.roomId).toBe(ROOM_ID);
			expect(r.turnsPlayed).toBeGreaterThan(0);
			expect(r.cardsRemaining).toBeGreaterThanOrEqual(0);
		}
	});
});

function HOST_INDEX(state: { players: { userId: string; id: number }[] }): number {
	return state.players.find((p) => p.userId === HOST.playerId)!.id;
}
