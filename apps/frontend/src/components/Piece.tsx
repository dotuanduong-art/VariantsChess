// ============================================================
// Piece Component - Image-based chess piece rendering
// ============================================================

import { PieceType, Color } from 'game-core';
import type { Piece as PieceData } from 'game-core';
import { useState } from 'react';
import { motion } from 'framer-motion';

export type EffectKey =
  | 'stun'
  | 'shield'
  | 'bomb'
  | 'zombie'
  | 'berserk'
  | 'blessing'
  | 'flame'
  | 'silence'
  | 'ghost'
  | 'bind'
  | 'judgment_mark'
  | 'fate';

interface EffectConfig {
  filter: string;
  animation?: string;
  opacity?: number;
}

const EFFECTS: Record<EffectKey, EffectConfig> = {
  stun: {
    filter: 'grayscale(90%) brightness(0.75) sepia(20%) drop-shadow(0px 0px 4px rgba(239, 68, 68, 0.4))',
    opacity: 0.8,
  },
  shield: {
    filter: 'drop-shadow(0px 0px 8px rgba(56, 189, 248, 0.95))',
  },
  bomb: {
    filter: 'drop-shadow(0px 0px 6px rgba(239, 68, 68, 0.85)) saturate(1.6)',
    animation: 'effect-bomb-pulse-filter 0.8s infinite alternate ease-in-out, effect-bomb-pulse-transform 0.8s infinite alternate ease-in-out',
  },
  zombie: {
    filter: 'grayscale(20%) hue-rotate(80deg) saturate(1.3) brightness(0.9)',
  },
  berserk: {
    filter: 'drop-shadow(0px 0px 10px rgba(220, 38, 38, 0.95)) saturate(2) contrast(1.15)',
    animation: 'effect-berserk-shake 0.15s infinite alternate ease-in-out',
  },
  blessing: {
    filter: 'drop-shadow(0px 0px 10px rgba(250, 204, 21, 0.9)) brightness(1.15)',
  },
  flame: {
    filter: 'drop-shadow(0px 0px 8px rgba(249, 115, 22, 0.9)) saturate(1.7)',
    animation: 'effect-flame-pulse-filter 0.6s infinite alternate ease-in-out',
  },
  silence: {
    filter: 'grayscale(60%) brightness(0.85) drop-shadow(0px 0px 5px rgba(168, 85, 247, 0.7))',
  },
  ghost: {
    filter: 'drop-shadow(0px 0px 8px rgba(147, 197, 253, 0.8)) brightness(1.25)',
    opacity: 0.55,
  },
  bind: {
    filter: 'grayscale(30%) sepia(40%) contrast(1.1) drop-shadow(0px 0px 4px rgba(120, 113, 108, 0.9))',
  },
  judgment_mark: {
    filter: 'drop-shadow(0px 0px 8px rgba(253, 224, 71, 0.95)) brightness(1.2) sepia(10%) saturate(1.4)',
  },
  fate: {
    filter: 'drop-shadow(0px 0px 8px rgba(168, 85, 247, 0.95)) saturate(1.5)',
  },
};

export function getCombinedEffectStyle(effects: EffectKey[]): React.CSSProperties {
  const filters: string[] = [];
  const animations: string[] = [];
  let minOpacity = 1;
  let hasOpacity = false;
  let hasAnim = false;

  effects.forEach(type => {
    const config = EFFECTS[type];
    if (config) {
      if (config.filter) {
        filters.push(config.filter);
      }
      if (config.animation) {
        animations.push(config.animation);
        hasAnim = true;
      }
      if (config.opacity !== undefined) {
        minOpacity = Math.min(minOpacity, config.opacity);
        hasOpacity = true;
      }
    }
  });

  const style: React.CSSProperties = {};

  if (filters.length > 0) {
    style.filter = filters.join(' ');
  }
  if (animations.length > 0) {
    style.animation = animations.join(', ');
  }
  if (hasOpacity) {
    style.opacity = minOpacity;
  }
  if (hasAnim) {
    style.willChange = 'filter, transform';
  }

  return style;
}

interface PieceProps {
  piece: PieceData;
  variant?: string;
}

export default function Piece({ piece, variant = 'classic' }: PieceProps) {
  const [imageError, setImageError] = useState(false);

  const pieceTypeStr = piece.type.toLowerCase();
  const colorStr = piece.color.toLowerCase();
  const imageSrc = `/pieces/${variant}/${colorStr}_${pieceTypeStr}.png`;

  // Fallback text if image is missing (first letter of piece type)
  const fallbackText = piece.type.charAt(0).toUpperCase();
 
  const activeEffects = (piece.effects || [])
    .map(e => e.type as EffectKey)
    .filter(type => type in EFFECTS);

  const combinedStyle = getCombinedEffectStyle(activeEffects);
 
  return (
    <motion.div 
      layoutId={piece.id}
      transition={{
        type: 'spring',
        stiffness: 170,
        damping: 20
      }}
      style={combinedStyle}
      className="w-full h-full flex items-center justify-center pointer-events-none select-none z-10"
    >
      {!imageError ? (
        <img
          src={imageSrc}
          alt={`${piece.color} ${piece.type}`}
          className="w-[85%] h-[85%] object-contain drop-shadow-md"
          onError={() => setImageError(true)}
        />
      ) : (
        <span
          className={`text-2xl font-bold ${
            piece.color === Color.White ? 'text-gray-100 drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]' : 'text-gray-900 drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)]'
          }`}
        >
          {fallbackText}
        </span>
      )}
    </motion.div>
  );
}

