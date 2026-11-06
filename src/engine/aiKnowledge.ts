import type { Card } from './card';
import type { Formation } from './formation';

// Deliberately excludes deck contents and opponents' private cards/formations.
export type AIKnowledge = {
  knownCards: readonly Card[];
  table: readonly Formation[];
  hasDrawn: boolean;
};
