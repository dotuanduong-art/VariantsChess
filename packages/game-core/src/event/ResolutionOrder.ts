/**
 * Resolution priorities — lower number = higher priority (runs first).
 * Grouped by event type for clarity.
 * 
 * Design principle: defensive effects resolve before offensive effects.
 * Example: Shield must block capture BEFORE Bomb triggers on death.
 */
export const PRIORITY = {
  // OnBeforeCapture — who gets to intervene before a capture resolves?
  SHIELD_BLOCK:         100,    // Shield prevents capture entirely
  MAIN_VOODOO_REDIRECT: 200,   // Puppet's Main redirects attacker
  ZOMBIE_HOLD_POSITION: 300,   // Zombie stays in place instead of moving
  
  // OnPieceDeath — reactions after a piece is confirmed dead
  FATE_LINKED_DEATH:    100,   // Fate kills linked piece
  ELECTRON_STUN:        200,   // Electron stuns the attacker
  BOMB_EXPLOSION:       300,   // Bomb AoE triggers
  GRAVEYARD_RECORD:     900,   // Always last — record to graveyard

  // OnBeforePieceDestroyed
  BEFORE_DESTROY_SHIELD: 100,
  BEFORE_DESTROY_FATE:   200,

  // OnPieceDestroyed
  DESTROY_ELECTRON:      200,
  DESTROY_BOMB:          300,
  
  // OnMove — reactions after a piece moves
  TRAP_TRIGGER:         100,   // Thunder Trap / Landmine triggers
  REPEL_PUSHBACK:       200,   // Repel pushes piece back
  SOULLESS_DISABLE:     300,   // Soulless disables piece
  DIMENSION_TELEPORT:   400,   // Dimension portal teleport
  
  // OnTurnStart
  EFFECT_TICK:          100,   // Tick durations
  FOOL_AUTO_MOVE:       200,   // Fool auto-advances piece
  BERSERK_CHECK:        300,   // Berserk checks capture requirement
  
  // OnTurnEnd
  EFFECT_DURATION_TICK: 100,
  EFFECT_CLEANUP:       900,
  
  // OnValidateAction (used in validation pipeline, not event bus)
  STUN_BLOCK:           100,   // Stun prevents piece from being selected
  SILENCE_BLOCK:        200,   // Silence prevents skill use
  BIND_RESTRICT:        300,   // Bind limits move range
} as const;
