"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createOnTurnStartEvent = createOnTurnStartEvent;
exports.createOnTurnEndEvent = createOnTurnEndEvent;
exports.createOnBeforeMoveEvent = createOnBeforeMoveEvent;
exports.createOnMoveEvent = createOnMoveEvent;
exports.createOnBeforeCaptureEvent = createOnBeforeCaptureEvent;
exports.createOnCaptureEvent = createOnCaptureEvent;
exports.createOnPieceDeathEvent = createOnPieceDeathEvent;
exports.createOnBeforePieceDestroyedEvent = createOnBeforePieceDestroyedEvent;
exports.createOnPieceDestroyedEvent = createOnPieceDestroyedEvent;
exports.createOnPieceSpawnEvent = createOnPieceSpawnEvent;
exports.createOnSkillUsedEvent = createOnSkillUsedEvent;
exports.createOnEffectAppliedEvent = createOnEffectAppliedEvent;
exports.createOnEffectExpiredEvent = createOnEffectExpiredEvent;
exports.createOnEffectTickEvent = createOnEffectTickEvent;
exports.createOnAPGainedEvent = createOnAPGainedEvent;
exports.createOnAPSpentEvent = createOnAPSpentEvent;
exports.createOnPawnPromotionEvent = createOnPawnPromotionEvent;
exports.createOnGameOverEvent = createOnGameOverEvent;
exports.createOnCheckEvent = createOnCheckEvent;
exports.createOnPieceAttackedEvent = createOnPieceAttackedEvent;
// Payload factories
function createOnTurnStartEvent(turnNumber, activePlayer) {
    return { type: 'OnTurnStart', turnNumber, activePlayer, payload: {} };
}
function createOnTurnEndEvent(turnNumber, activePlayer) {
    return { type: 'OnTurnEnd', turnNumber, activePlayer, payload: {} };
}
function createOnBeforeMoveEvent(turnNumber, activePlayer, pieceId, from, to) {
    return { type: 'OnBeforeMove', turnNumber, activePlayer, payload: { pieceId, from, to } };
}
function createOnMoveEvent(turnNumber, activePlayer, pieceId, from, to) {
    return { type: 'OnMove', turnNumber, activePlayer, payload: { pieceId, from, to } };
}
function createOnBeforeCaptureEvent(turnNumber, activePlayer, attackerId, capturedPieceId, from, to) {
    return { type: 'OnBeforeCapture', turnNumber, activePlayer, payload: { attackerId, capturedPieceId, from, to } };
}
function createOnCaptureEvent(turnNumber, activePlayer, attackerId, capturedPieceId, from, to, capturedPieceSnapshot) {
    return {
        type: 'OnCapture',
        turnNumber,
        activePlayer,
        payload: {
            attackerId,
            capturedPieceId,
            from,
            to,
            capturedPieceSnapshot,
        },
    };
}
function createOnPieceDeathEvent(turnNumber, activePlayer, pieceId, position, killedBy, killerId) {
    return { type: 'OnPieceDeath', turnNumber, activePlayer, payload: { pieceId, position, killedBy, killerId } };
}
function createOnBeforePieceDestroyedEvent(turnNumber, activePlayer, pieceSnapshot, position, reason) {
    return {
        type: 'OnBeforePieceDestroyed',
        turnNumber,
        activePlayer,
        payload: { pieceSnapshot, position, reason },
    };
}
function createOnPieceDestroyedEvent(turnNumber, activePlayer, pieceSnapshot, position, reason) {
    return {
        type: 'OnPieceDestroyed',
        turnNumber,
        activePlayer,
        payload: { pieceSnapshot, position, reason },
    };
}
function createOnPieceSpawnEvent(turnNumber, activePlayer, pieceId, position) {
    return { type: 'OnPieceSpawn', turnNumber, activePlayer, payload: { pieceId, position } };
}
function createOnSkillUsedEvent(turnNumber, activePlayer, skillId, targets, actualCost) {
    return { type: 'OnSkillUsed', turnNumber, activePlayer, payload: { skillId, targets, actualCost } };
}
function createOnEffectAppliedEvent(turnNumber, activePlayer, effect) {
    return { type: 'OnEffectApplied', turnNumber, activePlayer, payload: { effect } };
}
function createOnEffectExpiredEvent(turnNumber, activePlayer, effectId, reason, effectSnapshot) {
    return { type: 'OnEffectExpired', turnNumber, activePlayer, payload: { effectId, reason, effectSnapshot } };
}
function createOnEffectTickEvent(turnNumber, activePlayer, effect) {
    return { type: 'OnEffectTick', turnNumber, activePlayer, payload: { effect } };
}
function createOnAPGainedEvent(turnNumber, activePlayer, player, amount, source) {
    return { type: 'OnAPGained', turnNumber, activePlayer, payload: { player, amount, source } };
}
function createOnAPSpentEvent(turnNumber, activePlayer, player, amount, source) {
    return { type: 'OnAPSpent', turnNumber, activePlayer, payload: { player, amount, source } };
}
function createOnPawnPromotionEvent(turnNumber, activePlayer, pieceId, position, promotedTo) {
    return { type: 'OnPawnPromotion', turnNumber, activePlayer, payload: { pieceId, position, promotedTo } };
}
function createOnGameOverEvent(turnNumber, activePlayer, winner, reason) {
    return { type: 'OnGameOver', turnNumber, activePlayer, payload: { winner, reason } };
}
function createOnCheckEvent(turnNumber, activePlayer, attackerPieces, targetPiece, targetPosition) {
    return {
        type: 'OnCheck',
        turnNumber,
        activePlayer,
        payload: { attackerPieces, targetPiece, targetPosition },
    };
}
function createOnPieceAttackedEvent(turnNumber, activePlayer, attacker, target, attackerPos, targetPos) {
    return {
        type: 'OnPieceAttacked',
        turnNumber,
        activePlayer,
        payload: { attacker, target, attackerPos, targetPos },
    };
}
//# sourceMappingURL=GameEvent.js.map