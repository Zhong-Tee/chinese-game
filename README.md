# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Deploy บน Vercel

เมื่อ deploy บน Vercel ถ้ารูปการ์ด (Flashcard) โหลดไม่ขึ้น ให้ตั้ง **CORS** ที่ Supabase Storage:

1. เปิด Supabase Dashboard → Storage → bucket ที่เก็บรูป
2. ไปที่ CORS settings
3. เพิ่ม origin ของ Vercel เช่น `https://your-app.vercel.app` หรือ `https://*.vercel.app`
4. อนุญาต method `GET` และ header ที่จำเป็น

ถ้าไม่ตั้ง CORS รูปจาก Supabase อาจโหลดได้บน local แต่โหลดไม่ได้บน Vercel

## Sync จำนวน Review / Normal ทุกเครื่อง

เพื่อให้จำนวน **Review** และ **Normal** แสดงตรงกันทุกเครื่อง (คอมฯ / มือถือ) ต้องสร้างตาราง `user_minigame_played` ใน Supabase:

1. เปิด Supabase Dashboard → SQL Editor
2. รัน SQL จากไฟล์ `supabase_migration_minigame_played.sql` ในโปรเจกต์นี้

ถ้ายังไม่รัน migration แอปจะ fallback ไปใช้ localStorage (ตัวเลขจะไม่ sync ข้ามเครื่อง)

## ตัวเลข Review / Left ไม่ลดหลังออกแล้วเข้าใหม่

แอปอัปเดต `minigame_wrong_count` ในตาราง `user_progress` เป็น **object** (เช่น `{ th: 0, pinyin: 1 }`) ตามเกม ถ้าคอลัมน์ใน DB เป็น **integer (int4)** การอัปเดตจะไม่บันทึก ตัวเลขจึงไม่ลด

**แก้ไข:** เปลี่ยนคอลัมน์เป็น **jsonb** แล้วรัน migration:

1. เปิด Supabase Dashboard → SQL Editor
2. รัน SQL จากไฟล์ `supabase_migration_minigame_wrong_count_jsonb.sql` ในโปรเจกต์นี้

หลังรันแล้ว ตอบถูกโหมด Review ตัวเลข Review/Left จะลดและคงค่าเมื่อออกแล้วเข้าใหม่

ถ้ายังไม่ลด ให้ตรวจสอบ RLS ของตาราง `user_progress` (ต้องอนุญาต UPDATE แถวของตัวเอง) และดู Console (F12) ว่ามี `Review reset update failed` หรือไม่

## รายการคำผิด (คำผิด)

เมื่อกด **WRONG** ในมินิเกม แอปจะบันทึกคำนั้นเป็น "คำผิด" และแสดงรายการใน **Settings** ใต้ Set Level Schedule

ต้องสร้างตาราง `user_wrong_words` ใน Supabase ก่อน:

1. เปิด Supabase Dashboard → SQL Editor
2. รัน SQL จากไฟล์ `supabase_migration_user_wrong_words.sql` ในโปรเจกต์นี้
