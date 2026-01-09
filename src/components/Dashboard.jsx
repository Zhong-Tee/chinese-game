import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function Dashboard({ setPage, user }) {
  const [username, setUsername] = useState('');

  useEffect(() => {
    const fetchUsername = async () => {
      if (!user?.id) return;

      try {
        // ดึงข้อมูล username จากตาราง profiles
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('username, display_name, email')
          .eq('user_id', user.id)
          .single();

        if (!error && profile) {
          // ลำดับความสำคัญ: username > display_name (ถ้าไม่ใช่ email) > username จาก email
          let displayName = profile.username;
          
          if (!displayName || displayName.trim() === '') {
            if (profile.display_name && !profile.display_name.includes('@')) {
              displayName = profile.display_name;
            } else {
              displayName = profile.email ? profile.email.split('@')[0] : null;
            }
          }
          
          if (!displayName || displayName.trim() === '') {
            displayName = profile.email || 'User';
          }
          
          setUsername(displayName);
        } else {
          // ถ้าไม่มีข้อมูลใน profiles ให้ใช้ username จาก email
          const fallbackName = user.email ? user.email.split('@')[0] : user.user_metadata?.username || 'User';
          setUsername(fallbackName);
        }
      } catch (error) {
        console.error('Error fetching username:', error);
        // Fallback: ใช้ username จาก email
        const fallbackName = user?.email ? user.email.split('@')[0] : 'User';
        setUsername(fallbackName);
      }
    };

    fetchUsername();
  }, [user]);

  // ไม่ต้องมี {page === 'dashboard' && ...} เพราะเราเช็คเงื่อนไขนี้จากไฟล์ App.jsx แล้ว
  return (
    <div className="space-y-4">
      {/* แสดง username ที่ด้านบน */}
      <div className="bg-gradient-to-r from-orange-100 to-orange-200 rounded-2xl p-4 border-2 border-orange-300 shadow-sm">
        <div className="text-center">
          <div className="text-sm font-black text-slate-600 uppercase mb-1">ยินดีต้อนรับ</div>
          <div className="text-2xl font-black text-orange-600 uppercase">{username || 'User'}</div>
        </div>
      </div>

      <div 
        className="grid grid-cols-2 gap-4 pt-2 pb-10 select-none"
        style={{ userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none' }}
      >
      <button onClick={() => setPage('fc-chars')} className="h-36 bg-orange-500 text-white rounded-[2rem] shadow-xl font-black flex flex-col items-center justify-center gap-1 italic tracking-tighter uppercase text-sm transform active:scale-95 transition-all">
        <span className="text-3xl">🎴</span> Flashcards
      </button>
      <button onClick={() => setPage('minigames')} className="h-36 bg-emerald-500 text-white rounded-[2rem] shadow-xl font-black flex flex-col items-center justify-center gap-1 italic tracking-tighter uppercase text-sm transform active:scale-95 transition-all">
        <span className="text-3xl">🎮</span> Mini Games
      </button>
      <button onClick={() => setPage('comics')} className="h-36 bg-pink-500 text-white rounded-[2rem] shadow-xl font-black flex flex-col items-center justify-center gap-1 italic tracking-tighter uppercase text-sm transform active:scale-95 transition-all">
        <span className="text-3xl">📖</span> Comics
      </button>
      <button onClick={() => setPage('library')} className="h-36 bg-purple-500 text-white rounded-[2rem] shadow-xl font-black flex flex-col items-center justify-center gap-1 italic tracking-tighter uppercase text-sm transform active:scale-95 transition-all">
        <span className="text-3xl">📚</span> Library
      </button>
      <button onClick={() => setPage('score')} className="h-36 bg-yellow-500 text-white rounded-[2rem] shadow-xl font-black flex flex-col items-center justify-center gap-1 italic tracking-tighter uppercase text-sm transform active:scale-95 transition-all">
        <span className="text-3xl">📊</span> Score
      </button>
      <button onClick={() => setPage('rewards')} className="h-36 bg-amber-500 text-white rounded-[2rem] shadow-xl font-black flex flex-col items-center justify-center gap-1 italic tracking-tighter uppercase text-sm transform active:scale-95 transition-all">
        <span className="text-3xl">🏆</span> Rewards
      </button>
      <button onClick={() => setPage('settings')} className="h-36 bg-slate-700 text-white rounded-[2rem] shadow-xl font-black flex flex-col items-center justify-center gap-1 italic tracking-tighter uppercase text-sm transform active:scale-95 transition-all">
        <span className="text-3xl">⚙️</span> Settings
      </button>
      </div>
    </div>
  );
}