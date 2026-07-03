import type { Card as CardType } from "@kenyan-poker/engine";

const SUIT_SYMBOLS: Record<string, string> = {
	hearts: "♥",
	diamonds: "♦",
	clubs: "♣",
	spades: "♠",
};

interface CardProps {
	card: CardType;
	/** Omit for a non-interactive display card (e.g. the top-of-pile card). */
	legal?: boolean;
	onClick?: () => void;
	/** Render as a face-down card back (e.g. opponents' hands, draw pile). */
	faceDown?: boolean;
}

export function Card({ card, legal, onClick, faceDown }: CardProps) {
	if (faceDown) {
		return (
			<div
				className="card bg-felt-light border-gold flex items-center justify-center"
				aria-label="Face-down card"
			>
				<span className="text-gold text-2xl">🂠</span>
			</div>
		);
	}

	const legalityClass = legal === undefined ? "" : legal ? "card-legal" : "card-illegal";
	const clickable = !!onClick && legal !== false;

	if (card.kind === "joker") {
		const colorClass = card.color === "red" ? "card-red" : "card-black";
		return (
			<button
				type="button"
				onClick={onClick}
				disabled={!clickable}
				className={`card ${colorClass} border-dashed ${legalityClass}`}
				aria-label={`${card.color} Joker`}
			>
				<span className="text-[10px] font-bold">JOKER</span>
				<span className="text-2xl">🃏</span>
				<span className="text-[10px] font-bold rotate-180">JOKER</span>
			</button>
		);
	}

	const colorClass =
		card.suit === "hearts" || card.suit === "diamonds" ? "card-red" : "card-black";
	const symbol = SUIT_SYMBOLS[card.suit];

	return (
		<button
			type="button"
			onClick={onClick}
			disabled={!clickable}
			className={`card ${colorClass} ${legalityClass}`}
			aria-label={`${card.rank} of ${card.suit}`}
		>
			<span className="text-sm font-bold self-start">{card.rank}</span>
			<span className="text-3xl">{symbol}</span>
			<span className="text-sm font-bold self-end rotate-180">{card.rank}</span>
		</button>
	);
}
