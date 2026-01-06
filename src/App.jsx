import React, { useState } from 'react';

export default function App() {
  const [page, setPage] = useState('dashboard');
  const [theme, setTheme] = useState('default');

  // หน้าเมนูหลัก
  const Dashboard = () => (
    <div className="p-4 grid grid-cols-2 gap-4">
      <button onClick={() => setPage('fc-hub')} className="h-32 bg-orange-500 text-white rounded-2xl font-bold shadow-lg transform active:scale-95 transition">Flashcards</button>
      <button onClick={() => setPage('minigames')} className="h-32 bg-green-500 text-white rounded-2xl font-bold shadow-lg transform active:scale-95 transition">Mini Games</button>
      <button onClick={() => setPage('comics')} className="h-32 bg-pink-500 text-white rounded-2xl font-bold shadow-lg transform active:scale-95 transition text-center">การ์ตูนฝึกอ่าน</button>
      <button onClick={() => setPage('library')} className="h-32 bg-purple-500 text-white rounded-2xl font-bold shadow-lg transform active:scale-95 transition">คลังความรู้</button>
      <button onClick={() => setPage('rewards')} className="h-32 bg-yellow-500 text-white rounded-2xl font-bold shadow-lg transform active:scale-95 transition">รางวัล & สมุดสะสม</button>
      <button onClick={() => setPage('settings')} className="h-32 bg-gray-500 text-white rounded-2xl font-bold shadow-lg transform active:scale-95 transition text-sm">ตั้งค่า & สถิติ</button>
    </div>
  );

  // หน้าเลือกโหมด Flashcard
  const FlashcardHub = () => (
    <div className="p-4 flex flex-col gap-4">
      <button onClick={() => setPage('dashboard')} className="text-blue-500 font-bold mb-2 w-fit">← กลับหน้าหลัก</button>
      <h2 className="text-xl font-bold text-center mb-4">โหมด Flashcard</h2>
      <button onClick={() => setPage('fc-chars')} className="p-6 bg-orange-100 border-2 border-orange-500 rounded-3xl text-orange-700 font-bold text-lg">ตัวอักษรจีน (7 Levels)</button>
      <button onClick={() => setPage('fc-vocab')} className="p-6 bg-blue-100 border-2 border-blue-500 rounded-3xl text-blue-700 font-bold text-lg">คำศัพท์แยกหมวดหมู่</button>
    </div>
  );

  return (
    <div className={`min-h-screen ${theme === 'zootopia' ? 'bg-yellow-50' : 'bg-slate-50'} pb-20`}>
      {/* Header */}
      <header className="p-4 bg-white shadow-sm flex justify-between items-center border-b-4 border-orange-500">
        <h1 className="font-black text-orange-600 text-xl tracking-tighter">NIHAO GAME</h1>
        <select value={theme} onChange={(e) => setTheme(e.target.value)} className="border rounded text-sm p-1">
          <option value="default">ธีมปกติ</option>
          <option value="zootopia">ธีม Zootopia</option>
        </select>
      </header>

      {/* สลับหน้าจอตรงนี้ */}
      <main className="max-w-md mx-auto py-6">
        {page === 'dashboard' && <Dashboard />}
        {page === 'fc-hub' && <FlashcardHub />}
        
        {/* หน้าอื่นๆ ที่ยังไม่ได้เขียนโค้ด (Placeholder) */}
        {['minigames', 'comics', 'library', 'rewards', 'settings', 'fc-chars', 'fc-vocab'].includes(page) && (
          <div className="text-center p-10 bg-white m-4 rounded-3xl shadow-inner border-2 border-dashed border-gray-300">
            <h2 className="text-2xl font-bold text-gray-400 mb-6 uppercase tracking-widest">{page.replace('-', ' ')}</h2>
            <button onClick={() => setPage(page.includes('fc-') ? 'fc-hub' : 'dashboard')} className="bg-orange-500 text-white px-8 py-2 rounded-full font-bold shadow-md">กลับไปก่อน</button>
            <p className="mt-4 text-xs text-gray-400 font-medium">หน้านี้กำลังรอเขียน Logic ใน Step ถัดไป...</p>
          </div>
        )}
      </main>

      {/* เมนูแถบล่าง (Bottom Nav) */}
      <nav className="fixed bottom-0 w-full bg-white border-t flex justify-around p-3 shadow-2xl rounded-t-3xl">
        <button onClick={() => setPage('dashboard')} className="flex flex-col items-center"><span className="text-lg">🏠</span><span className="text-[10px] font-bold">HOME</span></button>
        <button onClick={() => setPage('rewards')} className="flex flex-col items-center"><span className="text-lg">🏆</span><span className="text-[10px] font-bold">AWARD</span></button>
        <button onClick={() => setPage('settings')} className="flex flex-col items-center"><span className="text-lg">⚙️</span><span className="text-[10px] font-bold">SETTING</span></button>
      </nav>
    </div>
  );
}