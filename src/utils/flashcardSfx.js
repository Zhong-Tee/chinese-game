import { playSfx, stopSfx } from './gameAudio';

const TIMER_WARN_SFX_ID = 'flashcard_timer';

export function stopFlashcardTimerWarnSfx() {
  stopSfx(TIMER_WARN_SFX_ID);
}

/** เล่นเฉพาะเสียง flashcard_correct จาก Admin (ไม่ fallback) */
export function playFlashcardCorrectSfx(sfx = {}) {
  stopFlashcardTimerWarnSfx();
  playSfx(sfx.flashcard_correct, 0.65);
}

/** เล่นเฉพาะเสียง flashcard_wrong จาก Admin (ไม่ fallback) */
export function playFlashcardWrongSfx(sfx = {}) {
  stopFlashcardTimerWarnSfx();
  playSfx(sfx.flashcard_wrong, 0.6);
}

/** เล่นเฉพาะเสียง flashcard_timer จาก Admin เมื่อเหลือ 10 วินาที (ไม่ fallback) */
export function playFlashcardTimerWarnSfx(sfx = {}) {
  playSfx(sfx.flashcard_timer, 0.35, { stoppableId: TIMER_WARN_SFX_ID });
}
