"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ColossusVariant = exports.ColossusActionValidator = void 0;
const Piece_1 = require("../../pieces/Piece");
const apCostConfig_1 = require("../apCostConfig");
const Board_1 = require("../../board/Board");
const SpecialPieceRegistry_1 = require("../../pieces/SpecialPieceRegistry");
const GuardianLinkHandler_1 = require("../../effect/handlers/GuardianLinkHandler");
// Piece value mapping for Guardian Link targets
const PIECE_VALUES = {
    [Piece_1.PieceType.Pawn]: 1,
    [Piece_1.PieceType.Knight]: 3,
    [Piece_1.PieceType.Bishop]: 3,
    [Piece_1.PieceType.Rook]: 5,
    [Piece_1.PieceType.Queen]: 9,
};
// ─────────────────────────────────────────────────────────────────────────────
// ColossusActionValidator
// Sets stayInPlace = true on CaptureActions targetting Titan parts or low link piece
// ─────────────────────────────────────────────────────────────────────────────
class ColossusActionValidator {
    validate(action, state) {
        if (action.type === 'CAPTURE') {
            const target = state.board.getPiece(action.to);
            if (target && target.specialType === 'titan') {
                action.stayInPlace = true;
            }
            if (target &&
                target.effects?.some(e => e.type === 'guardian_link' && e.metadata?.role === 'low')) {
                action.stayInPlace = true;
            }
        }
        return null;
    }
}
exports.ColossusActionValidator = ColossusActionValidator;
// Register the special Titan piece definition at top level
if (!SpecialPieceRegistry_1.specialPieceRegistry.get('titan')) {
    SpecialPieceRegistry_1.specialPieceRegistry.register({
        id: 'titan',
        displayName: 'Titan',
        canBeAttacked: true,
        getLegalMoves: (board, pos, piece) => {
            // Find all 4 parts of this Titan
            const parts = [];
            const targetTitanId = piece.effects?.find((e) => e.type === 'summon_duration' && e.metadata?.titanId)?.metadata?.titanId ||
                piece.id.split('_part_')[0];
            for (let r = 0; r < Board_1.BOARD_SIZE; r++) {
                for (let c = 0; c < Board_1.BOARD_SIZE; c++) {
                    const p = board.getPiece({ col: c, row: r });
                    if (p && p.color === piece.color && p.specialType === 'titan') {
                        const partsTitanId = p.effects?.find((e) => e.type === 'summon_duration' && e.metadata?.titanId)?.metadata?.titanId ||
                            p.id.split('_part_')[0];
                        if (partsTitanId === targetTitanId) {
                            parts.push({ col: c, row: r, id: p.id });
                        }
                    }
                }
            }
            if (parts.length !== 4)
                return [];
            const minCol = Math.min(...parts.map(p => p.col));
            const minRow = Math.min(...parts.map(p => p.row));
            const dc = pos.col - minCol;
            const dr = pos.row - minRow;
            const moves = [];
            const direction = piece.color === Piece_1.Color.White ? 1 : -1;
            // Titan moves forward up to 4 squares
            for (let d = 1; d <= 4; d++) {
                const targetMinRow = minRow + d * direction;
                const targetMinCol = minCol;
                // Bounding box boundary check
                if (targetMinRow < 0 ||
                    targetMinRow + 1 >= Board_1.BOARD_SIZE ||
                    targetMinCol < 0 ||
                    targetMinCol + 1 >= Board_1.BOARD_SIZE) {
                    break;
                }
                // Path block check (cannot trample own King)
                let containsOwnKing = false;
                const startSweptRow = direction === 1 ? minRow + 2 : targetMinRow;
                const endSweptRow = direction === 1 ? targetMinRow + 1 : minRow - 1;
                for (let r = startSweptRow; r <= endSweptRow; r++) {
                    for (let c = minCol; c <= minCol + 1; c++) {
                        const p = board.getPiece({ col: c, row: r });
                        if (p && p.type === Piece_1.PieceType.King && p.color === piece.color) {
                            containsOwnKing = true;
                            break;
                        }
                    }
                    if (containsOwnKing)
                        break;
                }
                if (containsOwnKing) {
                    break; // own King blocks sliding path
                }
                moves.push({ col: minCol + dc, row: targetMinRow + dr });
            }
            return moves;
        },
    });
}
// ─────────────────────────────────────────────────────────────────────────────
// ColossusVariant definition
// ─────────────────────────────────────────────────────────────────────────────
exports.ColossusVariant = {
    id: 'colossus',
    name: 'Colossus',
    description: 'Summon an unstoppable 2x2 Titan that tramples anything in its path, link allies defensively, and tremble the earth.',
    effectHandlers: [
        new GuardianLinkHandler_1.GuardianLinkHandler(),
    ],
    getInitialState: () => ({}),
    actionValidators: [
        new ColossusActionValidator(),
    ],
    onSetup(state, player) {
    },
    passiveHooks: (state, player) => [
        // ── 1. Passive AP Generation (every 4 rounds, gain 4 AP) ──
        {
            id: `colossus_passive_ap_${player}`,
            eventType: 'OnTurnStart',
            priority: 500,
            source: `variant:colossus:${player}`,
            handler: (event, enqueueAction) => {
                if (event.type !== 'OnTurnStart')
                    return;
                if (event.activePlayer !== player)
                    return;
                // Check if player has a Titan on the board
                let titanExists = false;
                for (let r = 0; r < Board_1.BOARD_SIZE; r++) {
                    for (let c = 0; c < Board_1.BOARD_SIZE; c++) {
                        const p = state.board.getPiece({ col: c, row: r });
                        if (p && p.color === player && p.specialType === 'titan') {
                            titanExists = true;
                            break;
                        }
                    }
                    if (titanExists)
                        break;
                }
                if (titanExists) {
                    state.variantState.titanRounds = state.variantState.titanRounds || {};
                    state.variantState.titanRounds[player] = (state.variantState.titanRounds[player] || 0) + 1;
                    if (state.variantState.titanRounds[player] % 4 === 0) {
                        enqueueAction({
                            type: 'GAIN_AP',
                            player,
                            amount: 4,
                            source: 'passive:colossus_ap',
                        });
                    }
                }
            },
        },
        // ── 2. Summoning Countdown Tracker ──
        {
            id: `colossus_summon_tick_${player}`,
            eventType: 'OnTurnStart',
            priority: 600,
            source: `variant:colossus:${player}`,
            handler: (event, enqueueAction) => {
                if (event.type !== 'OnTurnStart')
                    return;
                if (event.activePlayer !== player)
                    return;
                if (state.variantState.titanSummoning && state.variantState.titanSummoning[player]) {
                    const summoning = state.variantState.titanSummoning[player];
                    // Verify if all selected pieces are still alive
                    const piecesAlive = summoning.pieceIds.every((id) => {
                        for (let r = 0; r < Board_1.BOARD_SIZE; r++) {
                            for (let c = 0; c < Board_1.BOARD_SIZE; c++) {
                                const p = state.board.getPiece({ col: c, row: r });
                                if (p && p.id === id && p.color === player) {
                                    return true;
                                }
                            }
                        }
                        return false;
                    });
                    if (!piecesAlive) {
                        // Summoning fails! Clean up effects
                        for (let r = 0; r < Board_1.BOARD_SIZE; r++) {
                            for (let c = 0; c < Board_1.BOARD_SIZE; c++) {
                                const p = state.board.getPiece({ col: c, row: r });
                                if (p && p.color === player && p.effects) {
                                    const mark = p.effects.find(e => e.type === 'titan_summon_mark');
                                    if (mark) {
                                        enqueueAction({
                                            type: 'REMOVE_EFFECT',
                                            effectId: mark.id,
                                            targetId: p.id,
                                            targetType: 'piece',
                                            reason: 'summon_failed',
                                        });
                                    }
                                }
                            }
                        }
                        delete state.variantState.titanSummoning[player];
                    }
                    else {
                        // Tick countdown
                        summoning.roundsRemaining--;
                        if (summoning.roundsRemaining === 0) {
                            // Sacrifice the 4 pieces
                            for (const id of summoning.pieceIds) {
                                let pPos = null;
                                for (let r = 0; r < Board_1.BOARD_SIZE; r++) {
                                    for (let c = 0; c < Board_1.BOARD_SIZE; c++) {
                                        const p = state.board.getPiece({ col: c, row: r });
                                        if (p && p.id === id) {
                                            pPos = { col: c, row: r };
                                            break;
                                        }
                                    }
                                    if (pPos)
                                        break;
                                }
                                if (pPos) {
                                    enqueueAction({
                                        type: 'DESTROY_PIECE',
                                        pieceId: id,
                                        position: pPos,
                                        reason: 'titan_sacrifice',
                                    });
                                }
                            }
                            state.variantState.titanReadyToPlace = state.variantState.titanReadyToPlace || {};
                            state.variantState.titanReadyToPlace[player] = true;
                            delete state.variantState.titanSummoning[player];
                        }
                    }
                }
            },
        },
        // ── 3. Titan Movement Interceptor ──
        {
            id: `colossus_titan_before_move_${player}`,
            eventType: 'OnBeforeMove',
            priority: 200,
            source: `variant:colossus:${player}`,
            handler: (event, enqueueAction) => {
                if (event.type !== 'OnBeforeMove')
                    return;
                if (state.variantState.titanMoving)
                    return;
                const from = event.payload.from;
                const to = event.payload.to;
                const piece = state.board.getPiece(from);
                if (piece && piece.color === player && piece.specialType === 'titan') {
                    event.cancelled = true; // Cancel single corner move
                    // Sort Titan parts to find root coordinates
                    const parts = [];
                    for (let r = 0; r < Board_1.BOARD_SIZE; r++) {
                        for (let c = 0; c < Board_1.BOARD_SIZE; c++) {
                            const p = state.board.getPiece({ col: c, row: r });
                            if (p && p.color === player && p.specialType === 'titan') {
                                parts.push({ col: c, row: r, id: p.id });
                            }
                        }
                    }
                    if (parts.length !== 4)
                        return;
                    const minCol = Math.min(...parts.map(p => p.col));
                    const minRow = Math.min(...parts.map(p => p.row));
                    const direction = Math.sign(to.row - from.row);
                    const d = Math.abs(to.row - from.row);
                    state.variantState.titanMoving = true;
                    state.variantState.titanPartsMoved = 0;
                    // Destroy any pieces in the swept 2x2 path
                    const startSweptRow = direction === 1 ? minRow + 2 : minRow - d;
                    const endSweptRow = direction === 1 ? minRow + d + 1 : minRow - 1;
                    for (let r = startSweptRow; r <= endSweptRow; r++) {
                        for (let c = minCol; c <= minCol + 1; c++) {
                            const p = state.board.getPiece({ col: c, row: r });
                            if (p) {
                                const isPart = parts.some(part => part.id === p.id);
                                if (!isPart) {
                                    enqueueAction({
                                        type: 'DESTROY_PIECE',
                                        pieceId: p.id,
                                        position: { col: c, row: r },
                                        reason: 'titan_trample',
                                    });
                                }
                            }
                        }
                    }
                    // Enqueue movement for all 4 corners
                    for (const part of parts) {
                        const targetPos = { col: part.col, row: part.row + d * direction };
                        enqueueAction({
                            type: 'MOVE_PIECE',
                            pieceId: part.id,
                            from: { col: part.col, row: part.row },
                            to: targetPos,
                        });
                    }
                }
            },
        },
        // ── 4. Titan Parts Movement Complete Tracker ──
        {
            id: `colossus_titan_on_move_${player}`,
            eventType: 'OnMove',
            priority: 200,
            source: `variant:colossus:${player}`,
            handler: (event, enqueueAction) => {
                if (event.type !== 'OnMove')
                    return;
                if (state.variantState.titanMoving) {
                    state.variantState.titanPartsMoved = (state.variantState.titanPartsMoved || 0) + 1;
                    if (state.variantState.titanPartsMoved === 4) {
                        state.variantState.titanMoving = false;
                        state.variantState.titanPartsMoved = 0;
                    }
                }
            },
        },
        // ── 5. Titan Capture Interception & Lives Tracker ──
        {
            id: `colossus_titan_on_capture_${player}`,
            eventType: 'OnCapture',
            priority: 200,
            source: `variant:colossus:${player}`,
            handler: (event, enqueueAction) => {
                if (event.type !== 'OnCapture')
                    return;
                const { capturedPieceSnapshot, to } = event.payload;
                if (capturedPieceSnapshot &&
                    capturedPieceSnapshot.color === player &&
                    capturedPieceSnapshot.specialType === 'titan') {
                    const meta = capturedPieceSnapshot.effects?.find((e) => e.type === 'summon_duration' && e.metadata?.titanId);
                    const titanId = meta?.metadata?.titanId || capturedPieceSnapshot.id.split('_part_')[0];
                    state.variantState.titans = state.variantState.titans || {};
                    state.variantState.titans[titanId] = state.variantState.titans[titanId] || { lives: 4 };
                    state.variantState.titans[titanId].lives--;
                    if (state.variantState.titans[titanId].lives > 0) {
                        // Respawn the captured part at its position
                        enqueueAction({
                            type: 'SPAWN_PIECE',
                            piece: capturedPieceSnapshot,
                            position: to,
                        });
                    }
                    else {
                        // Destroy the other 3 parts
                        for (let r = 0; r < Board_1.BOARD_SIZE; r++) {
                            for (let c = 0; c < Board_1.BOARD_SIZE; c++) {
                                const p = state.board.getPiece({ col: c, row: r });
                                if (p && p.color === player && p.specialType === 'titan') {
                                    const partMeta = p.effects?.find((e) => e.type === 'summon_duration' && e.metadata?.titanId);
                                    const partTitanId = partMeta?.metadata?.titanId || p.id.split('_part_')[0];
                                    if (partTitanId === titanId) {
                                        enqueueAction({
                                            type: 'DESTROY_PIECE',
                                            pieceId: p.id,
                                            position: { col: c, row: r },
                                            reason: 'titan_destroyed',
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
            },
        },
    ],
    skills: [
        // ── Skill 1: Titan Summoning (5 AP) ──
        {
            id: 'colossus_titan_summoning',
            name: 'Titan Summoning',
            description: 'Chọn 4 quân cờ đồng minh. Trong 4 vòng đấu tiếp theo, nếu tất cả đều còn sống, chúng sẽ bị hiến tế để triệu hồi Titan 2x2.',
            tier: 'skill1',
            apCost: apCostConfig_1.APCostConfig.colossus.colossus_skill_1,
            cooldown: 0,
            usageRule: 'once_per_turn',
            getTargetRequirements: () => [
                { type: 'piece', filter: 'ally', excludeKing: true, description: 'Chọn quân đồng minh thứ 1' },
                { type: 'piece', filter: 'ally', excludeKing: true, description: 'Chọn quân đồng minh thứ 2' },
                { type: 'piece', filter: 'ally', excludeKing: true, description: 'Chọn quân đồng minh thứ 3' },
                { type: 'piece', filter: 'ally', excludeKing: true, description: 'Chọn quân đồng minh thứ 4' },
            ],
            canActivate(state, player, targets) {
                if (targets.length !== 4)
                    return 'Select exactly 4 allied pieces';
                const ids = new Set();
                for (const t of targets) {
                    if (t.type !== 'piece' || !t.position || !t.pieceId) {
                        return 'Invalid targets selected';
                    }
                    const piece = state.board.getPiece(t.position);
                    if (!piece || piece.color !== player) {
                        return 'All selected pieces must be friendly';
                    }
                    if (piece.type === Piece_1.PieceType.King) {
                        return 'Cannot target King';
                    }
                    ids.add(t.pieceId);
                }
                if (ids.size !== 4) {
                    return 'Select 4 distinct pieces';
                }
                return null;
            },
            execute(state, player, targets) {
                const now = Date.now();
                const pieceIds = targets.map(t => t.pieceId);
                state.variantState.titanSummoning = state.variantState.titanSummoning || {};
                state.variantState.titanSummoning[player] = {
                    pieceIds,
                    roundsRemaining: 4,
                    activatedRound: state.turnNumber,
                };
                return targets.map(t => ({
                    type: 'APPLY_EFFECT',
                    effect: {
                        id: `titan_summon_mark_${t.pieceId}_${now}`,
                        type: 'titan_summon_mark',
                        duration: null,
                        remainingDuration: null,
                        tickTiming: 'turnEnd',
                        sourcePlayer: player,
                        targetType: 'piece',
                        targetId: t.pieceId,
                        stackingRule: 'ignore',
                        isDebuff: false,
                        metadata: {},
                    },
                }));
            },
        },
        // ── Skill 1 Place Titan Action (0 AP) ──
        {
            id: 'colossus_place_titan',
            name: 'Place Titan',
            description: 'Đặt Titan 2x2 lên một vùng 2x2 trống trên nửa bàn cờ của mình.',
            tier: 'skill1',
            apCost: 0,
            cooldown: 0,
            usageRule: 'once_per_turn',
            getTargetRequirements: () => [
                {
                    type: 'cell',
                    filter: 'empty',
                    description: 'Chọn ô 2x2 trống trên phần sân của mình (chọn góc dưới bên trái)',
                },
            ],
            canActivate(state, player, targets) {
                if (!state.variantState.titanReadyToPlace || !state.variantState.titanReadyToPlace[player]) {
                    return 'Titan summoning conditions have not been met yet';
                }
                if (targets.length !== 1 || targets[0].type !== 'cell' || !targets[0].position) {
                    return 'Select a starting square for the 2x2 Titan';
                }
                const { col, row } = targets[0].position;
                if (col < 0 || col + 1 >= Board_1.BOARD_SIZE || row < 0 || row + 1 >= Board_1.BOARD_SIZE) {
                    return 'Titan would be out of board boundaries';
                }
                if (player === Piece_1.Color.White) {
                    if (row < 0 || row + 1 > 7) {
                        return 'Must place on your side of the board (rows 0 to 7)';
                    }
                }
                else {
                    if (row < 8 || row + 1 > 14) {
                        return 'Must place on your side of the board (rows 8 to 14)';
                    }
                }
                for (let r = row; r <= row + 1; r++) {
                    for (let c = col; c <= col + 1; c++) {
                        if (state.board.getPiece({ col: c, row: r })) {
                            return `Cell (${c}, ${r}) is not empty`;
                        }
                    }
                }
                return null;
            },
            execute(state, player, targets) {
                const { col, row } = targets[0].position;
                const now = Date.now();
                const titanId = `titan_${player}_${now}`;
                state.variantState.titans = state.variantState.titans || {};
                state.variantState.titans[titanId] = { lives: 4 };
                state.variantState.titanRounds = state.variantState.titanRounds || {};
                state.variantState.titanRounds[player] = 0;
                state.variantState.titanReadyToPlace = state.variantState.titanReadyToPlace || {};
                state.variantState.titanReadyToPlace[player] = false;
                const actions = [];
                for (let dr = 0; dr <= 1; dr++) {
                    for (let dc = 0; dc <= 1; dc++) {
                        const partIdx = dc + 2 * dr;
                        const pos = { col: col + dc, row: row + dr };
                        const piece = {
                            id: `${titanId}_part_${partIdx}`,
                            type: 'Titan',
                            color: player,
                            effects: [],
                            specialType: 'titan',
                        };
                        piece.effects.push({
                            id: `titan_meta_${piece.id}_${now}`,
                            type: 'summon_duration',
                            duration: null,
                            remainingDuration: null,
                            tickTiming: 'turnEnd',
                            sourcePlayer: player,
                            targetType: 'piece',
                            targetId: piece.id,
                            stackingRule: 'ignore',
                            isDebuff: false,
                            isHidden: true,
                            metadata: {
                                titanId,
                                partIndex: partIdx,
                            },
                        });
                        actions.push({
                            type: 'SPAWN_PIECE',
                            piece,
                            position: pos,
                        });
                    }
                }
                return actions;
            },
        },
        // ── Skill 2: Guardian Link (4 AP) ──
        {
            id: 'colossus_guardian_link',
            name: 'Guardian Link',
            description: 'Liên kết 2 quân đồng minh. Nếu quân giá trị thấp bị ăn, quân cao chết thay. Nếu quân cao bị ăn, quân thấp nhận Shield.',
            tier: 'skill2',
            apCost: apCostConfig_1.APCostConfig.colossus.colossus_skill_2,
            cooldown: 0,
            usageRule: 'once_per_turn',
            getTargetRequirements: () => [
                { type: 'piece', filter: 'ally', excludeKing: true, description: 'Chọn quân đồng minh thứ 1 (trừ King)' },
                { type: 'piece', filter: 'ally', excludeKing: true, description: 'Chọn quân đồng minh thứ 2 (trừ King)' },
            ],
            canActivate(state, player, targets) {
                if (targets.length !== 2)
                    return 'Select exactly 2 allied pieces';
                const pieces = [];
                for (const t of targets) {
                    if (t.type !== 'piece' || !t.position || !t.pieceId) {
                        return 'Invalid targets';
                    }
                    const piece = state.board.getPiece(t.position);
                    if (!piece || piece.color !== player) {
                        return 'Both pieces must be allied';
                    }
                    if (piece.type === Piece_1.PieceType.King) {
                        return 'Cannot target King';
                    }
                    pieces.push(piece);
                }
                if (pieces[0].id === pieces[1].id) {
                    return 'Cannot link a piece with itself';
                }
                const val0 = PIECE_VALUES[pieces[0].type] || 0;
                const val1 = PIECE_VALUES[pieces[1].type] || 0;
                if (val0 === val1) {
                    return 'Must select pieces with different values (one low-value and one high-value)';
                }
                return null;
            },
            execute(state, player, targets) {
                const now = Date.now();
                const p0 = state.board.getPiece(targets[0].position);
                const p1 = state.board.getPiece(targets[1].position);
                const val0 = PIECE_VALUES[p0.type] || 0;
                const val1 = PIECE_VALUES[p1.type] || 0;
                const lowPiece = val0 < val1 ? p0 : p1;
                const highPiece = val0 < val1 ? p1 : p0;
                const effectIdLow = `guardian_link_${lowPiece.id}_${now}`;
                const effectIdHigh = `guardian_link_${highPiece.id}_${now + 1}`;
                return [
                    {
                        type: 'APPLY_EFFECT',
                        effect: {
                            id: effectIdLow,
                            type: 'guardian_link',
                            duration: 4, // 2 rounds = 4 turns
                            remainingDuration: 4,
                            tickTiming: 'turnEnd',
                            sourcePlayer: player,
                            targetType: 'piece',
                            targetId: lowPiece.id,
                            stackingRule: 'ignore',
                            isDebuff: false,
                            metadata: {
                                role: 'low',
                                linkedPieceId: highPiece.id,
                                partnerEffectId: effectIdHigh,
                                highPieceType: highPiece.type,
                            },
                        },
                    },
                    {
                        type: 'APPLY_EFFECT',
                        effect: {
                            id: effectIdHigh,
                            type: 'guardian_link',
                            duration: 4, // 2 rounds = 4 turns
                            remainingDuration: 4,
                            tickTiming: 'turnEnd',
                            sourcePlayer: player,
                            targetType: 'piece',
                            targetId: highPiece.id,
                            stackingRule: 'ignore',
                            isDebuff: false,
                            metadata: {
                                role: 'high',
                                linkedPieceId: lowPiece.id,
                                partnerEffectId: effectIdLow,
                            },
                        },
                    },
                ];
            },
        },
        // ── Ultimate: Earth Tremor (10 AP) ──
        {
            id: 'colossus_earth_tremor',
            name: 'Earth Tremor',
            description: 'Làm stun toàn bộ quân địch trên hướng di chuyển (phía trước) của Titan trong 3 vòng đấu.',
            tier: 'ultimate',
            apCost: apCostConfig_1.APCostConfig.colossus.colossus_ultimate,
            cooldown: 0,
            usageRule: 'once_per_turn',
            getTargetRequirements: () => [],
            canActivate(state, player, targets) {
                let titanExists = false;
                for (let r = 0; r < Board_1.BOARD_SIZE; r++) {
                    for (let c = 0; c < Board_1.BOARD_SIZE; c++) {
                        const p = state.board.getPiece({ col: c, row: r });
                        if (p && p.color === player && p.specialType === 'titan') {
                            titanExists = true;
                            break;
                        }
                    }
                    if (titanExists)
                        break;
                }
                if (!titanExists)
                    return 'Titan must be on the board to use this skill';
                return null;
            },
            execute(state, player, targets) {
                const parts = [];
                for (let r = 0; r < Board_1.BOARD_SIZE; r++) {
                    for (let c = 0; c < Board_1.BOARD_SIZE; c++) {
                        const p = state.board.getPiece({ col: c, row: r });
                        if (p && p.color === player && p.specialType === 'titan') {
                            parts.push({ col: c, row: r, id: p.id });
                        }
                    }
                }
                if (parts.length === 0)
                    return [];
                const minCol = Math.min(...parts.map(p => p.col));
                const minRow = Math.min(...parts.map(p => p.row));
                const direction = player === Piece_1.Color.White ? 1 : -1;
                const opponentColor = player === Piece_1.Color.White ? Piece_1.Color.Black : Piece_1.Color.White;
                const actions = [];
                const startRow = direction === 1 ? minRow + 2 : 0;
                const endRow = direction === 1 ? 14 : minRow - 1;
                for (let r = startRow; r <= endRow; r++) {
                    for (let c = minCol; c <= minCol + 1; c++) {
                        const pos = { col: c, row: r };
                        const p = state.board.getPiece(pos);
                        if (p && p.color === opponentColor) {
                            actions.push({
                                type: 'APPLY_EFFECT',
                                effect: {
                                    id: `earth_tremor_stun_${p.id}_${Date.now()}`,
                                    type: 'stun',
                                    duration: 6, // 3 rounds = 6 turns
                                    remainingDuration: 6,
                                    tickTiming: 'turnEnd',
                                    sourcePlayer: player,
                                    targetType: 'piece',
                                    targetId: p.id,
                                    stackingRule: 'refresh',
                                    isDebuff: true,
                                    metadata: {},
                                },
                            });
                        }
                    }
                }
                return actions;
            },
        },
    ],
};
//# sourceMappingURL=ColossusVariant.js.map