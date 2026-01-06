import React, { useState } from 'react';
import { supabase } from '../supabaseClient'; // ต้องใช้ ../ เพราะถอยหลัง 1 step ไปหาไฟล์ข้างนอก

export default function Login({ setPage, setUser, fetchInitialData, fetchUserSettings }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // ฟังก์ชันสมัครสมาชิก
  const handleSignUp = async () => {
    if (!username || !password) return alert("กรุณากรอกข้อมูลให้ครบ");
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: `${username}@nihao.com`,
      password: password,
    });
    if (error) alert(error.message);
    else alert("สมัครสำเร็จ! กดเข้าสู่ระบบได้เลย");
    setLoading(false);
  };

  // ฟังก์ชันเข้าสู่ระบบ
  const handleLogin = async () => {
    if (!username || !password) return alert("กรุณากรอกข้อมูลให้ครบ");
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: `${username}@nihao.com`,
      password: password,
    });
    if (error) {
      alert(error.message);
    } else {
      setUser(data.user);
      setPage('dashboard');
      fetchInitialData(data.user.id);
      fetchUserSettings(data.user.id);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-100 text-center font-sans">
      <h1 className="text-4xl font-black text-orange-600 mb-8 italic uppercase tracking-tighter">Nihao Game</h1>
      <div className="w-full max-w-xs space-y-4">
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
          onClick={handleLogin} 
          disabled={loading}
          className="w-full bg-orange-600 text-white p-4 rounded-3xl font-black shadow-lg uppercase active:scale-95 transition-all"
        >
          {loading ? 'Logging in...' : 'Login'}
        </button>
        <button 
          onClick={handleSignUp} 
          disabled={loading}
          className="text-orange-600 font-bold text-sm uppercase tracking-widest mt-4"
        >
          หรือสมัครสมาชิกใหม่
        </button>
      </div>
    </div>
  );
}