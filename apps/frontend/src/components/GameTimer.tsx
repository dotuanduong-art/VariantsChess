'use client';
 
import { useEffect, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { Board } from 'game-core';
 
function formatTime(ms: number, isTerrain: boolean) {
  if (ms < 0) ms = 0;
  if (isTerrain) {
    const seconds = ms / 1000;
    return `${seconds.toFixed(1)}s`;
  }
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}
 
export default function GameTimer() {
  const { phase, currentTurn, whiteTimeLeft, blackTimeLeft, lastUpdateLocalTime, playerColor, lastMove, board } = useGameStore();
  const [displayWhite, setDisplayWhite] = useState(whiteTimeLeft);
  const [displayBlack, setDisplayBlack] = useState(blackTimeLeft);
 
  // Check if Electric Terrain is active anywhere on the board
  const isElectricTerrainActive = () => {
    if (!board) return false;
    try {
      const boardClass = Board.fromSerializable(board);
      const cellEffects = boardClass.getAllCellEffects();
      for (const list of cellEffects.values()) {
        if (list.some((e: any) => e.type === 'electric_terrain')) {
          return true;
        }
      }
    } catch {
      // ignore
    }
    return false;
  };
 
  const isTerrain = isElectricTerrainActive();
 
  useEffect(() => {
    let animationFrameId: number;
 
    const updateTimer = () => {
      if (phase === 'playing' && lastMove !== null) {
        const elapsed = Date.now() - lastUpdateLocalTime;
        if (isTerrain) {
          const terrainTime = Math.max(0, 3000 - elapsed);
          if (currentTurn === 'White') {
            setDisplayWhite(terrainTime);
            setDisplayBlack(blackTimeLeft);
          } else if (currentTurn === 'Black') {
            setDisplayBlack(terrainTime);
            setDisplayWhite(whiteTimeLeft);
          }
        } else {
          if (currentTurn === 'White') {
            setDisplayWhite(Math.max(0, whiteTimeLeft - elapsed));
            setDisplayBlack(blackTimeLeft);
          } else if (currentTurn === 'Black') {
            setDisplayBlack(Math.max(0, blackTimeLeft - elapsed));
            setDisplayWhite(whiteTimeLeft);
          }
        }
      } else {
        setDisplayWhite(whiteTimeLeft);
        setDisplayBlack(blackTimeLeft);
      }
      animationFrameId = requestAnimationFrame(updateTimer);
    };
 
    animationFrameId = requestAnimationFrame(updateTimer);
    return () => cancelAnimationFrame(animationFrameId);
  }, [phase, currentTurn, whiteTimeLeft, blackTimeLeft, lastUpdateLocalTime, lastMove, isTerrain]);
 
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
    <>
      {/* Top Timer */}
      <div className={`timer-circle ${topActive ? (isTerrain ? 'terrain-active' : 'active') : ''} ${!topActive && phase !== 'playing' ? 'waiting' : ''}`}>
        <span className="timer-label">{topColor}</span>
        <span className="timer-value">{formatTime(topTime, isTerrain && topActive)}</span>
      </div>
 
      {/* Divider */}
      <div className="w-16 h-px bg-slate-700/50 my-2 shrink-0"></div>
 
      {/* Bottom Timer */}
      <div className={`timer-circle ${bottomActive ? (isTerrain ? 'terrain-active' : 'active') : ''} ${!bottomActive && phase !== 'playing' ? 'waiting' : ''}`}>
        <span className="timer-label">{bottomColor}</span>
        <span className="timer-value">{formatTime(bottomTime, isTerrain && bottomActive)}</span>
      </div>
    </>
  );
}
