import { Color } from '../pieces/Piece';

export type EffectType =
  | 'stun'
  | 'shield'
  | 'bomb'
  | 'zombie'
  | 'walker'
  | 'fool'
  | 'berserk'
  | 'fate'
  | 'planted'
  | 'death_counter'
  | 'bind'
  | 'blessing'
  | 'judgment_mark'
  | 'electron'
  | 'marksman'
  | 'aegis'
  | 'ghost'
  | 'repel'
  | 'soulless'
  | 'flame'
  | 'mountain'
  | 'outworld'
  | 'dimension'
  | 'silence'
  | 'devil_eye'
  | 'crazy'
  | 'ascend'
  | 'main'
  | 'voodoo'
  | 'thunder_trap'
  | 'landmine'
  | 'verdant_shelter'
  | 'sanctuary'
  | 'electric_terrain';

export interface Effect {
  id: string;                     // unique instance id (uuid)
  type: EffectType;               // 'stun', 'shield', etc.
  
  // Lifecycle
  duration: number | null;        // null = permanent until removed
  remainingDuration: number | null;
  tickTiming: 'turnStart' | 'turnEnd';  // when duration decrements
  
  // Ownership
  sourcePlayer: Color;            // who applied it
  sourceSkillId?: string;         // which skill created it
  sourcePieceId?: string;         // which piece created it
  
  // Target
  targetType: 'piece' | 'cell' | 'player';
  targetId: string;               // pieceId or `${col},${row}`
  
  // Stacking
  stackingRule: 'refresh' | 'stack' | 'ignore';
  stackCount?: number;            // for 'stack' rule
  
  // Classification
  isDebuff: boolean;              // for Blessing/Aegis to identify "negative" effects
  isHidden?: boolean;             // whether the effect is hidden from the opponent player
  
  // Metadata — variant-specific data
  metadata: Record<string, any>;
}
