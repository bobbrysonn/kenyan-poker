import { SUITS, RANKS } from "@kenyan-poker/engine";
import type { Suit, Rank } from "@kenyan-poker/engine";
import type { PublicGameState } from "@/types";

const SUIT_SYMBOLS: Record<Suit, string> = {
	hearts: "♥",
	diamonds: "♦",
	clubs: "♣",
	spades: "♠",
};

export interface PendingAce {
	cardIndex: number;
	suit: Suit | null;
	rank: Rank | null;
}

interface ActionBarProps {
	gameState: PublicGameState;
	isMyTurn: boolean;
	pendingAce: PendingAce | null;
	onSetPendingAceField: (field: "suit" | "rank", value: Suit | Rank) => void;
	onConfirmAce: () => void;
	onCancelAce: () => void;
	onBombPick: () => void;
	onQuestionPick: () => void;
}

export function ActionBar({
	gameState,
	isMyTurn,
	pendingAce,
	onSetPendingAceField,
	onConfirmAce,
	onCancelAce,
	onBombPick,
	onQuestionPick,
}: ActionBarProps) {
	if (pendingAce) {
		const canConfirm = pendingAce.suit !== null && pendingAce.rank !== null;
		return (
			<div className="bg-purple-950/40 border border-purple-500 rounded-lg px-4 py-3 mb-4">
				<p className="text-purple-200 text-sm mb-3">
					🅰️ Ace played — request a card for the next player
				</p>
				<div className="flex flex-wrap gap-2 mb-2">
					{SUITS.map((suit) => (
						<button
							key={suit}
							onClick={() => onSetPendingAceField("suit", suit)}
							aria-pressed={pendingAce.suit === suit}
							className={`px-3 py-1 rounded-lg border text-lg ${
								pendingAce.suit === suit
									? "bg-gold border-gold text-black"
									: "border-purple-500 text-purple-200"
							}`}
						>
							{SUIT_SYMBOLS[suit]}
						</button>
					))}
				</div>
				<div className="flex flex-wrap gap-2 mb-3">
					{RANKS.map((rank) => (
						<button
							key={rank}
							onClick={() => onSetPendingAceField("rank", rank)}
							aria-pressed={pendingAce.rank === rank}
							className={`px-2 py-1 rounded-lg border text-sm ${
								pendingAce.rank === rank
									? "bg-gold border-gold text-black"
									: "border-purple-500 text-purple-200"
							}`}
						>
							{rank}
						</button>
					))}
				</div>
				<div className="flex gap-2">
					<button
						onClick={onConfirmAce}
						disabled={!canConfirm}
						className="bg-gold text-black px-4 py-2 rounded-lg font-bold disabled:opacity-40 disabled:cursor-not-allowed"
					>
						Confirm Request
					</button>
					<button
						onClick={onCancelAce}
						className="text-purple-200 border border-purple-500 px-4 py-2 rounded-lg"
					>
						Cancel
					</button>
				</div>
			</div>
		);
	}

	if (isMyTurn && gameState.bomb) {
		return (
			<div className="bg-red-950/40 border border-red-500 rounded-lg px-4 py-3 mb-4 flex items-center justify-between">
				<p className="text-red-300 text-sm">
					💣 Pick {gameState.bomb.count} cards, or counter with a bomb/Ace card
				</p>
				<button
					onClick={onBombPick}
					className="text-red-200 border border-red-500 rounded-lg px-4 py-2 text-sm shrink-0"
				>
					Pick {gameState.bomb.count} cards
				</button>
			</div>
		);
	}

	if (isMyTurn && gameState.question) {
		return (
			<div className="bg-purple-950/40 border border-purple-500 rounded-lg px-4 py-3 mb-4 flex items-center justify-between">
				<p className="text-purple-200 text-sm">
					❓ Answer with a non-special card, or pick
				</p>
				<button
					onClick={onQuestionPick}
					className="text-purple-200 border border-purple-500 rounded-lg px-4 py-2 text-sm shrink-0"
				>
					Pick a card
				</button>
			</div>
		);
	}

	if (gameState.aceRequest?.active) {
		return (
			<div className="bg-purple-950/30 border border-purple-700 rounded-lg px-4 py-2 mb-4">
				<p className="text-purple-300 text-sm">
					🅰️ Ace request active — next player asked for{" "}
					{gameState.aceRequest.rank ?? "any rank"} of{" "}
					{gameState.aceRequest.suit ?? "any suit"}
				</p>
			</div>
		);
	}

	return null;
}
