// ============================================================
// Main Page Component
// ============================================================

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useGameStore } from '../store/gameStore';
import Lobby from '../components/Lobby';
import Board from '../components/Board';
import GameTimer from '../components/GameTimer';
import GameRightPanel from '../components/GameRightPanel';
import DraftScreen from '../components/DraftScreen';
import RevealScreen from '../components/RevealScreen';
import LoadingScreen from '../components/LoadingScreen';
import ActionBar from '../components/ActionBar';
import { VARIANTS_LIST } from '../lib/variantsData';

export default function Home() {
  const {
    phase,
    winner,
    playerColor,
    roomCode,
    initSocketListeners,
    surrender,
    resetGame,
    togglePlayerColor,
    keybindings,
    setKeybinding,
    activeSkillDetail,
    setSkillDetail,
  } = useGameStore();

  const [showOptions, setShowOptions] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showKeybindingsModal, setShowKeybindingsModal] = useState(false);
  const [bindingKeyType, setBindingKeyType] = useState<'skill1' | 'skill2' | 'ultimate' | null>(null);

  useEffect(() => {
    initSocketListeners();
  }, [initSocketListeners]);

  useEffect(() => {
    if (!activeSkillDetail) return;
    const handleClose = () => setSkillDetail(null);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSkillDetail(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('click', handleClose);
    window.addEventListener('contextmenu', handleClose);
    window.addEventListener('scroll', handleClose, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('click', handleClose);
      window.removeEventListener('contextmenu', handleClose);
      window.removeEventListener('scroll', handleClose, true);
    };
  }, [activeSkillDetail, setSkillDetail]);

  useEffect(() => {
    if (!bindingKeyType) return;

    const handleKeyCapture = (e: KeyboardEvent) => {
      e.preventDefault();
      // Ignore modifier keys
      if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) {
        return;
      }
      
      let keyToSet = e.key;
      if (e.key === ' ') {
        keyToSet = 'space';
      }

      setKeybinding(bindingKeyType, keyToSet);
      setBindingKeyType(null);
    };

    window.addEventListener('keydown', handleKeyCapture, true);
    return () => {
      window.removeEventListener('keydown', handleKeyCapture, true);
    };
  }, [bindingKeyType, setKeybinding]);

  return (
    <main
      className="main-layout relative w-full min-h-screen text-[#fcf5e5] overflow-hidden"
      style={
        phase === 'waiting'
          ? {
              backgroundImage: 'url(/assets/images/host-bg.png)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
            }
          : { backgroundColor: '#0f172a' }
      }
    >
      {/* Options Dropdown */}
      {phase === 'playing' && (
        <div className="absolute top-4 left-4 z-50">
          <div className="relative">
            <button 
              onClick={() => setShowOptions(!showOptions)}
              className="px-4 py-2 bg-slate-800 text-white rounded border border-slate-600 hover:bg-slate-700 transition-colors shadow-md font-bold"
            >
              Options
            </button>
            {showOptions && (
              <div className="absolute top-full left-0 mt-2 bg-slate-800 border border-slate-600 rounded shadow-lg p-2 flex flex-col gap-2 min-w-[150px]">
                <button 
                  onClick={() => {
                    setShowKeybindingsModal(true);
                    setShowOptions(false);
                  }}
                  className="px-3 py-2 text-blue-300 hover:bg-slate-700 rounded text-left w-full transition-colors font-bold"
                >
                  Keybindings
                </button>
                <button 
                  onClick={() => {
                    if (window.confirm("Are you sure you want to surrender?")) {
                      surrender();
                    }
                    setShowOptions(false);
                  }}
                  className="px-3 py-2 text-red-400 hover:bg-slate-700 rounded text-left w-full transition-colors font-bold border-t border-slate-750"
                >
                  Surrender
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Keybindings Modal */}
      {showKeybindingsModal && (
        <div className="fixed inset-0 bg-black/85 z-55 flex items-center justify-center backdrop-blur-md">
          <div className="bg-[#0b0d19] border-2 border-slate-800 rounded-xl p-6 w-[360px] shadow-2xl flex flex-col gap-5 relative">
            <button 
              onClick={() => {
                setShowKeybindingsModal(false);
                setBindingKeyType(null);
              }}
              className="absolute top-3 right-3 text-slate-500 hover:text-white transition-colors text-lg"
            >
              ✕
            </button>
            <h3 className="text-xl font-bold text-[#d8c39e] border-b border-slate-800 pb-2 flex items-center gap-2">
              ⚙️ Keybindings
            </h3>
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-300">Skill 1</span>
                <button
                  onClick={() => setBindingKeyType('skill1')}
                  className={`px-4 py-2 rounded font-bold font-mono min-w-[120px] transition-all border ${
                    bindingKeyType === 'skill1' 
                      ? 'bg-blue-600 border-blue-400 text-white animate-pulse' 
                      : 'bg-slate-900 border-slate-700 text-blue-400 hover:bg-slate-850 hover:border-slate-650'
                  }`}
                >
                  {bindingKeyType === 'skill1' ? 'Press Key...' : keybindings.skill1.toUpperCase()}
                </button>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-300">Skill 2</span>
                <button
                  onClick={() => setBindingKeyType('skill2')}
                  className={`px-4 py-2 rounded font-bold font-mono min-w-[120px] transition-all border ${
                    bindingKeyType === 'skill2' 
                      ? 'bg-blue-600 border-blue-400 text-white animate-pulse' 
                      : 'bg-slate-900 border-slate-700 text-blue-400 hover:bg-slate-850 hover:border-slate-650'
                  }`}
                >
                  {bindingKeyType === 'skill2' ? 'Press Key...' : keybindings.skill2.toUpperCase()}
                </button>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-300">Ultimate</span>
                <button
                  onClick={() => setBindingKeyType('ultimate')}
                  className={`px-4 py-2 rounded font-bold font-mono min-w-[120px] transition-all border ${
                    bindingKeyType === 'ultimate' 
                      ? 'bg-purple-600 border-purple-400 text-white animate-pulse' 
                      : 'bg-slate-900 border-slate-700 text-purple-400 hover:bg-slate-850 hover:border-slate-650'
                  }`}
                >
                  {bindingKeyType === 'ultimate' ? 'Press Key...' : keybindings.ultimate.toUpperCase()}
                </button>
              </div>
            </div>

            <div className="text-[10px] text-slate-500 italic text-center mt-2 border-t border-slate-900 pt-3">
              Click on a button then press any key to remap.
            </div>

            <button
              onClick={() => {
                setShowKeybindingsModal(false);
                setBindingKeyType(null);
              }}
              className="w-full mt-2 py-2.5 bg-slate-800 text-white font-bold rounded border border-slate-700 hover:bg-slate-750 transition-all active:scale-95"
            >
              Close
            </button>
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

      <div className={`relative z-10 w-full flex flex-col h-full ${phase === 'lobby' || phase === 'waiting' ? 'items-center justify-center' : ''}`}>
        {phase === 'lobby' ? (
          <Lobby />
        ) : phase === 'draft' ? (
          <DraftScreen />
        ) : phase === 'reveal' ? (
          <RevealScreen />
        ) : phase === 'loading' ? (
          <LoadingScreen />
        ) : phase === 'waiting' ? (
          <div className="relative w-full h-screen flex items-center justify-center">
            {/* Dark overlay for readability */}
            <div className="absolute inset-0 z-0 bg-black/35" />

            {/* Waiting Box */}
            <div className="relative z-10 flex flex-col items-center justify-center p-8 bg-[#1a0a0a]/85 border border-[#8b2020]/60 rounded-lg shadow-[0_0_40px_rgba(139,32,32,0.3)] max-w-md w-full gap-6 backdrop-blur-md">
              <h2 className="text-2xl font-bold tracking-wider text-[#e8c4a0]">WAITING FOR OPPONENT</h2>
              
              {roomCode && (
                <div className="relative w-full bg-[#0d0505]/80 p-4 rounded border border-[#6b1a1a]/50 flex flex-col items-center gap-2">
                  <span className="text-xs text-[#a05c3c] font-semibold uppercase tracking-wider">Room Code</span>
                  <span className="text-3xl font-mono font-bold tracking-widest text-[#ff6b4a] select-all">{roomCode}</span>
                  {/* Copy icon pinned to top-right corner of the container */}
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(roomCode);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center bg-[#3a1515] hover:bg-[#4a1f1f] text-[#e8c4a0] rounded border border-[#6b1a1a] transition-all active:scale-95"
                    title="Copy room code"
                  >
                    {copied ? '✓' : '⧉'}
                  </button>
                </div>
              )}

              {playerColor && (
                <div className="flex justify-between items-center w-full px-2">
                  <span className="text-[#c4967a] font-semibold">You play:</span>
                  <button
                    onClick={togglePlayerColor}
                    className={`px-4 py-2 font-mono font-bold border rounded transition-all active:scale-95 ${
                      playerColor === 'White' 
                        ? 'bg-[#e8dcc8] text-[#1a0a0a] border-[#c4967a] hover:bg-[#f0e4d0]' 
                        : 'bg-[#1a0a0a] text-[#e8c4a0] border-[#6b1a1a] hover:bg-[#2a1010]'
                    }`}
                  >
                    {playerColor} ⇄
                  </button>
                </div>
              )}

              <button
                onClick={resetGame}
                className="mt-4 px-6 py-2.5 bg-[#3a1515] hover:bg-[#4a1f1f] text-[#e8c4a0] font-bold rounded border border-[#6b1a1a] w-full transition-colors"
              >
                Back to Lobby
              </button>
            </div>
          </div>
        ) : (
          /* ─── Row Layout with Bottom Skill Bar ─────────────────────────────── */
          <>
            <div className="game-container">
              {/* Left: Timer panel */}
              <div className="timer-panel">
                <GameTimer />
              </div>

              {/* Center: Board & Skill Bar */}
              <div className="board-section">
                <Board />
                
                {/* Bottom: Skill bar & cockpit */}
                <ActionBar />
              </div>

              {/* Right: Info panel */}
              <div className="info-section">
                <GameRightPanel />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Skill Detail Popup */}
      {activeSkillDetail && (() => {
        const { skill, variantId, x, y } = activeSkillDetail;
        const variant = VARIANTS_LIST.find((v) => v.id === variantId);
        const skillImg = variant ? (
          variant.passive.id === skill.id ? `/assets/skills/${variantId}_passive.png` :
          variant.skill1.id === skill.id ? `/assets/skills/${variantId}_skill1.png` :
          variant.skill2.id === skill.id ? `/assets/skills/${variantId}_skill2.png` :
          variant.ultimate.id === skill.id ? `/assets/skills/${variantId}_ultimate.png` : null
        ) : null;
        const skillType = variant ? (
          variant.passive.id === skill.id ? 'PASSIVE' :
          variant.skill1.id === skill.id ? 'SKILL 1' :
          variant.skill2.id === skill.id ? 'SKILL 2' :
          variant.ultimate.id === skill.id ? 'ULTIMATE' : ''
        ) : '';
        const isPassive = skill.cost === 'None' || skill.cost === 0;

        const popupWidth = 280;
        const popupHeight = 220; // safe estimation
        let left = x + 10;
        let top = y - 10;
        if (typeof window !== 'undefined') {
          if (left + popupWidth > window.innerWidth) {
            left = x - popupWidth - 10;
          }
          if (top + popupHeight > window.innerHeight) {
            top = window.innerHeight - popupHeight - 10;
          }
          if (top < 10) {
            top = 10;
          }
        }

        return (
          <div 
            className="fixed z-[300] w-[280px] rounded-lg border border-[#d8c39e]/60 bg-[#0b0d19]/98 backdrop-blur-md p-3 shadow-[0_10px_30px_rgba(0,0,0,0.8)] text-[#fcf5e5] font-mono cursor-default animate-fade-in text-left"
            style={{
              left: `${left}px`,
              top: `${top}px`,
            }}
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.stopPropagation()}
          >
            {/* Header: Skill Name + Cost */}
            <div className="flex items-center justify-between border-b border-slate-750 pb-1.5 mb-1.5">
              <span className="text-xs font-bold text-[#d8c39e] uppercase tracking-wider truncate max-w-[170px]">{skill.name}</span>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase border ${isPassive ? 'bg-yellow-950/80 text-yellow-400 border-yellow-800/40' : 'bg-blue-955 text-blue-400 border-blue-800/40'}`}>
                {isPassive ? 'Passive' : `${skill.cost} AP`}
              </span>
            </div>

            {/* Icon & Details */}
            <div className="flex gap-2.5 items-center bg-[#111326]/40 border border-slate-850 p-2 rounded mb-1.5 text-[9px] text-slate-400">
              <div className="w-10 h-10 rounded border border-slate-700 bg-slate-900 flex items-center justify-center overflow-hidden shrink-0 relative">
                {skillImg ? (
                  <img 
                    src={skillImg} 
                    alt={skill.name} 
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                      const parent = (e.target as HTMLElement).parentElement;
                      if (parent) {
                        const fallbackSpan = document.createElement('span');
                        fallbackSpan.className = 'text-[9px] font-bold text-slate-500';
                        fallbackSpan.textContent = skillType.slice(0, 3);
                        parent.appendChild(fallbackSpan);
                      }
                    }}
                  />
                ) : (
                  <span className="text-[9px] font-bold text-slate-500">{skillType.slice(0, 3)}</span>
                )}
              </div>

              <div className="flex-grow flex flex-col gap-1 text-[9px]">
                {variant && (
                  <div className="flex justify-between leading-none">
                    <span>Variant:</span>
                    <span className="text-slate-300 font-bold">{variant.name}</span>
                  </div>
                )}
                {skill.targetType !== 'Passive' && (
                  <>
                    <div className="flex justify-between leading-none">
                      <span>Target:</span>
                      <span className="text-slate-300 font-bold">{skill.targetType}</span>
                    </div>
                    <div className="flex justify-between leading-none">
                      <span>Duration:</span>
                      <span className="text-slate-300 font-bold">{skill.duration}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Description Box */}
            <div className="text-[10px] leading-relaxed text-slate-300 font-sans bg-[#07080f]/50 border border-slate-850 p-2 rounded max-h-[100px] overflow-y-auto">
              {skill.description}
            </div>
          </div>
        );
      })()}
    </main>
  );
}
