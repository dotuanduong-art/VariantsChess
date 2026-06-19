'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

const GAME_TIPS = [
  'Mẹo: Mỗi khi phong cấp Tốt lên Hậu, bạn sẽ nhận được ngay +3 AP thưởng.',
  'Mẹo: Bàn cờ rộng 15x15 và không có chiếu hết. Trận đấu chỉ thắng khi Vua đối thủ bị tiêu diệt trực tiếp!',
  'Mẹo: Quy luật tích lũy AP kép hoạt động đồng thời: cả người ăn cờ lẫn người bị ăn cờ đều nhận được AP tương ứng.',
  'Mẹo: Nước đi quân cờ là bắt buộc trong mỗi lượt đấu. Việc sử dụng Kỹ năng là tự chọn.',
  'Mẹo: Hãy chú ý tài nguyên đặc biệt của Variant đối thủ hiển thị công khai ở thanh bên phải.',
  'Mẹo: Electric Terrain của Lightning giới hạn thời gian đi xuống còn 3 giây. Trễ giờ sẽ bị choáng cờ!',
];

export default function LoadingScreen() {
  const [tipIndex, setTipIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  // Rotate tips
  useEffect(() => {
    const tipInterval = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % GAME_TIPS.length);
    }, 2500);

    // Simulated progress bar
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + 2;
      });
    }, 90);

    return () => {
      clearInterval(tipInterval);
      clearInterval(progressInterval);
    };
  }, []);

  return (
    <div className="fixed inset-0 w-full h-full bg-[#05060b] text-[#cbd5e1] flex flex-col items-center justify-center font-mono overflow-hidden select-none">
      {/* Background glowing gradients */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60vw] h-[60vw] rounded-full bg-[#1e223b]/10 blur-[150px] pointer-events-none" />

      <div className="flex flex-col items-center justify-center max-w-lg w-full px-6 gap-8 z-10">
        
        {/* Loading Spinner */}
        <div className="relative w-20 h-20 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-4 border-slate-800" />
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}
            className="absolute inset-0 rounded-full border-4 border-t-[#d8c39e] border-r-transparent border-b-transparent border-l-transparent"
          />
          <span className="text-xl font-bold text-[#d8c39e]">♞</span>
        </div>

        {/* Loading details */}
        <div className="w-full text-center flex flex-col gap-2">
          <h2 className="text-sm font-bold text-white uppercase tracking-widest">
            Preloading Game Assets...
          </h2>
          <span className="text-xs text-slate-500 font-mono">{progress}%</span>
          
          {/* Progress bar track */}
          <div className="w-full h-1 bg-slate-900 rounded-full overflow-hidden border border-slate-800/50 mt-2">
            <motion.div
              style={{ width: `${progress}%` }}
              className="h-full bg-gradient-to-r from-[#bda57b] to-[#d8c39e] rounded-full"
            />
          </div>
        </div>

        {/* Tips section */}
        <div className="w-full min-h-[60px] text-center border-t border-slate-800/80 pt-6 px-4">
          <motion.p
            key={tipIndex}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.3 }}
            className="text-[11px] text-[#cbd5e1] leading-relaxed italic"
          >
            {GAME_TIPS[tipIndex]}
          </motion.p>
        </div>

      </div>
    </div>
  );
}
