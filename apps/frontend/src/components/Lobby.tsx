'use client';

import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import VariantsViewer from './VariantsViewer';

export default function Lobby() {
  const [joinCode, setJoinCode] = useState('');
  const [selectedMenu, setSelectedMenu] = useState('');
  const { createRoom, joinRoom } = useGameStore();

  const handleJoin = () => {
    const code = joinCode.trim().toUpperCase();
    if (code.length === 6) {
      joinRoom(code);
    }
  };

  const menuItems = ['Rank', 'Create Room', 'Join Room', 'Variants'];

  const handleMenuClick = (item: string) => {
    setSelectedMenu(item);
  };

  return (
    <div
      className="fixed inset-0 w-full h-full bg-[#1a0f14] text-[#fcf5e5] overflow-hidden"
      style={{
        // Bỏ ảnh nền vào thư mục: public/assets/images/logo-bg.png
        backgroundImage: "url('/assets/images/logo-bg.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Dark overlay to make text readable in case background is too bright */}
      <div className="absolute inset-0 bg-black/40 z-0"></div>

      <div className="relative z-10 flex flex-col h-full p-8 md:p-16">

        {/* Title/Logo */}
        {selectedMenu !== 'Variants' && (
          <div className="mb-12 mt-4 max-w-sm md:max-w-md">
            <img
              src="/assets/images/logo.png"
              alt="Game Logo"
              className="w-full h-auto object-contain select-none"
              style={{ imageRendering: 'pixelated' }}
            />
          </div>
        )}

        {/* Menu Items */}
        {selectedMenu !== 'Variants' && (
          <div className="flex flex-col gap-6 text-xl md:text-2xl w-full max-w-md mt-4">
            {!selectedMenu ? (
              // Main Menu
              menuItems.map((item) => (
                <button
                  key={item}
                  onClick={() => setSelectedMenu(item)}
                  className="relative flex items-center text-left transition-all duration-200 px-6 py-3 rounded-none text-[#d4cbb8] hover:text-white border-[3px] border-transparent hover:border-[#d8c39e]/50 hover:bg-white/5 cursor-pointer"
                  style={{ textShadow: '2px 2px 0 #000' }}
                >
                  {item}
                </button>
              ))
            ) : (
              // Sub Menus
              <div className="flex flex-col items-start gap-6 animate-in fade-in slide-in-from-left-4 duration-300">
                <h2 className="text-3xl text-[#fcf5e5] mb-4" style={{ textShadow: '2px 2px 0 #000' }}>
                  {selectedMenu}
                </h2>

                {selectedMenu === 'Join Room' && (
                  <div className="flex flex-col gap-4 w-full">
                    <input
                      type="text"
                      className="bg-black/60 border-2 border-[#d8c39e] text-[#fcf5e5] px-4 py-3 w-full outline-none uppercase text-lg shadow-[inset_0_0_10px_rgba(0,0,0,0.8)]"
                      placeholder="ENTER ROOM CODE"
                      maxLength={6}
                      value={joinCode}
                      onChange={e => setJoinCode(e.target.value.toUpperCase())}
                      onKeyDown={e => e.key === 'Enter' && handleJoin()}
                    />
                    <button
                      className="w-full bg-[#d8c39e] hover:bg-[#bda57b] text-black px-4 py-3 border-2 border-[#d8c39e] text-lg transition-colors disabled:opacity-50 disabled:bg-gray-600 disabled:text-gray-300 disabled:border-gray-600 cursor-pointer"
                      onClick={handleJoin}
                      disabled={joinCode.trim().length !== 6}
                    >
                      JOIN MATCH
                    </button>
                  </div>
                )}

                {selectedMenu === 'Create Room' && (
                  <div className="flex flex-col gap-4 w-full">
                    <p className="text-[#d4cbb8] text-sm leading-relaxed mb-2" style={{ textShadow: '1px 1px 0 #000' }}>
                      Host a new match and share the code with a friend.
                    </p>
                    <button
                      className="w-full bg-[#d8c39e] hover:bg-[#bda57b] text-black px-4 py-3 border-2 border-[#d8c39e] text-lg transition-colors cursor-pointer"
                      onClick={() => createRoom()}
                    >
                      START HOSTING
                    </button>
                  </div>
                )}

                {/* Back Button */}
                <button
                  onClick={() => setSelectedMenu('')}
                  className="mt-4 flex items-center gap-2 text-[#94a3b8] hover:text-white transition-colors text-sm cursor-pointer"
                >
                  <span className="text-lg">{'<'}</span> BACK TO LOBBY
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {selectedMenu === 'Variants' && (
        <VariantsViewer onClose={() => setSelectedMenu('')} />
      )}
    </div>
  );
}
