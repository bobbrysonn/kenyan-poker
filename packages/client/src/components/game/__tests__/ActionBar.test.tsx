import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ActionBar, type PendingAce } from "../ActionBar.js";
import type { PublicGameState } from "@/types";

const baseState: PublicGameState = {
	yourPlayerId: 0,
	players: [
		{ id: 0, userId: "me", name: "Me", handCount: 3, cardless: false },
		{ id: 1, userId: "them", name: "Them", handCount: 3, cardless: false },
	],
	topCard: { kind: "regular", suit: "hearts", rank: "4" },
	drawPileCount: 30,
	discardPileCount: 5,
	direction: "clockwise",
	currentPlayerIndex: 0,
	bomb: null,
	question: null,
	aceRequest: null,
	winnerIds: [],
	gameOver: false,
	playersOnVerge: [],
	failedDeclaration: [],
};

const noop = () => {};

describe("ActionBar", () => {
	it("renders nothing when there's no active prompt", () => {
		const { container } = render(
			<ActionBar
				gameState={baseState}
				isMyTurn={true}
				pendingAce={null}
				onSetPendingAceField={noop}
				onConfirmAce={noop}
				onCancelAce={noop}
				onBombPick={noop}
				onQuestionPick={noop}
			/>,
		);
		expect(container).toBeEmptyDOMElement();
	});

	it("shows a bomb prompt with the pick count when a bomb is active on my turn", () => {
		const onBombPick = vi.fn();
		render(
			<ActionBar
				gameState={{ ...baseState, bomb: { count: 4, originPlayerId: 1 } }}
				isMyTurn={true}
				pendingAce={null}
				onSetPendingAceField={noop}
				onConfirmAce={noop}
				onCancelAce={noop}
				onBombPick={onBombPick}
				onQuestionPick={noop}
			/>,
		);
		expect(screen.getByText(/Pick 4 cards, or counter/)).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Pick 4 cards" }));
		expect(onBombPick).toHaveBeenCalledOnce();
	});

	it("shows a question prompt when a question is active on my turn", () => {
		const onQuestionPick = vi.fn();
		render(
			<ActionBar
				gameState={{ ...baseState, question: { chainCount: 1, playerId: 0 } }}
				isMyTurn={true}
				pendingAce={null}
				onSetPendingAceField={noop}
				onConfirmAce={noop}
				onCancelAce={noop}
				onBombPick={noop}
				onQuestionPick={onQuestionPick}
			/>,
		);
		expect(screen.getByText(/Answer with a non-special card/)).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Pick a card" }));
		expect(onQuestionPick).toHaveBeenCalledOnce();
	});

	it("shows an informational banner when an ace request is active", () => {
		render(
			<ActionBar
				gameState={{
					...baseState,
					aceRequest: { suit: "spades", rank: "9", active: true },
				}}
				isMyTurn={false}
				pendingAce={null}
				onSetPendingAceField={noop}
				onConfirmAce={noop}
				onCancelAce={noop}
				onBombPick={noop}
				onQuestionPick={noop}
			/>,
		);
		expect(screen.getByText(/asked for 9 of spades/)).toBeInTheDocument();
	});

	it("disables Confirm until both suit and rank are chosen, then confirms", () => {
		const onConfirmAce = vi.fn();
		const onSetPendingAceField = vi.fn();
		const pendingAce: PendingAce = { cardIndex: 2, suit: null, rank: null };

		const { rerender } = render(
			<ActionBar
				gameState={baseState}
				isMyTurn={true}
				pendingAce={pendingAce}
				onSetPendingAceField={onSetPendingAceField}
				onConfirmAce={onConfirmAce}
				onCancelAce={noop}
				onBombPick={noop}
				onQuestionPick={noop}
			/>,
		);

		const confirmButton = screen.getByRole("button", { name: "Confirm Request" });
		expect(confirmButton).toBeDisabled();

		fireEvent.click(screen.getByRole("button", { name: "♥" }));
		expect(onSetPendingAceField).toHaveBeenCalledWith("suit", "hearts");

		rerender(
			<ActionBar
				gameState={baseState}
				isMyTurn={true}
				pendingAce={{ cardIndex: 2, suit: "hearts", rank: "9" }}
				onSetPendingAceField={onSetPendingAceField}
				onConfirmAce={onConfirmAce}
				onCancelAce={noop}
				onBombPick={noop}
				onQuestionPick={noop}
			/>,
		);
		const enabledConfirm = screen.getByRole("button", { name: "Confirm Request" });
		expect(enabledConfirm).toBeEnabled();
		fireEvent.click(enabledConfirm);
		expect(onConfirmAce).toHaveBeenCalledOnce();
	});

	it("cancel button invokes onCancelAce", () => {
		const onCancelAce = vi.fn();
		render(
			<ActionBar
				gameState={baseState}
				isMyTurn={true}
				pendingAce={{ cardIndex: 0, suit: null, rank: null }}
				onSetPendingAceField={noop}
				onConfirmAce={noop}
				onCancelAce={onCancelAce}
				onBombPick={noop}
				onQuestionPick={noop}
			/>,
		);
		fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
		expect(onCancelAce).toHaveBeenCalledOnce();
	});
});
