'use client';

import { useEffect, useState } from 'react';
import { useGameStore } from '../store/gameStore';

function formatTime(ms: number) {
  if (ms < 0) ms = 0;
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export default function GameTimer() {
  const { phase, currentTurn, whiteTimeLeft, blackTimeLeft, lastUpdateLocalTime, playerColor, lastMove } = useGameStore();
  const [displayWhite, setDisplayWhite] = useState(whiteTimeLeft);
  const [displayBlack, setDisplayBlack] = useState(blackTimeLeft);

  useEffect(() => {
    let animationFrameId: number;

    const updateTimer = () => {
      if (phase === 'playing' && lastMove !== null) {
        const elapsed = Date.now() - lastUpdateLocalTime;
        if (currentTurn === 'White') {
          setDisplayWhite(Math.max(0, whiteTimeLeft - elapsed));
          setDisplayBlack(blackTimeLeft);
        } else if (currentTurn === 'Black') {
          setDisplayBlack(Math.max(0, blackTimeLeft - elapsed));
          setDisplayWhite(whiteTimeLeft);
        }
      } else {
        setDisplayWhite(whiteTimeLeft);
        setDisplayBlack(blackTimeLeft);
      }
      animationFrameId = requestAnimationFrame(updateTimer);
    };

    animationFrameId = requestAnimationFrame(updateTimer);
    return () => cancelAnimationFrame(animationFrameId);
  }, [phase, currentTurn, whiteTimeLeft, blackTimeLeft, lastUpdateLocalTime, lastMove]);

  // Determine which timer to show on top vs bottom based on player's color
  // If player is White, White is at the bottom. If player is Black, Black is at the bottom.
  // Wait, standard chess usually puts opponent on top, player on bottom.
  const isFlipped = playerColor === 'Black';

  const topTime = isFlipped ? displayWhite : displayBlack;
  const bottomTime = isFlipped ? displayBlack : displayWhite;

  const topColor = isFlipped ? 'White' : 'Black';
  const bottomColor = isFlipped ? 'Black' : 'White';

  const topActive = currentTurn === topColor && phase === 'playing';
  const bottomActive = currentTurn === bottomColor && phase === 'playing';

  return (
    <div className="w-full h-full flex flex-col justify-between items-center py-20 pointer-events-none">
      {/* Top Timer Container (Circular) */}
      <div 
        className={`w-32 h-32 md:w-40 md:h-40 rounded-full flex flex-col items-center justify-center border-4 transition-colors ${topActive ? 'border-sky-400 bg-sky-950/50 shadow-[0_0_20px_rgba(56,189,248,0.4)]' : 'border-slate-700 bg-slate-900/50'}`}
      >
        <span className="text-xs uppercase tracking-widest text-slate-400 mb-1">{topColor}</span>
        <span className={`text-3xl md:text-4xl font-mono font-bold ${topActive ? 'text-sky-400' : 'text-slate-300'}`}>
          {formatTime(topTime)}
        </span>
      </div>

      {/* Bottom Timer Container (Circular) */}
      <div 
        className={`w-32 h-32 md:w-40 md:h-40 rounded-full flex flex-col items-center justify-center border-4 transition-colors ${bottomActive ? 'border-emerald-400 bg-emerald-950/50 shadow-[0_0_20px_rgba(52,211,153,0.4)]' : 'border-slate-700 bg-slate-900/50'}`}
      >
        <span className="text-xs uppercase tracking-widest text-slate-400 mb-1">{bottomColor}</span>
        <span className={`text-3xl md:text-4xl font-mono font-bold ${bottomActive ? 'text-emerald-400' : 'text-slate-300'}`}>
          {formatTime(bottomTime)}
        </span>
      </div>
    </div>
  );
}
