// ============================================================
// Game Info Component - Turn, status, room code display
// ============================================================

'use client';

import { Color } from 'game-core';
import { useGameStore } from '../store/gameStore';

export default function GameInfo() {
  const {
    roomCode,
    playerColor,
    currentTurn,
    phase,
    winner,
    errorMessage,
    opponentDisconnected,
    resetGame,
    togglePlayerColor,
  } = useGameStore();

  const isMyTurn = currentTurn === playerColor;

  return (
    <div className="game-info">
      {/* Room Code */}
      {roomCode && (
        <div className="info-row">
          <span className="info-label">Room</span>
          <span className="info-value room-code">{roomCode}</span>
        </div>
      )}

      {/* Player Color */}
      {playerColor && (
        <div className="info-row">
          <span className="info-label">You play</span>
          {phase === 'waiting' ? (
            <button
              onClick={togglePlayerColor}
              title="Click to swap color"
              className={`info-value color-badge cursor-pointer hover:scale-105 active:scale-95 transition-transform duration-100 select-none border-none outline-none ${playerColor === Color.White ? 'color-white' : 'color-black'}`}
              style={{ fontFamily: 'inherit' }}
            >
              {playerColor} ⇄
            </button>
          ) : (
            <span className={`info-value color-badge ${playerColor === Color.White ? 'color-white' : 'color-black'}`}>
              {playerColor}
            </span>
          )}
        </div>
      )}

      {/* Current Turn */}
      {phase === 'playing' && currentTurn && (
        <div className="info-row">
          <span className="info-label">Turn</span>
          <span className={`info-value ${isMyTurn ? 'your-turn' : 'opponent-turn'}`}>
            {isMyTurn ? '⬤ Your turn' : '○ Opponent\'s turn'}
          </span>
        </div>
      )}

      {/* Match Status */}
      {phase === 'waiting' && (
        <div className="status-banner waiting">
          <span>Waiting for opponent to join...</span>
          <button className="btn btn-secondary" onClick={resetGame}>
            Back to Lobby
          </button>
        </div>
      )}

      {phase === 'finished' && winner && (
        <div className={`status-banner ${winner === playerColor ? 'victory' : 'defeat'}`}>
          {winner === playerColor ? '🎉 You win!' : '💀 You lose!'}
          <span className="winner-detail">{winner} wins by capturing the King</span>
          <button className="btn btn-secondary" onClick={resetGame}>
            Back to Lobby
          </button>
        </div>
      )}

      {/* Opponent Disconnected */}
      {opponentDisconnected && phase === 'playing' && (
        <div className="status-banner disconnected">
          ⚠ Opponent disconnected. Waiting for reconnect...
        </div>
      )}

      {/* Error */}
      {errorMessage && (
        <div className="status-banner error">
          {errorMessage}
        </div>
      )}
    </div>
  );
}
