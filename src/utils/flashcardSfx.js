import { playSfx } from './gameAudio';

export function playFlashcardCorrectSfx(sfx = {}) {
  playSfx(sfx.flashcard_correct || sfx.win || sfx.player_attack, 0.65);
}

export function playFlashcardWrongSfx(sfx = {}) {
  playSfx(sfx.flashcard_wrong || sfx.lose || sfx.enemy_attack || sfx.hit, 0.6);
}

/** เตือนเมื่อเหลือเวลา 10 วินาที (เล่นครั้งเดียวต่อช่วงโจทย์) */
export function playFlashcardTimerWarnSfx(sfx = {}) {
  playSfx(sfx.flashcard_timer || sfx.hit, 0.35);
}
