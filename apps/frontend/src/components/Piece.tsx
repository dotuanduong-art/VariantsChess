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
  | 'walker'
  | 'berserk'
  | 'blessing'
  | 'flame'
  | 'silence'
  | 'ghost'
  | 'bind'
  | 'judgment_mark'
  | 'fate'
  | 'position_swap'
  | 'moveset_swap'
  | 'fool'
  | 'enemy_position_swap'
  | 'puppet_control'
  | 'puppet_no_capture'
  | 'ascend';

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
  walker: {
    filter: 'drop-shadow(0px 0px 8px rgba(20, 184, 166, 0.85)) saturate(1.4) hue-rotate(60deg) brightness(0.95)',
    opacity: 0.6,
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
  position_swap: {
    filter: 'drop-shadow(0px 0px 8px rgba(34, 211, 238, 0.8))',
    animation: 'effect-position-swap-glow 1.5s infinite alternate ease-in-out',
  },
  moveset_swap: {
    filter: 'drop-shadow(0px 0px 8px rgba(236, 72, 153, 0.8))',
    animation: 'effect-moveset-swap-glow 1.5s infinite alternate ease-in-out',
  },
  fool: {
    filter: 'drop-shadow(0px 0px 10px rgba(168, 85, 247, 0.9)) saturate(1.7) contrast(1.1)',
    animation: 'effect-fool-glow 1.5s infinite alternate ease-in-out',
  },
  enemy_position_swap: {
    filter: 'drop-shadow(0px 0px 8px rgba(168, 85, 247, 0.8))',
    animation: 'effect-enemy-position-swap-glow 1.5s infinite alternate ease-in-out',
  },
  ascend: {
    filter: 'drop-shadow(0px 0px 8px rgba(234, 179, 8, 0.9)) saturate(1.4) brightness(1.15)',
    animation: 'effect-ascend-pulse 1.8s infinite alternate ease-in-out',
  },
  puppet_control: {
    filter: 'drop-shadow(0px 0px 10px rgba(168, 85, 247, 0.95)) saturate(1.4) brightness(1.15)',
  },
  puppet_no_capture: {
    filter: 'grayscale(40%) drop-shadow(0px 0px 6px rgba(220, 38, 38, 0.6))',
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
  
  let imageSrc = `/pieces/${variant}/${colorStr}_${pieceTypeStr}.png`;
  if (pieceTypeStr === 'totem') {
    imageSrc = `/assets/pieces/cherubim/${colorStr}_totem.png`;
  } else if (pieceTypeStr === 'mountain') {
    imageSrc = `/assets/pieces/earth/${colorStr}_mountain.png`;
  }

  // Fallback text if image is missing (first letter of piece type)
  const fallbackText = piece.type.charAt(0).toUpperCase();
 
  const activeEffects = (piece.effects || [])
    .map(e => e.type as EffectKey)
    .filter(type => type in EFFECTS);

  const combinedStyle = getCombinedEffectStyle(activeEffects);

  const ghostEffect = piece.effects?.find(e => e.type === 'ghost');
  const isStealthed = ghostEffect?.metadata?.stealth === true;
  if (isStealthed) {
    combinedStyle.opacity = 0.35;
    combinedStyle.filter = (combinedStyle.filter || '') + ' saturate(0.5) contrast(0.8) drop-shadow(0px 0px 12px rgba(168, 85, 247, 0.6))';
  }
 
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

