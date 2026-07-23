import { VariantDefinition } from '../Variant';
import { Color, PieceType, Piece } from '../../pieces/Piece';
import { Action } from '../../action/Action';
import { Position } from '../../board/Position';
import { BOARD_SIZE } from '../../board/Board';
import { Effect } from '../../effect/Effect';
import { GameEventType, GameEvent } from '../../event/GameEvent';

import { PuppetNoCaptureHandler } from '../../effect/handlers/PuppetNoCaptureHandler';
import { PuppetControlHandler } from '../../effect/handlers/PuppetControlHandler';
import { PuppetTrapHandler } from '../../effect/handlers/PuppetTrapHandler';
import { StunHandler } from '../../effect/handlers/StunHandler';
import { BindHandler } from '../../effect/handlers/BindHandler';
import { APCostConfig } from '../apCostConfig';

const MASTER_AP_MAP: Record<string, number> = {
  [PieceType.Pawn]: APCostConfig.puppet.puppet_table.Pawn,
  [PieceType.Knight]: APCostConfig.puppet.puppet_table.Knight,
  [PieceType.Bishop]: APCostConfig.puppet.puppet_table.Bishop,
  [PieceType.Rook]: APCostConfig.puppet.puppet_table.Rook,
  [PieceType.Queen]: APCostConfig.puppet.puppet_table.Queen,
};

export const PuppetVariant: VariantDefinition = {
  id: 'puppet',
  name: 'Puppet',
  description: 'Control your enemies, set traps, and redirect attacks to voodoo dolls.',
  effectHandlers: [
    new PuppetNoCaptureHandler(),
    new PuppetControlHandler(),
    new PuppetTrapHandler(),
    new StunHandler(),
    new BindHandler(),
  ],

  getInitialState: () => ({}),

  passiveHooks: (state, player) => [
    // 1. Passive: OnEffectExpired — Chain Stun/Control expiration to Bind
    {
      id: `puppet_effect_expired_${player}`,
      eventType: 'OnEffectExpired',
      priority: 100,
      source: `variant:puppet:${player}`,
      handler: (event, enqueueAction) => {
        if (event.type !== 'OnEffectExpired') return;
        const { effectSnapshot } = event.payload;
        if (!effectSnapshot) return;

        // Skill 2 Stun expiring
        if (
          effectSnapshot.type === 'stun' &&
          effectSnapshot.metadata?.sourceSkill === 'puppet_strings' &&
          effectSnapshot.metadata?.puppetPlayer === player
        ) {
          const pieceId = effectSnapshot.targetId;
          // Find target piece on the board
          let targetPos: Position | null = null;
          for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
              const pos = { col: c, row: r };
              const p = state.board.getPiece(pos);
              if (p && p.id === pieceId) {
                targetPos = pos;
                break;
              }
            }
            if (targetPos) break;
          }

          if (targetPos) {
            // Apply bind (2 rounds)
            enqueueAction({
              type: 'APPLY_EFFECT',
              effect: {
                id: `bind_${pieceId}_${Date.now()}`,
                type: 'bind',
                duration: 2,
                remainingDuration: 2,
                tickTiming: 'turnEnd',
                sourcePlayer: player,
                targetType: 'piece',
                targetId: pieceId,
                stackingRule: 'refresh',
                isDebuff: true,
                metadata: {},
              },
            });

            // Apply puppet_no_capture (duration: null, cleared on next move)
            enqueueAction({
              type: 'APPLY_EFFECT',
              effect: {
                id: `no_capture_${pieceId}_${Date.now()}`,
                type: 'puppet_no_capture',
                duration: null,
                remainingDuration: null,
                tickTiming: 'turnEnd',
                sourcePlayer: player,
                targetType: 'piece',
                targetId: pieceId,
                stackingRule: 'refresh',
                isDebuff: true,
                metadata: {},
              },
            });
          }
        }

        // Ultimate Control expiring
        if (
          effectSnapshot.type === 'puppet_control' &&
          effectSnapshot.metadata?.controlledBy === player
        ) {
          const pieceId = effectSnapshot.targetId;
          // Find target piece on the board
          let targetPos: Position | null = null;
          for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
              const pos = { col: c, row: r };
              const p = state.board.getPiece(pos);
              if (p && p.id === pieceId) {
                targetPos = pos;
                break;
              }
            }
            if (targetPos) break;
          }

          if (targetPos) {
            // Apply bind (2 rounds)
            enqueueAction({
              type: 'APPLY_EFFECT',
              effect: {
                id: `bind_${pieceId}_${Date.now()}`,
                type: 'bind',
                duration: 2,
                remainingDuration: 2,
                tickTiming: 'turnEnd',
                sourcePlayer: player,
                targetType: 'piece',
                targetId: pieceId,
                stackingRule: 'refresh',
                isDebuff: true,
                metadata: {},
              },
            });
          }
        }
      },
    },

    // 2. Passive: OnMove — Remove no_capture effect on first move
    {
      id: `puppet_no_capture_cleanup_${player}`,
      eventType: 'OnMove',
      priority: 100,
      source: `variant:puppet:${player}`,
      handler: (event, enqueueAction) => {
        if (event.type !== 'OnMove') return;
        const { pieceId } = event.payload;
        if (!pieceId) return;

        // Find if piece has puppet_no_capture
        let targetPiece: Piece | null = null;
        for (let r = 0; r < BOARD_SIZE; r++) {
          for (let c = 0; c < BOARD_SIZE; c++) {
            const p = state.board.getPiece({ col: c, row: r });
            if (p && p.id === pieceId) {
              targetPiece = p;
              break;
            }
          }
          if (targetPiece) break;
        }

        if (targetPiece && targetPiece.effects) {
          const effect = targetPiece.effects.find(e => e.type === 'puppet_no_capture');
          if (effect) {
            enqueueAction({
              type: 'REMOVE_EFFECT',
              effectId: effect.id,
              targetId: pieceId,
              targetType: 'piece',
              reason: 'puppet_no_capture_first_move_cleanup',
            });
          }
        }
      },
    },

    // 3. Passive: OnPieceDestroyed — If voodoo is destroyed, main effect vanishes
    {
      id: `puppet_voodoo_death_${player}`,
      eventType: 'OnPieceDestroyed',
      priority: 100,
      source: `variant:puppet:${player}`,
      handler: (event, enqueueAction) => {
        if (event.type !== 'OnPieceDestroyed') return;
        const { pieceSnapshot } = event.payload;
        if (!pieceSnapshot) return;

        // Check if voodoo was destroyed
        if (pieceSnapshot.effects?.some((e: any) => e.type === 'voodoo')) {
          // Find piece with main effect
          for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
              const p = state.board.getPiece({ col: c, row: r });
              if (p && p.effects) {
                const mainEffect = p.effects.find(e => e.type === 'main');
                if (mainEffect) {
                  enqueueAction({
                    type: 'REMOVE_EFFECT',
                    effectId: mainEffect.id,
                    targetId: p.id,
                    targetType: 'piece',
                    reason: 'voodoo_destroyed',
                  });
                }
              }
            }
          }
        }
      },
    },
  ],

  skills: [
    // ── Skill 1: Soul Binding (4 AP) ──
    {
      id: 'puppet_soul_binding',
      name: 'Soul Binding',
      description: 'Choose 1 ally to be Main and 1 ally to be Voodoo. If Main is attacked, damage is redirected to Voodoo.',
      tier: 'skill1',
      apCost: APCostConfig.puppet.puppet_skill_1,
      cooldown: 0,
      usageRule: 'once_per_turn',

      getTargetRequirements(state, player) {
        return [
          {
            type: 'piece',
            filter: 'ally',
            description: 'Choose an allied piece to be Main',
          },
          {
            type: 'piece',
            filter: 'ally',
            description: 'Choose another allied piece to be Voodoo',
          },
        ];
      },

      canActivate(state, player, targets) {
        if (targets.length !== 2) {
          return 'Select exactly 2 allied pieces';
        }
        const t0 = targets[0];
        const t1 = targets[1];
        if (t0.type !== 'piece' || !t0.position || t1.type !== 'piece' || !t1.position) {
          return 'Invalid targets';
        }
        if (t0.pieceId === t1.pieceId) {
          return 'Main and Voodoo must be different pieces';
        }
        const p0 = state.board.getPiece(t0.position);
        const p1 = state.board.getPiece(t1.position);
        if (!p0 || p0.color !== player || !p1 || p1.color !== player) {
          return 'Both pieces must be allied pieces';
        }
        return null;
      },

      execute(state, player, targets): Action[] {
        const t0 = targets[0];
        const t1 = targets[1];
        const actions: Action[] = [];

        // 1. Find and remove any existing main or voodoo effects on the board
        for (let r = 0; r < BOARD_SIZE; r++) {
          for (let c = 0; c < BOARD_SIZE; c++) {
            const p = state.board.getPiece({ col: c, row: r });
            if (p && p.effects) {
              const oldMain = p.effects.find(e => e.type === 'main');
              if (oldMain) {
                actions.push({
                  type: 'REMOVE_EFFECT',
                  effectId: oldMain.id,
                  targetId: p.id,
                  targetType: 'piece',
                  reason: 'pair_replaced',
                });
              }
              const oldVoodoo = p.effects.find(e => e.type === 'voodoo');
              if (oldVoodoo) {
                actions.push({
                  type: 'REMOVE_EFFECT',
                  effectId: oldVoodoo.id,
                  targetId: p.id,
                  targetType: 'piece',
                  reason: 'pair_replaced',
                });
              }
            }
          }
        }

        // 2. Apply main to Target 0
        actions.push({
          type: 'APPLY_EFFECT',
          effect: {
            id: `main_${t0.pieceId}_${Date.now()}`,
            type: 'main',
            duration: null,
            remainingDuration: null,
            tickTiming: 'turnEnd',
            sourcePlayer: player,
            targetType: 'piece',
            targetId: t0.pieceId!,
            stackingRule: 'ignore',
            isDebuff: false,
            metadata: {},
          },
        });

        // 3. Apply voodoo to Target 1
        actions.push({
          type: 'APPLY_EFFECT',
          effect: {
            id: `voodoo_${t1.pieceId}_${Date.now()}`,
            type: 'voodoo',
            duration: null,
            remainingDuration: null,
            tickTiming: 'turnEnd',
            sourcePlayer: player,
            targetType: 'piece',
            targetId: t1.pieceId!,
            stackingRule: 'ignore',
            isDebuff: false,
            metadata: {},
          },
        });

        return actions;
      },
    },

    // ── Skill 2: Puppet Strings (3 AP) ──
    {
      id: 'puppet_strings',
      name: 'Puppet Strings',
      description: 'Place a trap on an empty square. Enemy landing on it gets Stun (2 rounds). After Stun, no capture on next move.',
      tier: 'skill2',
      apCost: APCostConfig.puppet.puppet_skill_2,
      cooldown: 0,
      usageRule: 'once_per_turn',

      getTargetRequirements(state, player) {
        return [
          {
            type: 'cell',
            filter: 'empty',
            description: 'Select an empty square to place the trap',
          },
        ];
      },

      canActivate(state, player, targets) {
        if (targets.length !== 1 || targets[0].type !== 'cell' || !targets[0].position) {
          return 'Select exactly 1 empty cell';
        }
        const pos = targets[0].position;
        if (state.board.getPiece(pos)) {
          return 'Cell must be empty';
        }
        const existingTrap = state.board.getCellEffects(pos).some(e => e.type === 'puppet_trap');
        if (existingTrap) {
          return 'Trap is already placed on this square';
        }
        return null;
      },

      execute(state, player, targets): Action[] {
        const cell = targets[0].position!;
        return [
          {
            type: 'APPLY_EFFECT',
            effect: {
              id: `puppet_trap_${cell.col}_${cell.row}_${Date.now()}`,
              type: 'puppet_trap',
              duration: null,
              remainingDuration: null,
              tickTiming: 'turnEnd',
              sourcePlayer: player,
              targetType: 'cell',
              targetId: `${cell.col},${cell.row}`,
              stackingRule: 'ignore',
              isDebuff: false,
              isHidden: true,
              metadata: {},
            },
          },
        ];
      },
    },

    // ── Ultimate: Puppet Master (Dynamic AP) ──
    {
      id: 'puppet_master',
      name: 'Puppet Master',
      description: 'Control an enemy piece (except King) for 7 rounds. Costs depend on piece value. First 2 rounds are pre-control (no capture).',
      tier: 'ultimate',
      apCost: APCostConfig.puppet.puppet_ultimate, // Base AP spent by core. Extra AP is spent during execute.
      cooldown: 0,
      usageRule: 'once_per_turn',

      getTargetRequirements(state, player) {
        return [
          {
            type: 'piece',
            filter: 'enemy',
            description: 'Select an enemy piece to control',
            dynamicCostByPieceType: MASTER_AP_MAP,
          },
        ];
      },

      canActivate(state, player, targets) {
        if (targets.length !== 1 || targets[0].type !== 'piece' || !targets[0].position) {
          return 'Select exactly 1 enemy piece';
        }
        const targetPiece = state.board.getPiece(targets[0].position);
        if (!targetPiece || targetPiece.color === player) {
          return 'Must target an enemy piece';
        }
        if (targetPiece.type === PieceType.King) {
          return 'Cannot control the King';
        }
        // Block if already controlled (e.g. Walker effect or another puppet_control effect)
        const hasControl = targetPiece.effects?.some(e => e.type === 'walker' || e.type === 'puppet_control');
        if (hasControl) {
          return 'Target is already under control effects';
        }

        // AP cost check
        const actualCost = MASTER_AP_MAP[targetPiece.type as PieceType] || 2;
        const playerAP = player === Color.White ? state.whiteAP : state.blackAP;
        if (playerAP < actualCost) {
          return `Not enough AP. Controlling a ${targetPiece.type} requires ${actualCost} AP (you have ${playerAP})`;
        }

        return null;
      },

      execute(state, player, targets): Action[] {
        const pieceTarget = targets[0];
        const pos = pieceTarget.position!;
        const piece = state.board.getPiece(pos)!;

        const actualCost = MASTER_AP_MAP[piece.type as PieceType] || 2;
        const extraCost = actualCost - 2; // base 2 AP spent automatically
        const actions: Action[] = [];

        if (extraCost > 0) {
          actions.push({
            type: 'SPEND_AP',
            player,
            amount: extraCost,
            source: 'skill:puppet_master',
          });
        }

        // Apply puppet_control effect (duration: 7 rounds)
        actions.push({
          type: 'APPLY_EFFECT',
          effect: {
            id: `puppet_control_${piece.id}_${Date.now()}`,
            type: 'puppet_control',
            duration: 7,
            remainingDuration: 7,
            tickTiming: 'turnEnd',
            sourcePlayer: player,
            targetType: 'piece',
            targetId: piece.id,
            stackingRule: 'ignore',
            isDebuff: true,
            metadata: {
              controlledBy: player,
            },
          },
        });

        return actions;
      },
    },
  ],
};
