// ============================================================
// Piece Component - Image-based chess piece rendering
// ============================================================

import { PieceType, Color } from 'game-core';
import type { Piece as PieceData } from 'game-core';
import { useState } from 'react';
import { motion } from 'framer-motion';

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

  return (
    <motion.div 
      layoutId={piece.id}
      transition={{
        type: 'spring',
        stiffness: 170,
        damping: 20
      }}
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
