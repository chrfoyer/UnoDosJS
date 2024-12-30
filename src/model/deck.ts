import { Shuffler, standardShuffler } from '../utils/random_utils';

export type Color = 'RED' | 'BLUE' | 'GREEN' | 'YELLOW';
export const colors: Color[] = ['RED', 'BLUE', 'GREEN', 'YELLOW'];
export type CardType = 'NUMBERED' | 'SKIP' | 'REVERSE' | 'DRAW' | 'WILD' | 'WILD DRAW';

export interface Card {
  type: CardType;
  color?: Color;
  number?: number;
}

export class Deck {
  private cards: Card[];

  constructor(cards?: Card[]) {
    this.cards = cards ? [...cards] : Deck.createInitialDeck();
  }

  public static createInitialDeck(): Card[] {
    const deck: Card[] = [];
    
    // Add numbered cards
    for (const color of colors) {
      deck.push({ type: 'NUMBERED', color, number: 0 });
      for (let i = 1; i <= 9; i++) {
        deck.push({ type: 'NUMBERED', color, number: i });
        deck.push({ type: 'NUMBERED', color, number: i });
      }
    }

    // Add special cards
    for (const color of colors) {
      for (let i = 0; i < 2; i++) {
        deck.push({ type: 'SKIP', color });
        deck.push({ type: 'REVERSE', color });
        deck.push({ type: 'DRAW', color });
      }
    }

    // Add wild cards
    for (let i = 0; i < 4; i++) {
      deck.push({ type: 'WILD' });
      deck.push({ type: 'WILD DRAW' });
    }

    return deck;
  }

  shuffle(shuffler: Shuffler<Card> = standardShuffler): void {
    shuffler(this.cards);
  }

  deal(): Card | undefined {
    return this.cards.shift();
  }

  addToBottom(card: Card): void {
    this.cards.push(card);
  }

  get size(): number {
    return this.cards.length;
  }

  filter(predicate: (card: Card) => boolean): Deck {
    return new Deck(this.cards.filter(predicate));
  }

  top(): Card | undefined {
    return this.cards[this.cards.length - 1];
  }

  setTopCard(card: Card): void {
    this.cards = [card, ...this.cards];
  }
}

export function createInitialDeck(): Deck {
  return new Deck();
}