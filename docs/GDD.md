CHESS VARIANTS — GAME DESIGN DOCUMENT
Version 1.0 | Reverse-Engineered System Analysis
________________________________________
STEP 0 — GLOSSARY
Core Terms

AP (Action Points)
  A numerical resource owned separately by each player.
  Gained by capturing enemy pieces or losing your own pieces.
  Spent to activate Variant skills.
  Has no cap and does not decay between turns.

Variant
  A set of skills selected by a player before matchmaking.
  Defines that player's unique abilities for the entire match.
  Each player has exactly one active Variant at all times.

Skill
  An activated ability belonging to a Variant.
  Costs AP to use. Has no cooldown.
  A player may activate at most one Skill per turn, regardless of Skill ID. Repeatable Skills may be used multiple times within that single Skill slot
  Skills are the only way players interact with the Effect system directly.

Effect
  A stateful modifier attached to a target (Player, Piece, or Board).
  Has a defined lifecycle: Apply → Active → Tick → Expire.
  Can restrict actions, modify rules, or trigger on game events.
  Effects are created by Skills; they are not activated directly.

Duration
  The number of turns an Effect remains active.
  Decreases at a defined timing (Start Phase or End Phase).
  Effects with no duration persist until explicitly removed.

Tick
  The periodic update step of an active Effect.
  Triggered at Turn Start or Turn End depending on the Effect's definition.
  Used to decrement Duration, apply recurring effects, or check conditions.

Hook
  A callback registered by an Effect to respond to a specific game event.
  Example hooks: OnCapture, OnMove, OnTurnStart, OnSkillUse.
  When the event fires, all Effects with that hook execute in priority order.

Stacking
  Defines behavior when the same Effect is applied to a target that already has it.
  Three rules: Refresh (reset duration), Stack (accumulate), Ignore (discard new).
  Each Effect must declare exactly one stacking rule.

Turn
  One complete cycle of a single player's actions.
  Consists of five phases: Start → Action → Immediate Resolution → End → Cleanup.
  White always takes the first turn of the match.

Action
  Any operation performed during the Action Phase.
  Two types: Move (move one piece) and Skill (activate a Variant skill).
  Move does not cost AP. Skills cost AP.

Capture
  The act of moving a piece onto an enemy-occupied square.
  The capturing piece replaces the captured piece immediately.
  Triggers Dual AP Gain for both players simultaneously.

Promotion
  When a Pawn reaches the opponent's back rank.
  Automatically becomes a Queen. Grants +3 bonus AP to the promoting player.

Mirror Match
  A match where both players have selected the same Variant.
  Permitted by the matchmaking system.
________________________________________
STEP 1 — CORE GAME STRUCTURE
Genre
Asymmetric turn-based strategy game — a MOBA-influenced chess variant with a pre-match ability draft, resource economy, and four radically different special variant systems layered on top of an expanded chess ruleset.
Core Pillars
•	Expanded Chess Foundation — classical chess movement and capture on an enlarged 15×15 board with doubled piece counts
•	Variant Draft — each player selects one special abilities before the match; the two chosen abilities define the entire strategic texture of the game
•	AP Economy — Each player begins the match with 0 AP. Every capture and being captured earns Action Points; AP is the gate to activating variants, creating an inherent tension between aggression (earning AP) and timing.Each player begins the match with 0 AP.
•	Information Asymmetry — certain variants fundamentally alter what each player can perceive about the board state

Match Flow (Phases)
1 Variant Selection
-Each player selects exactly one Variant before entering matchmaking
-Selection is made independently and privately — players do not see each other's choice
-The selected Variant is locked in and cannot be changed after this phase
-Both players may select the same Variant (mirror match is allowed)
2 Matchmaking
-Players connect via online matchmaking or local connection.
3 Variant Setup
-(Conditional) Perform variant-specific setup.
Examples: assigning bomb pieces, configuring special rules.
4 Game Initialization
-Initialize board state
-Spawn pieces
-Apply starting effects
5 Playing
-Main game loop — players alternate turns until a win condition is met.

Turn Structure
Each turn consists of the following phases:
1 Start Phase
-Trigger "on turn start" effects
-Update duration-based effects

2 Action Phase 

During the Action Phase, the player must perform actions under a strict sequence constraint.

  Allowed Action Flow

Each turn, the player must perform exactly one Move action.
The player may optionally perform one Skill action

Valid Action Orders

The player can only act in one of the following sequences:

1. Skill → Move
2. Move → Skill
3. Move only → End Turn(if the player chooses not to use a skill)

Restrictions

The player cannot skip the Move action
The player cannot perform multiple Moves
The player cannot perform multiple Skills
The player cannot end the turn before performing a Move
Once both allowed actions are completed (or Move is completed without Skill), the turn ends.

Execution Rules

Each action resolves immediately upon execution.
After performing one action, the system updates the game state before allowing the next action.
The system must track:

   `hasMoved: boolean`
   `hasUsedSkill: boolean`

Turn End Conditions

Turn automatically ends when:

`hasMoved == true` AND (`hasUsedSkill == true` OR player skips skill)
 OR player manually ends turn after completing Move



3 Immediate Resolution
-Movement resolves instantly
-Captures occur immediately
-On-hit / on-capture effects trigger
4 End Phase
-Resolve delayed systems (define in D:\Variants\docs\Variants.md)
-Trigger "on turn end" effects
5 Cleanup Phase
-Remove expired effects
-Trigger "on expire" effects
-Finalize board state
________________________________________
STEP 2 — GAMEPLAY RULES
Board Configuration
•	Grid: 15 columns (A–O) × 15 rows (1–15), totaling 225 squares
•	Alternating light/dark squares (purely cosmetic; no mechanical effect except for Bishop color)
Starting Setup
Back Rank (Row 1 for Black / Row 15 for White): R N B R N B Q K Q B N R B N R
Reading from left to right: Rook, Knight, Bishop, Rook, Knight, Bishop, Queen, King (center, column H), then mirror on the right — Queen, Bishop, Knight, Rook, Bishop, Knight, Rook.
•	The King occupies the exact center column (column 8 of 15).
•	Both players have 2 Queens, 4 Rooks, 4 Knights, 4 Bishops, 15 Pawns, 1 King = 30 pieces per side
•	Row 2 (Black) / Row 14 (White) are entirely filled with Pawns
Movement Rules
Pawn:
•	Moves forward one square
•	Can move two squares forward from its starting row only (Row 14 for White, Row 2 for Black)
•	Captures diagonally forward one square only
•	No en passant
•	Promotes to Queen automatically upon reaching the opposite back rank (Row 1 for White pawns, Row 15 for Black pawns)
•	Promotion grants +3 bonus AP to the promoting player
Rook:
•	Slides any number of squares orthogonally (up, down, left, right)
•	Blocked by any intervening piece
•	Captures by landing on enemy piece
Bishop:
•	Slides any number of squares diagonally
• Special Rule — Lateral Step: Can also move exactly 1 square left or right (not forward/backward). Direction is absolute — left means toward column A,right means toward column O, regardless of piece color.
•	Blocked by intervening pieces on diagonals; the lateral step is always only 1 square
Queen:
•	Slides any number of squares in all 8 directions (orthogonal + diagonal)
•	Standard queen movement
Knight:
•	Classic L-shape: 2+1 or 1+2 in any orientation = 8 possible landing squares
•	Jumps over any pieces — not blocked by intervening pieces
King:
•	Moves exactly 1 square in any of the 8 directions
•	No castling implemented
Capture Rules
•	Capturing is performed by moving onto an enemy-occupied square
•	The capturing piece replaces the captured piece
•	No check or checkmate system — the King is treated as a regular piece; the game ends when a King is physically captured or destroyed, not merely threatened
•	This is a critical design departure from standard chess
AP (Action Points) Economy
Captured Piece	AP Gained
Pawn	2
Knight	3
Bishop	3
Rook	4
Queen	5
Promotion	+3 (bonus, on top of move)
Lost Piece AP Gained
Pawn	1
Knight	2
Bishop	2
Rook	3
Queen	4

Capturing the King ends the game immediately — no AP is awarded. Win condition takes priority over AP resolution.

AP Gain on Capture (Dual Reward)
- Both players gain AP simultaneously when a capture occurs
- The capturing player gains AP based on the piece they captured (Captured Piece table)
- The player who lost the piece gains AP based on the piece they lost (Lost Piece table)

Example:
  White captures Black's Knight
  → White gains 3 AP (captured a Knight)
  → Black gains 2 AP (lost a Knight)
  Both amounts are credited immediately at the moment of capture.

AP accumulates until a player spends it activating their variant's skills. There is no AP cap, no decay, and AP is not shared — each player has their own pool.
Win Conditions
There are three ways the game ends:
1.	King captured: Any piece moves onto the King's square
2.	King destroyed by Variant's Skills
3.  If both Kings are destroyed simultaneously, the active player wins(This condition can only occur through Variant skills — defined in Variants.md) 
There is a draw system: Threefold repetition detection.
Draw — Threefold Repetition
- Detected automatically by the system
- Based on board state only (AP values not included)
- Game ends as draw immediately upon the third identical board state
- No player action required to claim
________________________________________
STEP 3 — PLAYER SYSTEM

Player Count
• 1v1 only — exactly two players: White and Black
• Supports both online multiplayer and local 2-player modes

Turn Order
• White always moves first after setup
• Turns alternate strictly between White and Black

Actions
An action is any operation performed during the Action Phase.

Types of actions include:
• Move: moving a piece to a legal square
• Skill: activating a variant-specific ability

Skill actions consume AP. Move actions do not.

Movement
• Does not consume AP
• Can only be performed once per turn
• Must follow legal movement rules
• May be restricted by effects (e.g., stun,berserk,etc )

What a Player Can Do Each Turn
- Must perform exactly one Move action per turn — this is mandatory
- May optionally perform one Skill action per turn — this requires sufficient AP
- Valid sequences for the turn:
  - Skill → Move
  - Move → Skill
  - Move only (if player chooses not to use a Skill)
- The turn ends once both allowed actions are completed,
  or once Move is completed and player skips Skill

Action Constraints
• A player cannot activate skills without sufficient AP
• Skills do not have cooldowns
• Effects may restrict available actions, example:
  - Silence prevents skill activation
  - Stun prevents movement
  - Berserk may force or restrict targeting

Control Rules
• Players control all pieces of their color
• Variants may override control rules

Restrictions
• Players cannot act outside their turn
• Invalid actions are rejected and do not consume AP
• Skills must target valid entities or positions

Win Condition Interrupt
• If a win condition is met during a turn, the game ends immediately
________________________________________
STEP 4 — PIECES / UNITS

Piece Overview
The game uses an expanded chess piece set on a 15×15 board.
Each piece type has defined movement rules (see Gameplay Rules) and intrinsic properties that define its role and behavior.

This section only defines core piece data. All variant-specific interactions (e.g., Atomic, Fog, Lightning) are handled separately in the Variant System.


Piece Attributes
Each piece type defines:
• Count per player
• Role (functional identity)
• Intrinsic rules or constraints


Piece Details

Pawn (P)
• Count: 15 per side
• Role: Frontline unit
• Starting row: Row 14 (White), Row 2 (Black)
• Intrinsic Rules:
  - Can move two squares only from starting row
  - Captures diagonally forward
  - Promotes to Queen upon reaching the back rank
  - No underpromotion


Knight (N)
• Count: 4 per side
• Role: Mobile jumper
• Intrinsic Rules:
  - Moves in L-shape (2+1)
  - Ignores blocking pieces


Bishop (B)
• Count: 4 per side
• Role: Hybrid slider
• Intrinsic Rules:
  - Moves diagonally any number of squares
  - Can move exactly 1 square horizontally (lateral step).
    Left = toward column A, right = toward column O (absolute board axis).

Rook (R)
• Count: 4 per side
• Role: Long-range control
• Intrinsic Rules:
  - Moves any number of squares orthogonally


Queen (Q)
• Count: 2 per side
• Role: High-mobility power unit
• Intrinsic Rules:
  - Moves any number of squares in all 8 directions


King (K)
• Count: 1 per side
• Role: Critical unit
• Intrinsic Rules:
  - Moves exactly 1 square in any direction
  - Not subject to check or checkmate rules
• Win Condition:
  - Capturing the King ends the game immediately
  - Destroying the King also ends the game
________________________________________
STEP 5 — EFFECT SYSTEM 

Overview
Effects are stateful modifiers that alter gameplay behavior. They can restrict actions, modify rules, or introduce conditional logic.

Effects are applied dynamically during gameplay, typically through skills or variant mechanics.

Effect Targets
Effects can be applied to:
• Player — affects global player capabilities (e.g., Silence)
• Piece — affects individual units (e.g., Stun, Berserk)
• Board — affects tiles or regions (optional, for variants)

Effect Lifecycle

Each effect follows a defined lifecycle:

1. Apply
• The effect is attached to a target
• Initial logic may be executed immediately

2. Active
• The effect influences gameplay while active
• It may respond to game events via hooks

3. Tick (optional)
• Effects with duration are updated over time
• Typically triggered at:
  - Turn Start
  - Turn End

4. Expire
• The effect is removed
• Cleanup or final logic may be executed

Duration Rules

Effects may define duration in turns:
• Duration decreases at a defined timing (e.g., Start Phase)
• When duration reaches 0 → effect expires

Effects without duration remain until explicitly removed

Effect Stacking

By default:
• Multiple instances of the same effect do not stack

Each effect must define its stacking rule:
• Refresh — reset duration
• Stack — accumulate intensity or counters
• Ignore — new applications are discarded


Effect Priority

When multiple effects conflict:
• Resolution follows priority or explicit rules defined per effect
• If no rule is defined, effects resolve in order of application

Action Restriction

Effects may restrict available actions:
Example:
• Silence:
  - Prevents the player from activating skills

• Stun:
  - Prevents the affected piece from being used

• Berserk:
  - May conditionally restrict capture or targeting


Event Hooks

Effects may respond to game events through hooks.

Common hooks include:

• OnApply
• OnExpire

• OnTurnStart
• OnTurnEnd

• OnMove
• OnCapture
• OnPieceDestroyed

• OnSkillUse

Effects may define behavior for any relevant hook.

Hook Execution Rules
• Hooks are triggered during the corresponding phase or event
• Effects may modify or cancel outcomes
• If multiple effects respond to the same event:
  - Resolve based on priority or application order


Interaction with Variants
• Effects are typically applied by variant skills
• Variants may define custom effects
• Core effects (e.g., Stun, Silence) are reusable across variants

State and Ownership
• Each effect instance tracks:
  - Target (player, piece, or tile)
  - Owner (source player)
  - Remaining duration (if applicable)

• Effects are removed when:
  - Duration expires
  - Target is destroyed (for piece effects)
  - Explicitly cleared by another effect or rule
________________________________________
STEP 6 — SKILLS SYSTEM (VARIANTS)

Overview
Draft Rules
-Draft occurs before matchmaking, not during lobby
-Each player selects exactly one Variant independently
-The system then matches players randomly regardless of Variant choice
-Mirror matches (both players selecting the same Variant) are permitted
-Selected Variants are revealed to both players at Game Initialization
-Variant selection cannot be changed once matchmaking begins

The Variant system defines the core strategic identity of each player.

Each player selects exactly one Variant during the Draft phase

The selected Variant remains active for the entire match and cannot be changed.


Design Philosophy
• Variants are not hardcoded and support unlimited expansion
• New variants can be added without modifying the core game loop
• Variants define gameplay through skills and effects


Variant Structure
Each Variant defines a set of skills.

Each skill must:
• Have an AP cost
• Define activation conditions
• Apply one or more effects (see Effect System)
• Specify usage rules


Skill Rules
• Skills consume AP upon use
• Skills do not have cooldowns
• A player may activate at most one Skill per turn — total, across all Skill IDs
• Using a Skill of any kind consumes the player's Skill action for that turn
• Skill usage resets at the start of the player's turn
• Skills are activated during the Action Phase unless specified otherwise
• Skills may only be activated if their defined conditions are met


Usage Rules
Each skill must define its usage behavior:
- Once per turn (default) — counts as the player's one Skill action for the turn
- One-time use — can only ever be activated once per match
- Repeatable — exception rule: this Skill may be activated multiple times
  within the same turn, but still consumes the single Skill action slot
  (i.e. the player uses all repetitions before proceeding to or after Move)


Unlock Conditions
Skills may define custom unlock conditions, such as:
• Minimum turn count
• Board state conditions
• AP thresholds
• Other variant-specific requirements


Effect Integration
• Skills apply effects defined in the Effect System
• Effects handle all state changes, restrictions, and triggers


Variant Template

Variant Name: [Name]

Skills:
- Skill Name: [Name]
  AP Cost: [X]
  Activation Condition: [Condition]
  Usage Rule: [Once per turn / One-time / Repeatable]
  Effect: [Describe applied effects]

Strategic Identity:
[How this variant changes gameplay and decision-making]
________________________________________
