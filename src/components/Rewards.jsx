// src/components/Rewards.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function Rewards({ user, setPage }) {
  const [books, setBooks] = useState([]);
  const [selectedBook, setSelectedBook] = useState(null);
  const [stickers, setStickers] = useState([]);
  const [userStickers, setUserStickers] = useState([]);

  useEffect(() => {
    if (user?.id) {
      fetchBooks();
      fetchUserStickers();
    }
  }, [user?.id]);

  const fetchBooks = async () => {
    const { data } = await supabase
      .from('sticker_books')
      .select('*')
      .order('id');
    setBooks(data || []);
  };

  const fetchUserStickers = async () => {
    const { data } = await supabase
      .from('user_stickers')
      .select('sticker_id')
      .eq('user_id', user.id);
    setUserStickers(data?.map(s => s.sticker_id) || []);
  };

  const fetchStickers = async (bookId) => {
    const { data } = await supabase
      .from('stickers')
      .select('*')
      .eq('book_id', bookId)
      .order('order_index');
    setStickers(data || []);
    
    // ตรวจสอบและให้สติกเกอร์อัตโนมัติ
    await supabase.rpc('check_and_unlock_stickers', { p_user_id: user.id });
    await fetchUserStickers(); // รีเฟรชข้อมูล
  };

  const isUnlocked = (stickerId) => {
    return userStickers.includes(stickerId);
  };

  return (
    <div className="space-y-4 pb-10">
      <button onClick={() => setPage('dashboard')} className="text-orange-600 font-black italic underline uppercase text-xs">← Back</button>
      <h2 className="text-2xl font-black italic uppercase text-center mb-6">🏆 Rewards</h2>
      
      {!selectedBook ? (
        // แสดงรายการเล่ม
        <div className="grid grid-cols-2 gap-4">
          {books.map(book => (
            <button
              key={book.id}
              onClick={() => {
                setSelectedBook(book);
                fetchStickers(book.id);
              }}
              className="bg-white p-6 rounded-2xl border-2 border-slate-200 shadow-lg hover:shadow-xl transition-all"
            >
              {/* แสดงรูป icon_url ถ้ามี */}
              {book.icon_url ? (
                <div className="mb-4 flex justify-center">
                  <img
                    src={book.icon_url}
                    alt={book.name}
                    className="w-32 h-32 object-contain drop-shadow-lg"
                  />
                </div>
              ) : (
                <div className="mb-4 flex justify-center">
                  <div className="w-32 h-32 bg-gradient-to-br from-slate-100 to-slate-200 rounded-xl flex items-center justify-center shadow-inner">
                    <span className="text-5xl">📚</span>
                  </div>
                </div>
              )}
              <h3 className="font-black text-lg mb-2">{book.name}</h3>
              <p className="text-sm text-slate-600">{book.description}</p>
            </button>
          ))}
        </div>
      ) : (
        // แสดงสติกเกอร์ในเล่ม
        <div>
          <button onClick={() => setSelectedBook(null)} className="mb-4 text-orange-600 font-black italic underline">← Back</button>
          <h3 className="text-xl font-black mb-4">{selectedBook.name}</h3>
          
          <div className="grid grid-cols-3 gap-4">
            {stickers.map(sticker => {
              const unlocked = isUnlocked(sticker.id);
              return (
                <div
                  key={sticker.id}
                  className={`relative p-4 rounded-2xl border-2 ${
                    unlocked ? 'bg-white border-orange-500' : 'bg-slate-100 border-slate-300'
                  }`}
                >
                  {unlocked ? (
                    <img
                      src={sticker.image_url}
                      alt={sticker.name}
                      className="w-full h-auto"
                    />
                  ) : (
                    <div className="relative w-full flex items-center justify-center min-h-[120px]">
                      {/* รูปเงาสีดำ - ใช้ filter เพื่อทำให้เป็นเงาสีดำสนิท */}
                      <img
                        src={sticker.image_url}
                        alt={sticker.name}
                        className="w-full h-auto"
                        style={{
                          filter: 'brightness(0) saturate(0)',
                          WebkitFilter: 'brightness(0) saturate(0)',
                          opacity: 0.4,
                        }}
                      />
                    </div>
                  )}
                  <p className="text-xs text-center mt-2 font-bold">{sticker.name}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}