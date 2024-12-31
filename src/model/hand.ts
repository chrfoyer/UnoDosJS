import { Deck, Card, Color } from "./deck";
import { Shuffler, standardShuffler } from "../utils/random_utils";

/**
 * Properties for initializing a Hand.
 * 
 * @interface HandProps
 * @property {string[]} players - An array of player names.
 * @property {number} dealer - The index of the dealer in the players array.
 * @property {Shuffler<Card>} [shuffler] - Optional shuffler function to shuffle the deck. Defaults to `standardShuffler`.
 * @property {number} [cardsPerPlayer] - Optional number of cards to deal to each player at the start. Defaults to 7.
 * @property {(event: { winner: number }) => void} [onEnd] - Optional callback function to be called when the hand ends.
 */
interface HandProps {
  players: string[];
  dealer: number;
  shuffler?: Shuffler<Card>;
  cardsPerPlayer?: number;
  onEnd?: (event: { winner: number }) => void;
}

/**
 * Class representing a hand of the game.
 * 
 * @class Hand
 * @property {string[]} players - An array of player names.
 * @property {number} _dealer - The index of the dealer in the players array.
 * @property {Deck} _discardPile - The discard pile.
 * @property {Deck} _drawPile - The draw pile.
 * @property {Card[][]} playerHands - An array of arrays representing each player's hand.
 * @property {number} currentPlayerIndex - The index of the current player.
 * @property {1 | -1} direction - The direction of play (1 for clockwise, -1 for counterclockwise).
 * @property {boolean} _hasEnded - Whether the hand has ended.
 * @property {number | undefined} _winner - The index of the winning player, or `undefined` if the hand has not ended.
 * @property {((event: { winner: number }) => void)[]} onEndCallbacks - An array of callback functions to be called when the hand ends.
 * @property {Set<number>} unoSaid - A set of player indices who have declared UNO.
 * @property {Set<number>} lastActionByOthers - A set of player indices who took the last action.
 * @property {Card | undefined} lastPlayedCard - The last played card, or `undefined` if no card has been played.
 * @property {Shuffler<Card>} _shuffler - The shuffler function used to shuffle the deck.
 */
export class Hand {
  private players: string[];
  private _dealer: number;
  private _discardPile: Deck;
  private _drawPile: Deck;
  private playerHands: Card[][];
  private currentPlayerIndex: number;
  private direction: 1 | -1;
  private _hasEnded: boolean;
  private _winner: number | undefined;
  private onEndCallbacks: ((event: { winner: number }) => void)[];
  private unoSaid: Set<number>;
  private lastActionByOthers: Set<number>;
  private lastPlayedCard: Card | undefined;
  private _shuffler: Shuffler<Card>;

  /**
   * Creates an instance of Hand.
   * @param {HandProps} props - The properties to initialize the hand with.
   * @throws {Error} If the number of players is less than 2 or more than 10.
   */
  constructor(props: HandProps) {
    if (props.players.length < 2 || props.players.length > 10) {
      throw new Error("Invalid number of players");
    }
    this.players = props.players;
    this._dealer = props.dealer;
    const deck = new Deck();
    const shuffler = props.shuffler || standardShuffler;
    deck.shuffle(shuffler);
    this._discardPile = new Deck();
    this._drawPile = new Deck();
    this._shuffler = shuffler;
    this.playerHands = [];
    this.direction = 1;
    this._hasEnded = false;
    this._winner = undefined;
    this.onEndCallbacks = props.onEnd ? [props.onEnd] : [];
    this.unoSaid = new Set();
    this.lastActionByOthers = new Set();
    this.currentPlayerIndex = (this._dealer + 1) % this.players.length;
    this.lastPlayedCard = undefined;

    this.dealInitialCards(deck, props.cardsPerPlayer || 7);
    this._drawPile = deck;
    this.startGame();
  }

  /**
   * Deals the initial cards to each player.
   * @param deck The deck to deal cards from.
   * @param cardsPerPlayer The number of cards to deal to each player.
   */
  private dealInitialCards(deck: Deck, cardsPerPlayer: number): void {
    for (let i = 0; i < this.players.length; i++) {
      this.playerHands[i] = [];
      for (let j = 0; j < cardsPerPlayer; j++) {
        const card = deck.deal();
        if (card) this.playerHands[i].push(card);
      }
    }
  }

  /**
   * Starts the game by dealing the first card and setting up the initial state.
   */
  private startGame(): void {
    let firstCard: Card | undefined;
    do {
      firstCard = this._drawPile.deal();
      if (firstCard) {
        if (firstCard.type === "WILD" || firstCard.type === "WILD DRAW") {
          this._drawPile.addToBottom(firstCard);
          this._drawPile.shuffle(this._shuffler);  // Use the stored shuffler
        } else {
          this._discardPile = new Deck([firstCard]);
          this.lastPlayedCard = firstCard;
          break;
        }
      }
    } while (firstCard);

    if (firstCard) {
      if (firstCard.type === "REVERSE") {
        this.direction = -1;
        this.currentPlayerIndex =
          (this._dealer - 1 + this.players.length) % this.players.length;
      } else if (firstCard.type === "SKIP") {
        this.nextTurn();
      } else if (firstCard.type === "DRAW") {
        this.drawCards(2);
        this.nextTurn();
      }
    }
  }

  /**
   * Draws a card for the current player.
   */
  draw(): void {
    if (this._hasEnded) throw new Error("The hand has ended");

    const card = this._drawPile.deal();
    if (card) {
      this.playerHands[this.currentPlayerIndex].push(card);

      // After drawing, if draw pile is empty, reshuffle
      if (this._drawPile.size === 0) {
        this.reshuffleDeck();
      }

      // Mark that this player took an action for all other players
      this.lastActionByOthers = new Set(
        [...Array(this.players.length).keys()].filter(i => i !== this.currentPlayerIndex)
      );

      if (!this.canPlayAny()) {
        this.nextTurn();
      }
    }
  }

  /**
   * Plays a card from the current player's hand.
   * @param cardIndex The index of the card to play.
   * @param chosenColor The chosen color for wild cards.
   * @returns The played card.
   */
  play(cardIndex: number, chosenColor?: Color): Card {
    if (this._hasEnded) throw new Error("The hand has ended");
    const hand = this.playerHands[this.currentPlayerIndex];
    const card = hand[cardIndex];

    if (!this.isValidPlay(card)) {
      throw new Error("Invalid play");
    }

    if ((card.type === "WILD" || card.type === "WILD DRAW") && !chosenColor) {
      throw new Error("Must choose a color for wild cards");
    }

    if ((card.color && chosenColor)) {
      throw new Error("You can't choose a color for a numbered card");
    }

    hand.splice(cardIndex, 1);
    this._discardPile.addToBottom(card);
    this.lastPlayedCard = card;

    // Clear UNO declaration if they didn't get down to one card
    if (hand.length !== 1) {
      this.unoSaid.delete(this.currentPlayerIndex);
    }

    // Then check for game end
    if (hand.length === 0) {
      if (card.type === "DRAW" || card.type === "WILD DRAW") {
        this.applyCardEffect(card, chosenColor);
      }
      this._hasEnded = true;
      this._winner = this.currentPlayerIndex;
      this.onEndCallbacks.forEach((callback) =>
        callback({ winner: this._winner as number })
      );
    } else {
      this.applyCardEffect(card, chosenColor);
    }

    return card;
  }

  /**
   * Checks if a card is a valid play.
   * @param card The card to check.
   * @returns `true` if the card is a valid play, `false` otherwise.
   */
  isValidPlay(card: Card): boolean {
    if (!this.lastPlayedCard) return true;

    if (card.type === "WILD" || card.type === "WILD DRAW") {
      if (card.type === "WILD DRAW") {
        return !this.playerHands[this.currentPlayerIndex].some(
          (c) => c.color === this.lastPlayedCard?.color
        );
      }
      return true;
    }
    if (
      card.type === "NUMBERED" &&
      this.lastPlayedCard.type === "NUMBERED" &&
      card.number !== this.lastPlayedCard.number &&
      card.color !== this.lastPlayedCard.color
    )
      return false;

    return (
      card.color === this.lastPlayedCard.color ||
      card.type === this.lastPlayedCard.type ||
      (card.type === "NUMBERED" &&
        this.lastPlayedCard.type === "NUMBERED" &&
        card.number === this.lastPlayedCard.number)
    );
  }

  /**
   * Applies the effect of a played card.
   * @param card The card to apply the effect of.
   * @param chosenColor The chosen color for wild cards.
   */
  private applyCardEffect(card: Card, chosenColor?: Color): void {
    switch (card.type) {
      case "SKIP":
        this.nextTurn();
        break;
      case "REVERSE":
        this.direction *= -1;
        if (this.players.length === 2) {
          this.nextTurn();
        }
        break;
      case "DRAW":
        this.nextTurn();
        // Only draw if we haven't already drawn (in the play method)
        if (!this._hasEnded) {
          this.drawCards(2);
        }
        this.nextTurn();
        break;
      case "WILD":
        if (chosenColor) card.color = chosenColor;
        break;
      case "WILD DRAW":
        if (chosenColor) card.color = chosenColor;
        this.nextTurn();
        // Only draw if we haven't already drawn (in the play method)
        if (!this._hasEnded) {
          this.drawCards(4);
        }
        this.nextTurn();
        break;
    }
    if (card.type !== "DRAW" && card.type !== "WILD DRAW") {
      this.nextTurn();
    }
  }

  /**
   * Draws a specified number of cards for the current player.
   * @param count The number of cards to draw.
   */
  private drawCards(count: number): void {
    for (let i = 0; i < count; i++) {
      const card = this._drawPile.deal();
      if (card) {
        this.playerHands[this.currentPlayerIndex].push(card);

        // After drawing, if draw pile is empty, reshuffle
        if (this._drawPile.size === 0) {
          this.reshuffleDeck();
        }
      }
    }
  }

  /**
   * Advances to the next player's turn.
   */
  private nextTurn(): void {
    this.currentPlayerIndex =
      (this.currentPlayerIndex + this.direction + this.players.length) %
      this.players.length;
  }

  /**
   * Reshuffles the deck by moving cards from the discard pile to the draw pile.
   */
  private reshuffleDeck(): void {
    // Save the top card
    const topCard = this._discardPile.deal();

    // Move all other cards to draw pile
    while (this._discardPile.size > 0) {
      const card = this._discardPile.deal();
      if (card) {
        this._drawPile.addToBottom(card);
      }
    }

    // Only shuffle and use mock if we have cards to shuffle
    if (this._drawPile.size > 0) {
      this._drawPile.shuffle(this._shuffler);
    }

    // Restore the top card to discard pile
    if (topCard) {
      this._discardPile = new Deck([]);
      this._discardPile.setTopCard(topCard);
    }
  }

  /**
   * Declares UNO for a player.
   * @param playerIndex The index of the player declaring UNO.
   */
  sayUno(playerIndex: number): void {
    if (this._hasEnded) throw new Error("The hand has ended");
    if (playerIndex < 0 || playerIndex >= this.players.length) {
      throw new Error("Invalid player index");
    }

    // Only valid if:
    // - Player has one card, OR
    // - It's their turn and they have two cards
    if (this.playerHands[playerIndex].length === 1 ||
      (this.currentPlayerIndex === playerIndex &&
        this.playerHands[playerIndex].length === 2)) {
      this.unoSaid.add(playerIndex);
    }
  }

  /**
   * Catches a player who failed to declare UNO.
   * @param accuser The index of the player accusing.
   * @param accused The index of the player being accused.
   * @returns `true` if the accusation is valid, `false` otherwise.
   */
  catchUnoFailure({
    accuser,
    accused,
  }: {
    accuser: number;
    accused: number;
  }): boolean {
    if (this._hasEnded) throw new Error("The hand has ended");
    if (accused < 0 || accused >= this.players.length) {
      throw new Error("Invalid accused player index");
    }

    const nextPlayerIndex =
      (accused + this.direction + this.players.length) % this.players.length;

    if (this.currentPlayerIndex !== nextPlayerIndex) {
      return false;
    }

    if (this.playerHands[accused].length === 1 && !this.unoSaid.has(accused)) {
      const currentPlayer = this.currentPlayerIndex;
      this.currentPlayerIndex = accused;
      this.drawCards(4);
      this.currentPlayerIndex = currentPlayer;
      this.unoSaid.add(accused);
      return true;
    }

    return false;
  }

  /**
   * Checks if the hand has ended.
   * @returns `true` if the hand has ended, `false` otherwise.
   */
  hasEnded(): boolean {
    return this._hasEnded;
  }

  /**
   * Gets the winner of the hand.
   * @returns The index of the winning player, or `undefined` if the hand has not ended.
   */
  winner(): number | undefined {
    return this._winner;
  }

  /**
   * Calculates the score of the hand.
   * @returns The score of the hand, or `undefined` if the hand has not ended.
   */
  score(): number | undefined {
    if (!this._hasEnded) return undefined;
    return this.calculateScore();
  }

  /**
   * Calculates the score based on the remaining cards in each player's hand.
   * @returns The calculated score.
   */
  private calculateScore(): number {
    let score = 0;
    for (let i = 0; i < this.players.length; i++) {
      if (i !== this._winner) {
        for (const card of this.playerHands[i]) {
          switch (card.type) {
            case "NUMBERED":
              score += card.number || 0;
              break;
            case "SKIP":
            case "REVERSE":
            case "DRAW":
              score += 20;
              break;
            case "WILD":
            case "WILD DRAW":
              score += 50;
              break;
          }
        }
      }
    }
    return score;
  }

  /**
   * Gets the hand of a specific player.
   * @param playerIndex The index of the player.
   * @returns An array of cards in the player's hand.
   */
  playerHand(playerIndex: number): Card[] {
    if (playerIndex < 0 || playerIndex >= this.players.length) {
      throw new Error("Invalid player index");
    }
    return this.playerHands[playerIndex];
  }

  /**
   * Checks if the current player can play a specific card.
   * @param cardIndex The index of the card to check.
   * @returns `true` if the card can be played, `false` otherwise.
   */
  canPlay(cardIndex: number): boolean {
    if (this._hasEnded) return false;
    if (
      cardIndex < 0 ||
      cardIndex >= this.playerHands[this.currentPlayerIndex].length
    ) {
      return false;
    }
    const card = this.playerHands[this.currentPlayerIndex][cardIndex];
    return this.isValidPlay(card);
  }

  /**
   * Checks if the current player can play any card.
   * @returns `true` if the current player can play any card, `false` otherwise.
   */
  canPlayAny(): boolean {
    return this.playerHands[this.currentPlayerIndex].some((card) =>
      this.isValidPlay(card)
    );
  }

  /**
   * Gets the number of players in the hand.
   * @returns The number of players.
   */
  get playerCount(): number {
    return this.players.length;
  }

  /**
   * Gets the name of a specific player.
   * @param index The index of the player.
   * @returns The name of the player.
   */
  player(index: number): string {
    if (index < 0 || index >= this.players.length) {
      throw new Error("Player index out of bounds");
    }
    return this.players[index];
  }

  /**
   * Gets the index of the dealer.
   * @returns The index of the dealer.
   */
  get dealer(): number {
    return this._dealer;
  }

  /**
   * Gets the index of the player whose turn it is.
   * @returns The index of the player in turn, or `undefined` if the hand has ended.
   */
  playerInTurn(): number | undefined {
    return this._hasEnded ? undefined : this.currentPlayerIndex;
  }

  /**
   * Gets the discard pile.
   * @returns The discard pile as a `Deck` instance.
   */
  discardPile(): Deck {
    return this._discardPile;
  }

  /**
   * Gets the draw pile.
   * @returns The draw pile as a `Deck` instance.
   */
  drawPile(): Deck {
    return this._drawPile;
  }

  /**
   * Registers a callback to be called when the hand ends.
   * @param callback The callback function to register.
   */
  onEnd(callback: (event: { winner: number }) => void): void {
    this.onEndCallbacks.push(callback);
  }
}