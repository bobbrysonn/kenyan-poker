import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
	isCardLegal,
	isBombCard,
	isRegularAce,
	isAceOfSpades,
	isSpecial,
} from "@kenyan-poker/engine";
import type { Card as CardType, Suit, Rank } from "@kenyan-poker/engine";
import { useGame } from "@/hooks/useGame";
import { Card } from "@/components/ui/Card";
import { ActionBar, type PendingAce } from "@/components/game/ActionBar";

export function GameRoom() {
	const { roomCode } = useParams<{ roomCode: string }>();
	const navigate = useNavigate();
	const {
		connectionStatus,
		players,
		isHost,
		gameState,
		winners,
		lastError,
		startGame,
		sendAction,
	} = useGame({ roomCode, onUnauthenticated: () => navigate("/login") });
	const [pendingAce, setPendingAce] = useState<PendingAce | null>(null);

	const handleCopyCode = () => {
		navigator.clipboard.writeText(roomCode || "");
	};

	const me = gameState?.players.find((p) => p.id === gameState.yourPlayerId);
	const isMyTurn = gameState ? gameState.currentPlayerIndex === gameState.yourPlayerId : false;

	function cardLegalForDisplay(card: CardType): boolean | undefined {
		if (!isMyTurn || !gameState) return undefined;
		if (gameState.bomb) {
			return isBombCard(card) || isRegularAce(card) || isAceOfSpades(card);
		}
		if (gameState.question) {
			return !isSpecial(card) && isCardLegal(card, gameState.topCard);
		}
		return isCardLegal(card, gameState.topCard);
	}

	function handleCardClick(card: CardType, index: number) {
		if (!gameState) return;
		if (gameState.bomb) {
			sendAction({ kind: "bomb_response", action: { kind: "counter", cardIndex: index } });
			return;
		}
		if (gameState.question) {
			sendAction({ kind: "answer", cardIndex: index, isAnswer: true });
			return;
		}
		if (isRegularAce(card) || isAceOfSpades(card)) {
			setPendingAce({ cardIndex: index, suit: null, rank: null });
			return;
		}
		sendAction({ kind: "play", cardIndex: index, declareCard: true });
	}

	function handlePick() {
		if (!gameState) return;
		if (gameState.bomb) {
			sendAction({ kind: "bomb_response", action: "pick" });
		} else if (gameState.question) {
			sendAction({ kind: "answer", cardIndex: -1, isAnswer: true });
		} else {
			sendAction({ kind: "pick" });
		}
	}

	function handleSetPendingAceField(field: "suit" | "rank", value: Suit | Rank) {
		setPendingAce((prev) => (prev ? { ...prev, [field]: value } : prev));
	}

	function handleConfirmAce() {
		if (!pendingAce || !pendingAce.suit || !pendingAce.rank) return;
		sendAction({
			kind: "play",
			cardIndex: pendingAce.cardIndex,
			declareCard: true,
			requestSuit: pendingAce.suit,
			requestRank: pendingAce.rank,
		} as any);
		setPendingAce(null);
	}

	function handleCancelAce() {
		setPendingAce(null);
	}

	return (
		<div className="min-h-screen bg-felt p-4">
			<header className="flex items-center justify-between mb-6">
				<div>
					<h1 className="text-2xl font-bold text-gold">🎴 Room: {roomCode}</h1>
					<div className="flex items-center gap-2 mt-1">
						<span
							className={`inline-block w-2 h-2 rounded-full ${connectionStatus === "connected" ? "bg-green-400" : "bg-red-400"}`}
						/>
						<span className="text-green-300 text-sm">{connectionStatus}</span>
					</div>
				</div>
				<div className="flex gap-3">
					<button
						onClick={handleCopyCode}
						className="text-green-400 hover:text-gold transition text-sm border border-green-700 rounded-lg px-3 py-1"
					>
						Copy Code
					</button>
					<button
						onClick={() => navigate("/")}
						className="text-green-400 hover:text-red-400 transition text-sm"
					>
						Leave
					</button>
				</div>
			</header>

			{lastError && (
				<p className="text-red-400 text-sm mb-4 bg-red-950/50 border border-red-700 rounded-lg px-4 py-2">
					{lastError}
				</p>
			)}

			{!gameState && (
				<div className="bg-felt-light rounded-xl p-6">
					<h2 className="text-lg font-semibold mb-4">
						Players ({players.length})
					</h2>
					{players.length === 0 ? (
						<p className="text-green-500 text-sm">
							Waiting for players to join...
						</p>
					) : (
						<div className="space-y-2">
							{players.map((p, i) => (
								<div
									key={p.playerId}
									className="flex items-center gap-3 bg-green-900/50 rounded-lg px-4 py-3"
								>
									<span className="text-gold font-bold w-6">{i + 1}.</span>
									<span className="text-white">{p.username}</span>
									<span className="text-green-500 text-xs ml-auto">
										Seat {p.seatIndex + 1}
									</span>
								</div>
							))}
						</div>
					)}

					{isHost && connectionStatus === "connected" && players.length >= 2 && (
						<button
							onClick={startGame}
							className="mt-6 bg-gold text-black px-6 py-3 rounded-lg font-bold hover:bg-yellow-500 transition w-full"
						>
							Start Game
						</button>
					)}
				</div>
			)}

			{gameState && (
				<div className="bg-felt-light rounded-xl p-6">
					<p className="text-green-300 text-sm mb-4">
						Direction: {gameState.direction} · Draw pile:{" "}
						{gameState.drawPileCount} · Discard pile: {gameState.discardPileCount}
					</p>

					{/* Opponents — TODO: replace with a dedicated OpponentsView component */}
					<div className="flex flex-wrap gap-3 mb-6">
						{gameState.players
							.filter((p) => p.id !== gameState.yourPlayerId)
							.map((p) => (
								<div
									key={p.userId}
									className={`flex items-center gap-2 rounded-lg px-4 py-2 ${
										p.id === gameState.currentPlayerIndex
											? "bg-gold/20 border border-gold"
											: "bg-green-900/50"
									}`}
								>
									<span className="text-white">{p.name}</span>
									<span className="text-green-500 text-xs">
										{p.handCount} card{p.handCount === 1 ? "" : "s"}
									</span>
								</div>
							))}
					</div>

					{/* Top card */}
					<div className="flex justify-center mb-6">
						<Card card={gameState.topCard} />
					</div>

					{winners && (
						<div className="text-center mb-6">
							<h2 className="text-gold text-xl font-bold mb-2">Game Over!</h2>
							{winners
								.sort((a, b) => a.placement - b.placement)
								.map((w) => (
									<p key={w.id} className="text-white">
										{w.placement}. {w.username}
									</p>
								))}
						</div>
					)}

					{isMyTurn && (
						<ActionBar
							gameState={gameState}
							isMyTurn={isMyTurn}
							pendingAce={pendingAce}
							onSetPendingAceField={handleSetPendingAceField}
							onConfirmAce={handleConfirmAce}
							onCancelAce={handleCancelAce}
							onBombPick={handlePick}
							onQuestionPick={handlePick}
						/>
					)}

					{/* My hand — TODO: replace with a dedicated PlayerHand component */}
					{me?.hand && (
						<div>
							<h3 className="text-green-300 text-sm mb-2">
								{isMyTurn ? "Your turn" : "Your hand"} ({me.hand.length} cards)
							</h3>
							<div className="flex flex-wrap gap-2">
								{me.hand.map((card, index) => (
									<Card
										key={index}
										card={card}
										legal={cardLegalForDisplay(card)}
										onClick={
											isMyTurn && !pendingAce
												? () => handleCardClick(card, index)
												: undefined
										}
									/>
								))}
							</div>
							{isMyTurn && !pendingAce && !gameState.bomb && !gameState.question && (
								<button
									onClick={handlePick}
									className="mt-4 text-green-400 hover:text-gold transition text-sm border border-green-700 rounded-lg px-4 py-2"
								>
									Pick a card
								</button>
							)}
						</div>
					)}
				</div>
			)}
		</div>
	);
}
