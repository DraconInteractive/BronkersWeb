import type { Card } from './card';
import type { Formation } from './formation';

export type PublicOpponent = {
  laidDown: boolean;
  // Matches the UI: 13 until commitment, then the visible hand count.
  cardsRemaining: number;
};

// Deliberately excludes deck contents and opponents' private cards/formations.
export type AIKnowledge = {
  knownCards: readonly Card[];
  table: readonly Formation[];
  hasDrawn: boolean;
  opponents?: readonly PublicOpponent[];
};
