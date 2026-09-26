-- เก็บคำผิดของผู้ใช้หนึ่งคำได้เพียงหนึ่งครั้ง ไม่แยกตามชนิดเกม
-- ลบรายการซ้ำเดิมโดยเก็บแถวล่าสุดไว้ ก่อนสร้าง unique index
delete from public.user_wrong_words older
using public.user_wrong_words newer
where older.user_id = newer.user_id
  and older.flashcard_id = newer.flashcard_id
  and (
    older.created_at < newer.created_at
    or (older.created_at = newer.created_at and older.id < newer.id)
  );

create unique index if not exists user_wrong_words_user_flashcard_unique
  on public.user_wrong_words (user_id, flashcard_id);
