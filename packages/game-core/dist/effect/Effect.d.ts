import { Color } from '../pieces/Piece';
export type EffectType = 'stun' | 'shield' | 'bomb' | 'zombie' | 'walker' | 'fool' | 'berserk' | 'fate' | 'planted' | 'death_counter' | 'bind' | 'blessing' | 'judgment_mark' | 'electron' | 'marksman' | 'aegis' | 'ghost' | 'repel' | 'soulless' | 'soulless_cell' | 'flame' | 'mountain' | 'outworld' | 'dimension' | 'silence' | 'devil_eye' | 'crazy' | 'ascend' | 'main' | 'voodoo' | 'thunder_trap' | 'landmine' | 'verdant_shelter' | 'sanctuary' | 'electric_terrain' | 'position_swap' | 'moveset_swap' | 'enemy_position_swap' | 'totem_timer' | 'electric' | 'thunder_fang' | 'mountain_timer' | 'reservation_timer' | 'devour' | 'apex_predator' | 'possession_active' | 'spirit_walk' | 'prediction' | 'time_freeze' | 'evolution' | 'apex_camouflage' | 'dragon_gaze' | 'emerald_domain' | 'summon_duration' | 'subterranean_escape' | 'dragons_roar_channeling' | 'dragons_roar_beam' | 'no_promotion' | 'supernova_warning' | 'puppet_no_capture' | 'puppet_control' | 'puppet_trap' | 'cosmic_void' | 'sailing' | 'pirate_bet';
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