import { playSfx, stopSfx } from './gameAudio';

const TIMER_WARN_SFX_ID = 'flashcard_timer';

export function stopFlashcardTimerWarnSfx() {
  stopSfx(TIMER_WARN_SFX_ID);
}

export function playFlashcardCorrectSfx(sfx = {}) {
  stopFlashcardTimerWarnSfx();
  playSfx(sfx.flashcard_correct || sfx.win || sfx.player_attack, 0.65);
}

export function playFlashcardWrongSfx(sfx = {}) {
  stopFlashcardTimerWarnSfx();
  playSfx(sfx.flashcard_wrong || sfx.lose || sfx.enemy_attack || sfx.hit, 0.6);
}

/** เตือนเมื่อเหลือเวลา 10 วินาที (เล่นครั้งเดียวต่อช่วงโจทย์) */
export function playFlashcardTimerWarnSfx(sfx = {}) {
  playSfx(sfx.flashcard_timer || sfx.hit, 0.35, { stoppableId: TIMER_WARN_SFX_ID });
}
