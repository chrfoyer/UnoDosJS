import { Hand } from './hand';
import { Card, Color } from './deck';
import { Randomizer, standardRandomizer, Shuffler, standardShuffler } from '../utils/random_utils';

export interface Game {
  players: string[];
  playerCount: number;
  player(index: number): string;
  targetScore: number;
  score(playerIndex: number): number;
  winner(): number | undefined;
  currentHand(): Hand | undefined;
  randomizer: Randomizer;
}

class UnoGame implements Game {
  readonly players: string[];
  private scores: number[];
  private _targetScore: number;
  private _currentHand?: Hand;
  readonly randomizer: Randomizer;
  private shuffler: Shuffler<Card>;
  private cardsPerPlayer: number;

  constructor(props: {
    players?: string[],
    targetScore?: number,
    randomizer?: Randomizer,
    shuffler?: Shuffler<Card>,
    cardsPerPlayer?: number
  }) {
    this.players = props.players || ['A', 'B'];
    if (this.players.length < 2) {
      throw new Error("At least 2 players are required");
    }
    this._targetScore = props.targetScore ?? 500;
    if (this._targetScore <= 0) {
      throw new Error("Target score must be greater than 0");
    }
    this.scores = new Array(this.players.length).fill(0);
    this.randomizer = props.randomizer || standardRandomizer;
    this.shuffler = props.shuffler || standardShuffler;
    this.cardsPerPlayer = props.cardsPerPlayer || 7;
    this.startNewHand();
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

  get targetScore(): number {
    return this._targetScore;
  }

  score(playerIndex: number): number {
    return this.scores[playerIndex];
  }

  winner(): number | undefined {
    const winnerIndex = this.scores.findIndex(score => score >= this.targetScore);
    return winnerIndex >= 0 ? winnerIndex : undefined;
  }

  currentHand(): Hand | undefined {
    return this._currentHand;
  }

  private startNewHand() {
    if (this.winner() === undefined) {
      const dealer = this.randomizer(this.players.length);
      this._currentHand = new Hand({
        players: this.players,
        dealer,
        shuffler: this.shuffler,
        cardsPerPlayer: this.cardsPerPlayer,
        onEnd: this.handleHandEnd.bind(this)
      });
    } else {
      this._currentHand = undefined;
    }
  }

  private handleHandEnd(event: { winner: number }) {
    const handScore = this._currentHand!.score()!;
    this.scores[event.winner] += handScore;
    this.startNewHand();
  }
}

export function createGame(props: {
  players?: string[],
  targetScore?: number,
  randomizer?: Randomizer,
  shuffler?: Shuffler<Card>,
  cardsPerPlayer?: number
}): Game {
  return new UnoGame(props);
}