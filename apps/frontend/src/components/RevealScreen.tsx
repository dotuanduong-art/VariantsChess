'use client';

import { useEffect, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { VARIANTS_LIST, VariantData, getVariantImageSrc } from '../lib/variantsData';
import { motion } from 'framer-motion';

export default function RevealScreen() {
  const { whiteVariantId, blackVariantId, playerColor } = useGameStore();
  const [countdown, setCountdown] = useState(3);
  const [imgError, setImgError] = useState<Record<string, boolean>>({});

  const handleImgError = (key: string) => {
    setImgError((prev) => ({ ...prev, [key]: true }));
  };

  // Simple local visual countdown purely for feedback (actual duration driven by server phase timeout)
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => Math.max(1, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Match the variants data
  const whiteVariant = VARIANTS_LIST.find((v) => v.id === whiteVariantId) || VARIANTS_LIST[0];
  const blackVariant = VARIANTS_LIST.find((v) => v.id === blackVariantId) || VARIANTS_LIST[0];

  // Map to left and right side (Left = Self, Right = Opponent)
  const isPlayerWhite = playerColor === 'White';
  const leftVariant = isPlayerWhite ? whiteVariant : blackVariant;
  const rightVariant = isPlayerWhite ? blackVariant : whiteVariant;

  const leftLabel = 'YOUR SELECTION';
  const rightLabel = "OPPONENT'S SELECTION";

  return (
    <div className="fixed inset-0 w-full h-full bg-[#05060b] text-[#cbd5e1] flex flex-col items-center justify-center font-mono overflow-hidden select-none">
      {/* Background radial overlays */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(216,195,158,0.03),transparent_70%)] pointer-events-none" />
      
      {/* Animated glow backdrops */}
      <div className="absolute top-1/2 left-[20%] -translate-y-1/2 w-[30vw] h-[30vw] rounded-full bg-blue-900/10 blur-[100px] pointer-events-none" />
      <div className="absolute top-1/2 right-[20%] -translate-y-1/2 w-[30vw] h-[30vw] rounded-full bg-red-900/10 blur-[100px] pointer-events-none" />

      {/* Countdown overlay */}
      <div className="absolute top-8 text-center">
        <span className="text-[10px] text-slate-500 uppercase tracking-widest block mb-1">Match starts in</span>
        <span className="text-xl font-bold text-yellow-500/80">{countdown}s</span>
      </div>

      <div className="w-full max-w-6xl flex items-center justify-between px-8 z-10">
        
        {/* Left Side: Player Variant */}
        <motion.div
          initial={{ opacity: 0, x: -60 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="w-[40%] flex flex-col items-center gap-6 text-center"
        >
          <span className="text-[10px] bg-blue-950 text-blue-400 border border-blue-900/50 px-3 py-1 rounded-full uppercase tracking-widest font-bold">
            {leftLabel}
          </span>
          <div className="w-[260px] h-[340px] rounded-2xl bg-gradient-to-b from-[#1b203d] to-[#0d0f1a] border-2 border-blue-900/40 flex flex-col items-center justify-center relative shadow-[0_0_50px_rgba(27,32,61,0.3)] group overflow-hidden">
            <div className="w-full h-full flex items-center justify-center overflow-hidden shrink-0 relative z-10">
              {!imgError[`reveal_left_${leftVariant.id}`] ? (
                <img
                  src={getVariantImageSrc(leftVariant.id)}
                  alt={leftVariant.name}
                  className="w-full h-full object-cover"
                  onError={() => handleImgError(`reveal_left_${leftVariant.id}`)}
                />
              ) : (
                <span className="text-8xl select-none drop-shadow-[0_0_35px_rgba(59,130,246,0.4)]">{leftVariant.artwork}</span>
              )}
            </div>
          </div>
          <div>
            <h2 className="text-3xl font-extrabold text-white tracking-widest uppercase mb-1">
              {leftVariant.name}
            </h2>
            <p className="text-xs text-slate-400 uppercase tracking-widest">{leftVariant.role}</p>
          </div>
        </motion.div>

        {/* Center: VS logo */}
        <motion.div
          initial={{ scale: 0.3, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.4, type: 'spring' }}
          className="flex flex-col items-center justify-center"
        >
          <div className="w-20 h-20 rounded-full bg-[#16182c] border-2 border-[#d8c39e] flex items-center justify-center shadow-[0_0_30px_rgba(216,195,158,0.2)]">
            <span className="text-2xl font-black text-[#d8c39e] tracking-tighter drop-shadow-md">VS</span>
          </div>
          <div className="w-px h-28 bg-gradient-to-b from-transparent via-[#d8c39e]/40 to-transparent mt-4"></div>
        </motion.div>

        {/* Right Side: Opponent Variant */}
        <motion.div
          initial={{ opacity: 0, x: 60 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="w-[40%] flex flex-col items-center gap-6 text-center"
        >
          <span className="text-[10px] bg-red-955 text-red-400 border border-red-900/50 px-3 py-1 rounded-full uppercase tracking-widest font-bold">
            {rightLabel}
          </span>
          <div className="w-[260px] h-[340px] rounded-2xl bg-gradient-to-b from-[#3d1b1b] to-[#1a0d0d] border-2 border-red-900/40 flex flex-col items-center justify-center relative shadow-[0_0_50px_rgba(61,27,27,0.3)] group overflow-hidden">
            <div className="w-full h-full flex items-center justify-center overflow-hidden shrink-0 relative z-10">
              {!imgError[`reveal_right_${rightVariant.id}`] ? (
                <img
                  src={getVariantImageSrc(rightVariant.id)}
                  alt={rightVariant.name}
                  className="w-full h-full object-cover"
                  onError={() => handleImgError(`reveal_right_${rightVariant.id}`)}
                />
              ) : (
                <span className="text-8xl select-none drop-shadow-[0_0_35px_rgba(239,68,68,0.4)]">{rightVariant.artwork}</span>
              )}
            </div>
          </div>
          <div>
            <h2 className="text-3xl font-extrabold text-white tracking-widest uppercase mb-1">
              {rightVariant.name}
            </h2>
            <p className="text-xs text-slate-400 uppercase tracking-widest">{rightVariant.role}</p>
          </div>
        </motion.div>

      </div>
    </div>
  );
}
