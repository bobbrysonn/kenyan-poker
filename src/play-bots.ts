import { initGame, processAction, isCardLegal, isBombCard } from './engine.js';
import { cardDisplay, isSpecial } from './types.js';
import type { GameState, PlayerAction, Card } from './types.js';

// ── Smarter bot ────────────────────────────────────────────────────────────

function findWinningPlay(hand: Card[], topCard: Card): number {
  // Find a non-special card that's legal and would empty the hand
  for (let i = 0; i < hand.length; i++) {
    const c = hand[i];
    if (!isSpecial(c) && isCardLegal(c, topCard)) {
      return i;
    }
  }
  return -1;
}

function botAction(state: GameState): PlayerAction {
  const player = state.players[state.currentPlayerIndex];
  const hand = player.hand;
  const topCard = state.topCard;

  // ── Bomb response ───────────────────────────────────────────────────
  if (state.bomb) {
    const hasBomb = hand.some(isBombCard);
    const hasAce = hand.some((c) => c.kind === 'regular' && c.rank === 'A');

    // If hand is small (<3 cards), just pick — don't fight
    if (hand.length <= 2) {
      return { kind: 'bomb_response', action: 'pick' };
    }

    // Use Ace to stop if available (60% chance)
    if (hasAce && Math.random() < 0.6) {
      const aceIdx = hand.findIndex((c) => c.kind === 'regular' && c.rank === 'A');
      return { kind: 'bomb_response', action: { kind: 'counter', cardIndex: aceIdx } };
    }
    // Counter with bomb if available (30% chance)
    if (hasBomb && Math.random() < 0.3) {
      const bombIdx = hand.findIndex(isBombCard);
      return { kind: 'bomb_response', action: { kind: 'counter', cardIndex: bombIdx } };
    }
    return { kind: 'bomb_response', action: 'pick' };
  }

  // ── Question response ───────────────────────────────────────────────
  if (state.question && state.question.playerId === player.id) {
    const nonSpecial = hand.findIndex(
      (c) => !isSpecial(c) && isCardLegal(c, topCard)
    );
    if (nonSpecial >= 0 && Math.random() < 0.8) {
      return { kind: 'answer', cardIndex: nonSpecial, isAnswer: true };
    }
    return { kind: 'answer', cardIndex: -1, isAnswer: true };
  }

  // ── Normal turn: prefer winning plays ───────────────────────────────
  // Priority 1: Win immediately with a non-special legal card
  const winIdx = findWinningPlay(hand, topCard);
  if (winIdx >= 0 && hand.length === 1) {
    return { kind: 'play', cardIndex: winIdx, declareCard: false };
  }

  // Priority 2: Play a legal non-special card (sets up future win)
  const nonSpecialLegal = hand.findIndex(
    (c) => !isSpecial(c) && isCardLegal(c, topCard)
  );

  // Priority 3: Any legal card
  const anyLegal = hand.findIndex((c) => isCardLegal(c, topCard));

  const playIdx = nonSpecialLegal >= 0 ? nonSpecialLegal : anyLegal;

  if (playIdx >= 0) {
    const card = hand[playIdx];
    const remaining = hand.filter((_, i) => i !== playIdx);
    const wouldBeOnVerge =
      remaining.length > 0 &&
      remaining.length <= 2 &&
      remaining.some((c) => !isSpecial(c));

    const action: any = {
      kind: 'play',
      cardIndex: playIdx,
      declareCard: wouldBeOnVerge,
    };

    // Minimal chaining (only 20% chance to chain specials)
    if (card.kind === 'regular' && Math.random() < 0.2) {
      if (card.rank === 'J') {
        const jCount = hand.filter(
          (c) => c.kind === 'regular' && c.rank === 'J'
        ).length;
        if (jCount > 1) action.chainJCount = jCount;
      }
      if (card.rank === 'K') {
        const kCount = hand.filter(
          (c) => c.kind === 'regular' && c.rank === 'K'
        ).length;
        if (kCount > 1) action.chainKCount = kCount;
      }
      if (card.rank === '8' || card.rank === 'Q') {
        const qCount = hand.filter(
          (c) =>
            c.kind === 'regular' && (c.rank === '8' || c.rank === 'Q')
        ).length;
        if (qCount > 1) action.chainQuestionCount = qCount;
      }
    }

    return action;
  }

  return { kind: 'pick' };
}

// ── Run game ────────────────────────────────────────────────────────────────

const names = ['Alice', 'Bob', 'Carol', 'Dave'];
let state = initGame({ playerNames: names, cardsPerPlayer: 5 });
let turnCount = 0;

console.log('🎴 KENYAN POKER — Simulated Game 🎴');
console.log(`Players: ${names.join(', ')}`);
console.log(`Each has ${state.cardsPerPlayer} cards`);
console.log(`Starting card: ${cardDisplay(state.topCard)}`);
console.log(`Starting player: ${state.players[state.currentPlayerIndex].name}`);
console.log('═'.repeat(60));

while (!state.gameOver && turnCount < 500) {
  turnCount++;
  const player = state.players[state.currentPlayerIndex];

  if (player.cardless) {
    const r = processAction(state, { kind: 'pick' });
    state = r.newState;
    console.log(
      `[${turnCount}] ${player.name} 🔄 cardless → auto-draws`
    );
    continue;
  }

  const action = botAction(state);
  const result = processAction(state, action);

  if (!result.success) {
    const r = processAction(state, { kind: 'pick' });
    state = r.newState;
    continue;
  }

	state = result.newState;
  const updatedPlayer = state.players.find((p) => p.id === player.id)!;

	let desc = `[${turnCount}] ${player.name}`;
	if (state.bomb) {
		desc += ` 💣 BOMB x${state.bomb.count} → ${state.players[state.currentPlayerIndex].name}!`;
	} else if (state.question) {
		desc += ` ❓ QUESTION`;
	} else if (result.message.includes('wins')) {
		desc += ` 🏆 WINS! (${updatedPlayer.hand.length}c)`;
	} else if (result.message.includes('penalized')) {
		desc += ` ⚠️ PENALIZED!`;
	} else if (
		state.playersOnVerge.has(player.id) &&
		!state.winnerIds.includes(player.id)
	) {
		desc += ` 📢 "CARD!"`;
	}
	desc += ` [${updatedPlayer.hand.length}c]`;
	if (state.direction === 'counterclockwise') desc += ' ↺';
  console.log(desc);
}

console.log('═'.repeat(60));
if (state.gameOver) {
  console.log(`\n🏁 Game over after ${turnCount} turns!\n`);
  for (const wid of state.winnerIds) {
    console.log(`  🏆 ${state.players[wid].name} — WINNER`);
  }
  const loser = state.players.find((p) => !state.winnerIds.includes(p.id));
  if (loser) console.log(`  😢 ${loser.name} — LOSER`);
} else {
  console.log(`\n⏰ Stopped after ${turnCount} turns (no winner)`);
}
