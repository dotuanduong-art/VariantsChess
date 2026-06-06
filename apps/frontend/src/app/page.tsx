// ============================================================
// Main Page Component
// ============================================================

'use client';

import { useEffect, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import Lobby from '../components/Lobby';
import Board from '../components/Board';
import GameTimer from '../components/GameTimer';

export default function Home() {
  const { phase, winner, playerColor, roomCode, initSocketListeners, surrender, resetGame, togglePlayerColor } = useGameStore();
  const [showOptions, setShowOptions] = useState(false);

  useEffect(() => {
    initSocketListeners();
  }, [initSocketListeners]);

  return (
    <main className="main-layout relative w-full min-h-screen text-[#fcf5e5] overflow-hidden bg-[#0f172a]">
      {/* Options Dropdown */}
      {phase === 'playing' && (
        <div className="absolute top-4 left-4 z-50">
          <div className="relative">
            <button 
              onClick={() => setShowOptions(!showOptions)}
              className="px-4 py-2 bg-slate-800 text-white rounded border border-slate-600 hover:bg-slate-700 transition-colors shadow-md"
            >
              Options
            </button>
            {showOptions && (
              <div className="absolute top-full left-0 mt-2 bg-slate-800 border border-slate-600 rounded shadow-lg p-2 flex flex-col gap-2 min-w-[150px]">
                <button 
                  onClick={() => {
                    if (window.confirm("Are you sure you want to surrender?")) {
                      surrender();
                    }
                    setShowOptions(false);
                  }}
                  className="px-3 py-2 text-red-400 hover:bg-slate-700 rounded text-left w-full transition-colors font-bold"
                >
                  Surrender
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Game Over Screen */}
      {phase === 'finished' && winner && (
        <div className="absolute inset-0 bg-black/80 z-50 flex flex-col items-center justify-center backdrop-blur-sm">
          <h1 className={`text-6xl md:text-8xl font-bold mb-12 uppercase tracking-widest ${winner === playerColor ? 'text-green-500 drop-shadow-[0_0_25px_rgba(34,197,94,0.8)]' : 'text-red-500 drop-shadow-[0_0_25px_rgba(239,68,68,0.8)]'}`}>
            {winner === playerColor ? 'YOU WIN' : 'YOU LOSE'}
          </h1>
          <button 
            onClick={resetGame}
            className="px-8 py-4 bg-slate-800 text-xl text-white font-bold rounded border-2 border-slate-600 hover:bg-slate-700 hover:border-slate-400 hover:scale-105 transition-all shadow-xl"
          >
            Exit to Lobby
          </button>
        </div>
      )}

      <div className="relative z-10 w-full flex flex-col items-center justify-center h-full">
        {phase === 'lobby' ? (
          <Lobby />
        ) : phase === 'waiting' ? (
          <div className="flex flex-col items-center justify-center p-8 bg-slate-900/90 border border-slate-700 rounded-lg shadow-2xl max-w-md w-full gap-6 backdrop-blur-sm">
            <h2 className="text-2xl font-bold tracking-wider text-slate-300">WAITING FOR OPPONENT</h2>
            
            {roomCode && (
              <div className="w-full bg-slate-950 p-4 rounded border border-slate-800 flex flex-col items-center gap-1">
                <span className="text-xs text-slate-500 font-semibold uppercase">Room Code</span>
                <span className="text-3xl font-mono font-bold tracking-widest text-sky-400 select-all">{roomCode}</span>
              </div>
            )}

            {playerColor && (
              <div className="flex justify-between items-center w-full px-2">
                <span className="text-slate-400 font-semibold">You play:</span>
                <button
                  onClick={togglePlayerColor}
                  className={`px-4 py-2 font-mono font-bold border rounded transition-all active:scale-95 ${
                    playerColor === 'White' 
                      ? 'bg-slate-100 text-slate-900 border-white hover:bg-slate-200' 
                      : 'bg-slate-950 text-slate-100 border-slate-700 hover:bg-slate-900'
                  }`}
                >
                  {playerColor} ⇄
                </button>
              </div>
            )}

            <button
              onClick={resetGame}
              className="mt-4 px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded border border-slate-600 w-full transition-colors"
            >
              Cancel / Back to Lobby
            </button>
          </div>
        ) : (
          <div className="game-container flex justify-center items-center w-full h-full relative">
            {/* Timer Left Panel */}
            <div className="absolute left-0 top-0 h-full w-[15%] hidden md:flex flex-col justify-center items-center">
              <GameTimer />
            </div>

            <div className="board-section z-10">
              <Board />
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
