import { Deck, Card, Color } from "./deck";
import { Shuffler, standardShuffler } from "../utils/random_utils";

interface HandProps {
  players: string[];
  dealer: number;
  shuffler?: Shuffler<Card>;
  cardsPerPlayer?: number;
  onEnd?: (event: { winner: number }) => void;
}

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

  private dealInitialCards(deck: Deck, cardsPerPlayer: number): void {
    for (let i = 0; i < this.players.length; i++) {
      this.playerHands[i] = [];
      for (let j = 0; j < cardsPerPlayer; j++) {
        const card = deck.deal();
        if (card) this.playerHands[i].push(card);
      }
    }
  }

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


    // // Handle cards that force next player to draw before removing the played card
    // if (card.type === "DRAW" || card.type === "WILD DRAW") {
    //   const nextPlayer = (this.currentPlayerIndex + this.direction + this.players.length) % this.players.length;
    //   const cardsToDraw = card.type === "DRAW" ? 2 : 4;

    //   // Draw the cards before removing the played card
    //   for (let i = 0; i < cardsToDraw; i++) {
    //     const drawnCard = this._drawPile.deal();
    //     if (drawnCard) {
    //       this.playerHands[nextPlayer].push(drawnCard);
    //     } else {
    //       this.reshuffleDeck();
    //       const newCard = this._drawPile.deal();
    //       if (newCard) this.playerHands[nextPlayer].push(newCard);
    //     }
    //   }
    // }

    hand.splice(cardIndex, 1);
    this._discardPile.addToBottom(card);
    this.lastPlayedCard = card;

    // Clear UNO declaration if they didn't get down to one card
    if (hand.length !== 1) {
      this.unoSaid.delete(this.currentPlayerIndex);
    }

    // // Apply effects first
    // this.applyCardEffect(card, chosenColor);

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

  private nextTurn(): void {
    this.currentPlayerIndex =
      (this.currentPlayerIndex + this.direction + this.players.length) %
      this.players.length;
  }

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

  hasEnded(): boolean {
    return this._hasEnded;
  }

  winner(): number | undefined {
    return this._winner;
  }

  score(): number | undefined {
    if (!this._hasEnded) return undefined;
    return this.calculateScore();
  }

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

  playerHand(playerIndex: number): Card[] {
    if (playerIndex < 0 || playerIndex >= this.players.length) {
      throw new Error("Invalid player index");
    }
    return this.playerHands[playerIndex];
  }

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

  canPlayAny(): boolean {
    return this.playerHands[this.currentPlayerIndex].some((card) =>
      this.isValidPlay(card)
    );
  }

  get playerCount(): number {
    return this.players.length;
  }

  player(index: number): string {
    if (index < 0 || index >= this.players.length) {
      throw new Error("Player index out of bounds");
    }
    return this.players[index];
  }

  get dealer(): number {
    return this._dealer;
  }

  playerInTurn(): number | undefined {
    return this._hasEnded ? undefined : this.currentPlayerIndex;
  }

  discardPile(): Deck {
    return this._discardPile;
  }

  drawPile(): Deck {
    return this._drawPile;
  }

  onEnd(callback: (event: { winner: number }) => void): void {
    this.onEndCallbacks.push(callback);
  }
}
