import React, { useState } from 'react';
import { supabase } from '../supabaseClient'; // ต้องใช้ ../ เพราะถอยหลัง 1 step ไปหาไฟล์ข้างนอก

export default function Login({ setPage, setUser, fetchInitialData, fetchUserSettings, checkAndAddDailyWords, setDailyNewWords }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [messageModal, setMessageModal] = useState(null);

  const thaiAuthMessage = (message) => {
    const text = String(message || '').toLowerCase();
    if (text.includes('invalid login credentials')) return 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง';
    if (text.includes('email not confirmed')) return 'บัญชีนี้ยังไม่ได้ยืนยันการสมัคร';
    if (text.includes('user already registered')) return 'ชื่อผู้ใช้นี้ถูกสมัครไว้แล้ว';
    if (text.includes('password should be at least')) return 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร';
    if (text.includes('too many requests') || text.includes('rate limit')) return 'มีการลองเข้าสู่ระบบหลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่';
    if (text.includes('network') || text.includes('fetch')) return 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาตรวจสอบอินเทอร์เน็ต';
    return 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง';
  };

  const showMessage = (title, message, type = 'error') => setMessageModal({ title, message, type });

  // ฟังก์ชันสมัครสมาชิก
  const handleSignUp = async () => {
    if (!username || !password) {
      showMessage('ข้อมูลไม่ครบ', 'กรุณากรอกชื่อผู้ใช้และรหัสผ่านให้ครบ');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: `${username}@nihao.com`,
      password: password,
    });
    if (error) showMessage('สมัครสมาชิกไม่สำเร็จ', thaiAuthMessage(error.message));
    else showMessage('สมัครสมาชิกสำเร็จ', 'สร้างบัญชีเรียบร้อยแล้ว สามารถกดเข้าสู่ระบบได้เลย', 'success');
    setLoading(false);
  };

  // ฟังก์ชันเข้าสู่ระบบ
  const handleLogin = async () => {
    if (!username || !password) {
      showMessage('ข้อมูลไม่ครบ', 'กรุณากรอกชื่อผู้ใช้และรหัสผ่านให้ครบ');
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: `${username}@nihao.com`,
      password: password,
    });
    if (error) {
      showMessage('เข้าสู่ระบบไม่สำเร็จ', thaiAuthMessage(error.message));
    } else {
      setUser(data.user);
      setPage('dashboard');
      fetchInitialData(data.user.id);
      fetchUserSettings(data.user.id);
      
      // บันทึกการ login
      try {
        await supabase.from('user_logins').insert({ user_id: data.user.id });
      } catch (err) {
        console.error('Error logging login:', err);
      }

      // เช็คและเพิ่มคำศัพท์ประจำวัน
      try {
        const newWords = await checkAndAddDailyWords(data.user.id);
        if (newWords && newWords.length > 0) setDailyNewWords(newWords);
      } catch (err) {
        console.error('Error checking daily words:', err);
      }
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-1 w-full flex-col items-center justify-center p-6 text-center font-sans pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      {messageModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/80 p-5 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="login-message-title">
          <div className="w-full max-w-sm overflow-hidden rounded-3xl border-2 border-white/10 bg-slate-900 text-white shadow-2xl">
            <div className={`px-6 py-5 text-center ${messageModal.type === 'success' ? 'bg-emerald-500' : 'bg-gradient-to-r from-orange-500 to-red-500'}`}>
              <div className="mb-2 text-5xl">{messageModal.type === 'success' ? '✅' : '⚠️'}</div>
              <h2 id="login-message-title" className="text-xl font-black">{messageModal.title}</h2>
            </div>
            <div className="px-6 py-6 text-center">
              <p className="text-sm font-bold leading-relaxed text-white/80">{messageModal.message}</p>
              <button
                type="button"
                autoFocus
                onClick={() => setMessageModal(null)}
                className={`mt-6 w-full rounded-2xl py-3.5 font-black text-white shadow-lg active:scale-95 ${messageModal.type === 'success' ? 'bg-emerald-500' : 'bg-orange-500'}`}
              >
                ตกลง
              </button>
            </div>
          </div>
        </div>
      )}
      <h1 className="text-4xl font-black text-orange-600 mb-8 italic uppercase tracking-tighter">Nihao Game</h1>
      <form
        className="w-full max-w-xs space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          handleLogin();
        }}
      >
        <input 
          type="text" 
          placeholder="Username" 
          className="w-full p-4 border rounded-3xl outline-none shadow-inner" 
          value={username}
          onChange={e => setUsername(e.target.value)} 
        />
        <input 
          type="password" 
          placeholder="Password" 
          className="w-full p-4 border rounded-3xl outline-none shadow-inner" 
          value={password}
          onChange={e => setPassword(e.target.value)} 
        />
        <button 
          type="submit"
          disabled={loading}
          className="w-full bg-orange-600 text-white p-4 rounded-3xl font-black shadow-lg uppercase active:scale-95 transition-all"
        >
          {loading ? 'Logging in...' : 'Login'}
        </button>
        <button 
          type="button"
          onClick={handleSignUp} 
          disabled={loading}
          className="w-full bg-white border-2 border-orange-600 text-orange-600 p-4 rounded-3xl font-black shadow-lg uppercase active:scale-95 transition-all mt-4"
        >
          {loading ? 'กำลังสมัคร...' : 'สมัคร'}
        </button>
        <p className="px-3 text-xs font-bold leading-relaxed text-slate-500">
          ต้องกรอกชื่อและรหัสผ่าน แล้วกดปุ่ม สมัคร
        </p>
      </form>
    </div>
  );
}
