import { type Card, type RegularCard, type JokerCard, SUITS, RANKS } from './types.js';

/** Create a single standard deck (52 cards + 2 jokers) */
export function createDeck(): Card[] {
  const deck: Card[] = [];

  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ kind: 'regular', suit, rank } as RegularCard);
    }
  }

  // Two jokers — one red, one black
  deck.push({ kind: 'joker', color: 'red' } as JokerCard);
  deck.push({ kind: 'joker', color: 'black' } as JokerCard);

  return deck;
}

/** Create N decks shuffled together */
export function createMultipleDecks(count: number): Card[] {
  const combined: Card[] = [];
  for (let i = 0; i < count; i++) {
    combined.push(...createDeck());
  }
  return shuffle(combined);
}

/** Fisher-Yates shuffle (in-place, returns the array) */
export function shuffle<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/** Deal `count` cards to each of `playerCount` players from the deck.
 *  Returns [hands array, remaining deck].
 *  Cards are dealt from the front (index 0) of the array. */
export function deal(
  deck: Card[],
  playerCount: number,
  cardsPerPlayer: number
): [Card[][], Card[]] {
  const remaining = [...deck];
  const hands: Card[][] = Array.from({ length: playerCount }, () => []);

  for (let round = 0; round < cardsPerPlayer; round++) {
    for (let p = 0; p < playerCount; p++) {
      if (remaining.length === 0) break;
      hands[p].push(remaining.shift()!);
    }
  }

  return [hands, remaining];
}

/** Pick the starting card: draw until we find a non-special card.
 *  Returns [starter card, remaining deck].
 *  We put the drawn special cards into a separate pile (they go into discard). */
export function drawStarter(
  deck: Card[],
  isSpecial: (c: Card) => boolean
): [Card, Card[], Card[]] {
  const remaining = [...deck];
  const burned: Card[] = [];

  while (remaining.length > 0) {
    const card = remaining.shift()!;
    if (!isSpecial(card)) {
      // Put burned cards back... actually, per rules, we just keep drawing
      // until non-special. The specials that were drawn before go to discard.
      return [card, remaining, burned];
    }
    burned.push(card);
  }

  // Edge case: all remaining cards are special (extremely unlikely with
  // reasonable deck counts, but handle gracefully)
  const fallback = remaining.shift()!;
  return [fallback, remaining, burned];
}

/** Helper to pick N cards from the draw pile. If draw pile runs out,
 *  shuffle the discard pile (except the top card) into the draw pile. */
export function drawCards(
  count: number,
  drawPile: Card[],
  discardPile: Card[],
  topCard: Card
): [Card[], Card[], Card[]] {
  const drawn: Card[] = [];
  let draw = [...drawPile];
  let discard = [...discardPile];

  for (let i = 0; i < count; i++) {
    if (draw.length === 0) {
      // Recycle discard pile (keep top card)
      const toRecycle = discard.slice(0, -1);
      if (toRecycle.length === 0) break; // no more cards anywhere
      draw = shuffle(toRecycle);
      discard = [topCard]; // only top card remains in discard
    }
    drawn.push(draw.shift()!);
  }

  return [drawn, draw, discard];
}
