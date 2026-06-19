"use strict";
// ============================================================
// game-core - Public API
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeterministicRng = exports.ActionHistory = exports.PRIORITY = exports.EventBus = exports.createOnPieceAttackedEvent = exports.createOnCheckEvent = exports.createOnGameOverEvent = exports.createOnPawnPromotionEvent = exports.createOnAPSpentEvent = exports.createOnAPGainedEvent = exports.createOnEffectTickEvent = exports.createOnEffectExpiredEvent = exports.createOnEffectAppliedEvent = exports.createOnSkillUsedEvent = exports.createOnPieceSpawnEvent = exports.createOnPieceDestroyedEvent = exports.createOnBeforePieceDestroyedEvent = exports.createOnPieceDeathEvent = exports.createOnCaptureEvent = exports.createOnBeforeCaptureEvent = exports.createOnMoveEvent = exports.createOnBeforeMoveEvent = exports.createOnTurnEndEvent = exports.createOnTurnStartEvent = exports.FateHandler = exports.JudgmentHandler = exports.BlessingHandler = exports.SilenceHandler = exports.BerserkHandler = exports.LandmineHandler = exports.BombHandler = exports.SanctuaryHandler = exports.ShieldHandler = exports.MountainHandler = exports.StunHandler = exports.EffectRegistry = exports.Match = exports.validateMove = exports.getBaseLegalMoves = exports.getLegalMoves = exports.createInitialBoard = exports.oppositeColor = exports.Color = exports.PieceType = exports.posEquals = exports.isInBounds = exports.fromAlgebraic = exports.toAlgebraic = exports.BOARD_SIZE = exports.Board = void 0;
exports.RequiemVariant = exports.AngelVariant = exports.NephalemVariant = exports.GuardianVariant = exports.LightningVariant = exports.VariantRegistry = exports.MoveModifierChain = exports.isInRegion = exports.getRingRegion = exports.getDirectionalRect = exports.getXRegion = exports.getCrossRegion = exports.getSquareRegion = exports.getRegion = exports.isKingAttacked = exports.getAttackedPieces = exports.isSquareAttackedBy = exports.getAttackedSquares = exports.SkillValidator = exports.APValidator = exports.TurnPhaseValidator = exports.BasicMoveValidator = exports.ActionPipeline = exports.SnapshotManager = exports.GameState = void 0;
// Board
var Board_1 = require("./board/Board");
Object.defineProperty(exports, "Board", { enumerable: true, get: function () { return Board_1.Board; } });
Object.defineProperty(exports, "BOARD_SIZE", { enumerable: true, get: function () { return Board_1.BOARD_SIZE; } });
var Position_1 = require("./board/Position");
Object.defineProperty(exports, "toAlgebraic", { enumerable: true, get: function () { return Position_1.toAlgebraic; } });
Object.defineProperty(exports, "fromAlgebraic", { enumerable: true, get: function () { return Position_1.fromAlgebraic; } });
Object.defineProperty(exports, "isInBounds", { enumerable: true, get: function () { return Position_1.isInBounds; } });
Object.defineProperty(exports, "posEquals", { enumerable: true, get: function () { return Position_1.posEquals; } });
// Pieces
var Piece_1 = require("./pieces/Piece");
Object.defineProperty(exports, "PieceType", { enumerable: true, get: function () { return Piece_1.PieceType; } });
Object.defineProperty(exports, "Color", { enumerable: true, get: function () { return Piece_1.Color; } });
Object.defineProperty(exports, "oppositeColor", { enumerable: true, get: function () { return Piece_1.oppositeColor; } });
var initialLayout_1 = require("./pieces/initialLayout");
Object.defineProperty(exports, "createInitialBoard", { enumerable: true, get: function () { return initialLayout_1.createInitialBoard; } });
// Movement
var MoveGenerator_1 = require("./movement/MoveGenerator");
Object.defineProperty(exports, "getLegalMoves", { enumerable: true, get: function () { return MoveGenerator_1.getLegalMoves; } });
Object.defineProperty(exports, "getBaseLegalMoves", { enumerable: true, get: function () { return MoveGenerator_1.getBaseLegalMoves; } });
// Validation
var MoveValidator_1 = require("./validation/MoveValidator");
Object.defineProperty(exports, "validateMove", { enumerable: true, get: function () { return MoveValidator_1.validateMove; } });
// Match
var Match_1 = require("./match/Match");
Object.defineProperty(exports, "Match", { enumerable: true, get: function () { return Match_1.Match; } });
var EffectRegistry_1 = require("./effect/EffectRegistry");
Object.defineProperty(exports, "EffectRegistry", { enumerable: true, get: function () { return EffectRegistry_1.EffectRegistry; } });
var StunHandler_1 = require("./effect/handlers/StunHandler");
Object.defineProperty(exports, "StunHandler", { enumerable: true, get: function () { return StunHandler_1.StunHandler; } });
var MountainHandler_1 = require("./effect/handlers/MountainHandler");
Object.defineProperty(exports, "MountainHandler", { enumerable: true, get: function () { return MountainHandler_1.MountainHandler; } });
var ShieldHandler_1 = require("./effect/handlers/ShieldHandler");
Object.defineProperty(exports, "ShieldHandler", { enumerable: true, get: function () { return ShieldHandler_1.ShieldHandler; } });
var SanctuaryHandler_1 = require("./effect/handlers/SanctuaryHandler");
Object.defineProperty(exports, "SanctuaryHandler", { enumerable: true, get: function () { return SanctuaryHandler_1.SanctuaryHandler; } });
var BombHandler_1 = require("./effect/handlers/BombHandler");
Object.defineProperty(exports, "BombHandler", { enumerable: true, get: function () { return BombHandler_1.BombHandler; } });
var LandmineHandler_1 = require("./effect/handlers/LandmineHandler");
Object.defineProperty(exports, "LandmineHandler", { enumerable: true, get: function () { return LandmineHandler_1.LandmineHandler; } });
var BerserkHandler_1 = require("./effect/handlers/BerserkHandler");
Object.defineProperty(exports, "BerserkHandler", { enumerable: true, get: function () { return BerserkHandler_1.BerserkHandler; } });
var SilenceHandler_1 = require("./effect/handlers/SilenceHandler");
Object.defineProperty(exports, "SilenceHandler", { enumerable: true, get: function () { return SilenceHandler_1.SilenceHandler; } });
var BlessingHandler_1 = require("./effect/handlers/BlessingHandler");
Object.defineProperty(exports, "BlessingHandler", { enumerable: true, get: function () { return BlessingHandler_1.BlessingHandler; } });
var JudgmentHandler_1 = require("./effect/handlers/JudgmentHandler");
Object.defineProperty(exports, "JudgmentHandler", { enumerable: true, get: function () { return JudgmentHandler_1.JudgmentHandler; } });
var FateHandler_1 = require("./effect/handlers/FateHandler");
Object.defineProperty(exports, "FateHandler", { enumerable: true, get: function () { return FateHandler_1.FateHandler; } });
var GameEvent_1 = require("./event/GameEvent");
Object.defineProperty(exports, "createOnTurnStartEvent", { enumerable: true, get: function () { return GameEvent_1.createOnTurnStartEvent; } });
Object.defineProperty(exports, "createOnTurnEndEvent", { enumerable: true, get: function () { return GameEvent_1.createOnTurnEndEvent; } });
Object.defineProperty(exports, "createOnBeforeMoveEvent", { enumerable: true, get: function () { return GameEvent_1.createOnBeforeMoveEvent; } });
Object.defineProperty(exports, "createOnMoveEvent", { enumerable: true, get: function () { return GameEvent_1.createOnMoveEvent; } });
Object.defineProperty(exports, "createOnBeforeCaptureEvent", { enumerable: true, get: function () { return GameEvent_1.createOnBeforeCaptureEvent; } });
Object.defineProperty(exports, "createOnCaptureEvent", { enumerable: true, get: function () { return GameEvent_1.createOnCaptureEvent; } });
Object.defineProperty(exports, "createOnPieceDeathEvent", { enumerable: true, get: function () { return GameEvent_1.createOnPieceDeathEvent; } });
Object.defineProperty(exports, "createOnBeforePieceDestroyedEvent", { enumerable: true, get: function () { return GameEvent_1.createOnBeforePieceDestroyedEvent; } });
Object.defineProperty(exports, "createOnPieceDestroyedEvent", { enumerable: true, get: function () { return GameEvent_1.createOnPieceDestroyedEvent; } });
Object.defineProperty(exports, "createOnPieceSpawnEvent", { enumerable: true, get: function () { return GameEvent_1.createOnPieceSpawnEvent; } });
Object.defineProperty(exports, "createOnSkillUsedEvent", { enumerable: true, get: function () { return GameEvent_1.createOnSkillUsedEvent; } });
Object.defineProperty(exports, "createOnEffectAppliedEvent", { enumerable: true, get: function () { return GameEvent_1.createOnEffectAppliedEvent; } });
Object.defineProperty(exports, "createOnEffectExpiredEvent", { enumerable: true, get: function () { return GameEvent_1.createOnEffectExpiredEvent; } });
Object.defineProperty(exports, "createOnEffectTickEvent", { enumerable: true, get: function () { return GameEvent_1.createOnEffectTickEvent; } });
Object.defineProperty(exports, "createOnAPGainedEvent", { enumerable: true, get: function () { return GameEvent_1.createOnAPGainedEvent; } });
Object.defineProperty(exports, "createOnAPSpentEvent", { enumerable: true, get: function () { return GameEvent_1.createOnAPSpentEvent; } });
Object.defineProperty(exports, "createOnPawnPromotionEvent", { enumerable: true, get: function () { return GameEvent_1.createOnPawnPromotionEvent; } });
Object.defineProperty(exports, "createOnGameOverEvent", { enumerable: true, get: function () { return GameEvent_1.createOnGameOverEvent; } });
Object.defineProperty(exports, "createOnCheckEvent", { enumerable: true, get: function () { return GameEvent_1.createOnCheckEvent; } });
Object.defineProperty(exports, "createOnPieceAttackedEvent", { enumerable: true, get: function () { return GameEvent_1.createOnPieceAttackedEvent; } });
var EventBus_1 = require("./event/EventBus");
Object.defineProperty(exports, "EventBus", { enumerable: true, get: function () { return EventBus_1.EventBus; } });
var ResolutionOrder_1 = require("./event/ResolutionOrder");
Object.defineProperty(exports, "PRIORITY", { enumerable: true, get: function () { return ResolutionOrder_1.PRIORITY; } });
var ActionHistory_1 = require("./action/ActionHistory");
Object.defineProperty(exports, "ActionHistory", { enumerable: true, get: function () { return ActionHistory_1.ActionHistory; } });
// RNG
var DeterministicRng_1 = require("./rng/DeterministicRng");
Object.defineProperty(exports, "DeterministicRng", { enumerable: true, get: function () { return DeterministicRng_1.DeterministicRng; } });
// State
var GameState_1 = require("./state/GameState");
Object.defineProperty(exports, "GameState", { enumerable: true, get: function () { return GameState_1.GameState; } });
var Snapshot_1 = require("./state/Snapshot");
Object.defineProperty(exports, "SnapshotManager", { enumerable: true, get: function () { return Snapshot_1.SnapshotManager; } });
// Action Pipeline
var ActionPipeline_1 = require("./action/ActionPipeline");
Object.defineProperty(exports, "ActionPipeline", { enumerable: true, get: function () { return ActionPipeline_1.ActionPipeline; } });
Object.defineProperty(exports, "BasicMoveValidator", { enumerable: true, get: function () { return ActionPipeline_1.BasicMoveValidator; } });
Object.defineProperty(exports, "TurnPhaseValidator", { enumerable: true, get: function () { return ActionPipeline_1.TurnPhaseValidator; } });
Object.defineProperty(exports, "APValidator", { enumerable: true, get: function () { return ActionPipeline_1.APValidator; } });
Object.defineProperty(exports, "SkillValidator", { enumerable: true, get: function () { return ActionPipeline_1.SkillValidator; } });
// Combat — Attack Detection [Step 4]
var AttackDetection_1 = require("./combat/AttackDetection");
Object.defineProperty(exports, "getAttackedSquares", { enumerable: true, get: function () { return AttackDetection_1.getAttackedSquares; } });
Object.defineProperty(exports, "isSquareAttackedBy", { enumerable: true, get: function () { return AttackDetection_1.isSquareAttackedBy; } });
Object.defineProperty(exports, "getAttackedPieces", { enumerable: true, get: function () { return AttackDetection_1.getAttackedPieces; } });
Object.defineProperty(exports, "isKingAttacked", { enumerable: true, get: function () { return AttackDetection_1.isKingAttacked; } });
// Region Utilities [Step 4]
var Region_1 = require("./region/Region");
Object.defineProperty(exports, "getRegion", { enumerable: true, get: function () { return Region_1.getRegion; } });
Object.defineProperty(exports, "getSquareRegion", { enumerable: true, get: function () { return Region_1.getSquareRegion; } });
Object.defineProperty(exports, "getCrossRegion", { enumerable: true, get: function () { return Region_1.getCrossRegion; } });
Object.defineProperty(exports, "getXRegion", { enumerable: true, get: function () { return Region_1.getXRegion; } });
Object.defineProperty(exports, "getDirectionalRect", { enumerable: true, get: function () { return Region_1.getDirectionalRect; } });
Object.defineProperty(exports, "getRingRegion", { enumerable: true, get: function () { return Region_1.getRingRegion; } });
Object.defineProperty(exports, "isInRegion", { enumerable: true, get: function () { return Region_1.isInRegion; } });
var MoveModifierChain_1 = require("./modifier/MoveModifierChain");
Object.defineProperty(exports, "MoveModifierChain", { enumerable: true, get: function () { return MoveModifierChain_1.MoveModifierChain; } });
var VariantRegistry_1 = require("./variant/VariantRegistry");
Object.defineProperty(exports, "VariantRegistry", { enumerable: true, get: function () { return VariantRegistry_1.VariantRegistry; } });
var LightningVariant_1 = require("./variant/variants/LightningVariant");
Object.defineProperty(exports, "LightningVariant", { enumerable: true, get: function () { return LightningVariant_1.LightningVariant; } });
var GuardianVariant_1 = require("./variant/variants/GuardianVariant");
Object.defineProperty(exports, "GuardianVariant", { enumerable: true, get: function () { return GuardianVariant_1.GuardianVariant; } });
var NephalemVariant_1 = require("./variant/variants/NephalemVariant");
Object.defineProperty(exports, "NephalemVariant", { enumerable: true, get: function () { return NephalemVariant_1.NephalemVariant; } });
var AngelVariant_1 = require("./variant/variants/AngelVariant");
Object.defineProperty(exports, "AngelVariant", { enumerable: true, get: function () { return AngelVariant_1.AngelVariant; } });
var RequiemVariant_1 = require("./variant/variants/RequiemVariant");
Object.defineProperty(exports, "RequiemVariant", { enumerable: true, get: function () { return RequiemVariant_1.RequiemVariant; } });
//# sourceMappingURL=index.js.map