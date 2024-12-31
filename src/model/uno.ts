import { Hand } from './hand';
import { Card, Color } from './deck';
import { Randomizer, standardRandomizer, Shuffler, standardShuffler } from '../utils/random_utils';

/**
 * Interface representing a game.
 * 
 * @interface Game
 * @property {string[]} players - An array of player names.
 * @property {number} playerCount - The number of players in the game.
 * @property {number} targetScore - The target score to win the game.
 * @property {Randomizer} randomizer - The randomizer function used in the game.
 */
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

/**
 * Class representing an Uno game.
 * 
 * @implements {Game}
 */
class UnoGame implements Game {
  readonly players: string[];
  private scores: number[];
  private _targetScore: number;
  private _currentHand?: Hand;
  readonly randomizer: Randomizer;
  private shuffler: Shuffler<Card>;
  private cardsPerPlayer: number;

  /**
   * Creates an instance of UnoGame.
   * @param {Object} props - The properties to initialize the game with.
   * @param {string[]} [props.players] - An array of player names. Defaults to ['A', 'B'].
   * @param {number} [props.targetScore] - The target score to win the game. Defaults to 500.
   * @param {Randomizer} [props.randomizer] - The randomizer function to use. Defaults to `standardRandomizer`.
   * @param {Shuffler<Card>} [props.shuffler] - The shuffler function to use. Defaults to `standardShuffler`.
   * @param {number} [props.cardsPerPlayer] - The number of cards to deal to each player at the start. Defaults to 7.
   * @throws {Error} If the number of players is less than 2 or the target score is less than or equal to 0.
   */
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

  /**
   * Gets the number of players in the game.
   * @returns {number} The number of players.
   */
  get playerCount(): number {
    return this.players.length;
  }

  /**
   * Gets the name of a specific player.
   * @param {number} index - The index of the player.
   * @returns {string} The name of the player.
   * @throws {Error} If the player index is out of bounds.
   */
  player(index: number): string {
    if (index < 0 || index >= this.players.length) {
      throw new Error("Player index out of bounds");
    }
    return this.players[index];
  }

  /**
   * Gets the target score to win the game.
   * @returns {number} The target score.
   */
  get targetScore(): number {
    return this._targetScore;
  }

  /**
   * Gets the score of a specific player.
   * @param {number} playerIndex - The index of the player.
   * @returns {number} The score of the player.
   */
  score(playerIndex: number): number {
    return this.scores[playerIndex];
  }

  /**
   * Gets the index of the winning player, if any.
   * @returns {number | undefined} The index of the winning player, or `undefined` if there is no winner yet.
   */
  winner(): number | undefined {
    const winnerIndex = this.scores.findIndex(score => score >= this.targetScore);
    return winnerIndex >= 0 ? winnerIndex : undefined;
  }

  /**
   * Gets the current hand of the game.
   * @returns {Hand | undefined} The current hand, or `undefined` if there is no current hand.
   */
  currentHand(): Hand | undefined {
    return this._currentHand;
  }

  /**
   * Starts a new hand in the game.
   * @private
   */
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

  /**
   * Handles the end of a hand.
   * @param {Object} event - The event object containing the winner of the hand.
   * @param {number} event.winner - The index of the winning player.
   * @private
   */
  private handleHandEnd(event: { winner: number }) {
    const handScore = this._currentHand!.score()!;
    this.scores[event.winner] += handScore;
    this.startNewHand();
  }
}

/**
 * Creates a new Uno game.
 * @param {Object} props - The properties to initialize the game with.
 * @param {string[]} [props.players] - An array of player names. Defaults to ['A', 'B'].
 * @param {number} [props.targetScore] - The target score to win the game. Defaults to 500.
 * @param {Randomizer} [props.randomizer] - The randomizer function to use. Defaults to `standardRandomizer`.
 * @param {Shuffler<Card>} [props.shuffler] - The shuffler function to use. Defaults to `standardShuffler`.
 * @param {number} [props.cardsPerPlayer] - The number of cards to deal to each player at the start. Defaults to 7.
 * @returns {Game} A new Uno game instance.
 */
export function createGame(props: {
  players?: string[],
  targetScore?: number,
  randomizer?: Randomizer,
  shuffler?: Shuffler<Card>,
  cardsPerPlayer?: number
}): Game {
  return new UnoGame(props);
}