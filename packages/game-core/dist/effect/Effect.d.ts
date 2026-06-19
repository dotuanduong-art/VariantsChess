import { Color } from '../pieces/Piece';
export type EffectType = 'stun' | 'shield' | 'bomb' | 'zombie' | 'walker' | 'fool' | 'berserk' | 'fate' | 'planted' | 'death_counter' | 'bind' | 'blessing' | 'judgment_mark' | 'electron' | 'marksman' | 'aegis' | 'ghost' | 'repel' | 'soulless' | 'flame' | 'mountain' | 'outworld' | 'dimension' | 'silence' | 'devil_eye' | 'crazy' | 'ascend' | 'main' | 'voodoo' | 'thunder_trap' | 'landmine' | 'verdant_shelter' | 'sanctuary' | 'electric_terrain';
export interface Effect {
    id: string;
    type: EffectType;
    duration: number | null;
    remainingDuration: number | null;
    tickTiming: 'turnStart' | 'turnEnd';
    sourcePlayer: Color;
    sourceSkillId?: string;
    sourcePieceId?: string;
    targetType: 'piece' | 'cell' | 'player';
    targetId: string;
    stackingRule: 'refresh' | 'stack' | 'ignore';
    stackCount?: number;
    isDebuff: boolean;
    isHidden?: boolean;
    metadata: Record<string, any>;
}
//# sourceMappingURL=Effect.d.ts.map