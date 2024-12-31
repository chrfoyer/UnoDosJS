import { Shuffler, standardShuffler } from '../utils/random_utils';

/**
 * Represents the color of a card.
 */
export type Color = 'RED' | 'BLUE' | 'GREEN' | 'YELLOW';

/**
 * Array of all possible card colors.
 */
export const colors: Color[] = ['RED', 'BLUE', 'GREEN', 'YELLOW'];

/**
 * Represents the type of a card.
 */
export type CardType = 'NUMBERED' | 'SKIP' | 'REVERSE' | 'DRAW' | 'WILD' | 'WILD DRAW';

/**
 * Interface representing a card in the deck.
 */
export interface Card {
  type: CardType;
  color?: Color;
  number?: number;
}

/**
 * Class representing a deck of cards.
 */
export class Deck {
  private cards: Card[];

  /**
   * Creates an instance of Deck.
   * @param cards Optional array of cards to initialize the deck with.
   */
  constructor(cards?: Card[]) {
    this.cards = cards ? [...cards] : Deck.createInitialDeck();
  }

  /**
   * Creates the initial deck of cards with all the standard UNO cards.
   * @returns An array of cards representing the initial deck.
   */
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

  /**
   * Shuffles the deck using the provided shuffler function.
   * @param shuffler The shuffler function to use. Defaults to `standardShuffler`.
   */
  shuffle(shuffler: Shuffler<Card> = standardShuffler): void {
    shuffler(this.cards);
  }

  /**
   * Deals a card from the top of the deck.
   * @returns The dealt card, or `undefined` if the deck is empty.
   */
  deal(): Card | undefined {
    return this.cards.shift();
  }

  /**
   * Adds a card to the bottom of the deck.
   * @param card The card to add to the bottom of the deck.
   */
  addToBottom(card: Card): void {
    this.cards.push(card);
  }

  /**
   * Gets the number of cards remaining in the deck.
   * @returns The number of cards in the deck.
   */
  get size(): number {
    return this.cards.length;
  }

  /**
   * Filters the deck based on a predicate function.
   * @param predicate The predicate function to filter the cards.
   * @returns A new deck containing only the cards that match the predicate.
   */
  filter(predicate: (card: Card) => boolean): Deck {
    return new Deck(this.cards.filter(predicate));
  }

  /**
   * Gets the top card of the deck without removing it.
   * @returns The top card of the deck, or `undefined` if the deck is empty.
   */
  top(): Card | undefined {
    return this.cards[this.cards.length - 1];
  }

  /**
   * Sets the top card of the deck.
   * @param card The card to set as the top card.
   */
  setTopCard(card: Card): void {
    this.cards = [card, ...this.cards];
  }
}

/**
 * Creates an initial deck of cards.
 * @returns A new `Deck` instance with the initial set of cards.
 */
export function createInitialDeck(): Deck {
  return new Deck();
}