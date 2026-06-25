import React, { useCallback, useEffect, useRef, useState } from 'react';
import SpeakerButton from './SpeakerButton';
import {
  getStageConfig,
  getStages,
  getSfxMap,
  getCharacterStats,
  getUserItems,
  consumeItem,
  addCurrency,
  levelUp,
  pickRandom,
  computeMedal,
  getDifficultyMultiplier,
  getDifficultyRewardType,
  getDifficultyRewardLabel,
  MAX_ITEM_CARRY,
} from '../utils/gameStorage';
import RewardIcon from './RewardIcon';
import { playBgm, stopBgm, playSfx } from '../utils/gameAudio';
import { norm, shuffle, stripPunct, sentenceTokens } from '../utils/sentenceTokens';

const EXP_PER_MONSTER = 1;
const EXP_PER_BOSS = 5;
// EXP ที่จ่ายระหว่างเล่น (ต่อการฆ่า 1 ตัว) = 20% ของรางวัลเต็ม เพื่อกันการฟาร์มจากการเล่นไม่จบ/เล่นซ้ำ
// ส่วนที่เหลืออีก 80% จะจ่ายเป็นโบนัสก้อนเดียวเมื่อ "เคลียร์ด่านสำเร็จครั้งแรก" เท่านั้น
const DURING_RUN_EXP_RATE = 0.2;
const FEEDBACK_MS = 1200;

export default function BattleGame({ user, stageNo, difficulty = 'easy', alreadyWon = false, selectedCharacterId = null, equippedItemIds = [], allMasterCards = [], onExit, onReward, onLevelUp, onStageComplete }) {
  const [phase, setPhase] = useState('loading'); // loading | empty | playing | won | lost
  const [errorMsg, setErrorMsg] = useState('');
  const [loadKey, setLoadKey] = useState(0); // bump เพื่อเริ่มด่านใหม่

  // config
  const [stage, setStage] = useState(null);
  const [bgUrl, setBgUrl] = useState(null);
  const sfxRef = useRef({});

  // enemies
  const [enemyQueue, setEnemyQueue] = useState([]);
  const [enemyIdx, setEnemyIdx] = useState(0);
  const [enemyHp, setEnemyHp] = useState(0);

  // player
  const [maxHp, setMaxHp] = useState(3);
  const [playerHp, setPlayerHp] = useState(3);
  const [attack, setAttack] = useState(1);
  const [shield, setShield] = useState(false);
  const [items, setItems] = useState([]); // [{item_id, name, icon_url, effect_type, effect_value, quantity}]

  // words
  const wordsRef = useRef([]);
  // ชุดโจทย์ของด่าน: แต่ละโจทย์ผูกกับ "การ์ด + ชนิดโจทย์" ที่ไม่ซ้ำกันภายในหนึ่งรอบ
  // (จำนวนแต่ละชนิดเป็นไปตามที่ admin ตั้งไว้) เมื่อเล่นครบรอบจะสับใหม่เพื่อเลี่ยงซ้ำติดกัน
  const questionDeckRef = useRef([]); // [{ card, type: 'word' | 'typing' | 'rearrange' }]
  const questionPosRef = useRef(0);

  // round
  const [round, setRound] = useState(null); // {type, card, subStage, choices, correctAnswer}
  const [answered, setAnswered] = useState(false);
  const [selected, setSelected] = useState('');
  const [revealAnswer, setRevealAnswer] = useState('');
  const [lastCorrect, setLastCorrect] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [timer, setTimer] = useState(8);

  // rearrange
  const [tokens, setTokens] = useState([]); // {id, text}
  const [assembled, setAssembled] = useState([]); // token ids in order

  // typing (ฝึกพิมพ์)
  const [typed, setTyped] = useState('');
  const typingInputRef = useRef(null);

  // fx
  const [enemyHurt, setEnemyHurt] = useState(false);
  const [playerHurt, setPlayerHurt] = useState(false);
  const [expEarned, setExpEarned] = useState(0);
  const runExpAccRef = useRef(0);     // ตัวสะสมเศษ EXP (จ่ายแบบลด 20% ระหว่างเล่น)
  const runExpAwardedRef = useRef(0); // EXP รวมที่จ่ายไปแล้วในรอบนี้ (ไว้คิดโบนัสตอนเคลียร์ครั้งแรก)
  const [leveledUpTo, setLeveledUpTo] = useState(null); // เลเวลใหม่หลังฆ่า Boss

  // คะแนน: นับจำนวนคำที่ตอบถูก/ทั้งหมด เพื่อคำนวณเหรียญรางวัล
  const correctRef = useRef(0);
  const wrongRef = useRef(0);
  const [resultStats, setResultStats] = useState(null); // { correct, total, medal }
  const [screenFx, setScreenFx] = useState(null); // 'good' | 'bad' | 'block'
  const [fxKey, setFxKey] = useState(0);

  const triggerFx = useCallback((kind) => {
    setScreenFx(kind);
    setFxKey(k => k + 1);
  }, []);

  const currentEnemy = enemyQueue[enemyIdx] || null;
  const answerTime = stage?.answer_time_sec || 8;
  const rearrangeTime = stage?.answer_time_rearrange_sec || 12;
  const typingTime = stage?.answer_time_typing_sec || 15;
  const showSpeaker = (stage?.source_level ?? 3) <= 2;

  // -------------------------------------------------------------------
  // build a 4-choice question from the master pool
  // -------------------------------------------------------------------
  const buildChoices = useCallback((field, card) => {
    const correct = norm(card?.[field]);
    if (!correct) return { choices: ['-', '-2', '-3'], correctAnswer: '' };
    const pool = allMasterCards.map(c => norm(c?.[field])).filter(Boolean);
    const uniq = [...new Set(pool)].filter(t => t !== correct);
    let distractors = shuffle(uniq).slice(0, 2);
    while (distractors.length < 2) distractors.push(`ตัวเลือก ${distractors.length + 1}`);
    return { choices: shuffle([correct, ...distractors]), correctAnswer: correct };
  }, [allMasterCards]);

  // -------------------------------------------------------------------
  // setup the next question round
  // -------------------------------------------------------------------
  const nextRound = useCallback(() => {
    const words = wordsRef.current;
    if (!words.length) return;

    setAnswered(false);
    setSelected('');
    setRevealAnswer('');
    setLastCorrect(false);
    setTimedOut(false);
    setTyped('');

    // ดึงโจทย์ถัดไปจากชุดโจทย์ (การ์ด + ชนิด ไม่ซ้ำกันภายในหนึ่งรอบ)
    let deck = questionDeckRef.current;
    if (!deck.length) {
      // fallback: ถ้าไม่มีชุดโจทย์ ให้ใช้โจทย์เลือกตอบจากคำแรก
      const card = words[0];
      setTimer(answerTime);
      const c = buildChoices('pinyin', card);
      setRound({ type: 'word', card, subStage: 'pinyin', choices: c.choices, correctAnswer: c.correctAnswer });
      return;
    }
    // เล่นครบรอบแล้ว → สับลำดับใหม่ เริ่มรอบใหม่ (เลี่ยงโจทย์ซ้ำติดกัน)
    if (questionPosRef.current >= deck.length) {
      questionDeckRef.current = shuffle(deck);
      questionPosRef.current = 0;
      deck = questionDeckRef.current;
    }
    const item = deck[questionPosRef.current];
    questionPosRef.current += 1;
    const card = item.card;

    // โจทย์ฝึกพิมพ์
    if (item.type === 'typing' && norm(card?.vocabulary)) {
      const vocab = norm(card.vocabulary);
      setTimer(typingTime);
      setRound({ type: 'typing', card, correct: vocab, correctAnswer: vocab });
      return;
    }

    // โจทย์เรียงคำ
    if (item.type === 'rearrange') {
      const toks = sentenceTokens(card);
      if (toks.length >= 2) {
        setTimer(rearrangeTime);
        const withIds = toks.map((t, i) => ({ id: `${i}-${t}`, text: t }));
        setTokens(shuffle(withIds));
        setAssembled([]);
        setRound({ type: 'rearrange', card, correct: toks.join(''), tokensOrder: toks });
        return;
      }
    }

    // โจทย์แบบเลือกตอบ — เริ่มที่ pinyin (เป็นค่าเริ่มต้น + fallback)
    setTimer(answerTime);
    const c = buildChoices('pinyin', card);
    setRound({ type: 'word', card, subStage: 'pinyin', choices: c.choices, correctAnswer: c.correctAnswer });
  }, [answerTime, rearrangeTime, typingTime, buildChoices]);

  // -------------------------------------------------------------------
  // initial load
  // -------------------------------------------------------------------
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [cfg, sfx, stats] = await Promise.all([
          getStageConfig(stageNo),
          getSfxMap(),
          getCharacterStats(user?.id),
        ]);
        if (!alive) return;
        sfxRef.current = sfx;

        if (!cfg.stage) { setErrorMsg('ยังไม่ได้ตั้งค่าด่านนี้'); setPhase('empty'); return; }
        setStage(cfg.stage);
        setBgUrl(pickRandom(cfg.backgrounds)?.image_url || null);

        // เพลงพื้นหลังสุ่ม
        const music = pickRandom(cfg.music)?.music_url;
        if (music) playBgm(music);

        // ตัวละครผู้เล่น (ค่าพลัง — ไม่แสดงรูปในสนามรบ)
        setMaxHp(stats.maxHp);
        setPlayerHp(stats.maxHp);
        setAttack(stats.attack);

        // inventory (3 ช่อง)
        const inv = await getUserItems(user?.id);
        if (!alive) return;
        const invMapped = inv.map(r => ({
          item_id: r.item_id,
          // จำกัดจำนวนที่พกเข้าสู้ไม่เกิน MAX_ITEM_CARRY ต่อชนิด (แม้คลังจะมีมากกว่า)
          quantity: Math.min(r.quantity, MAX_ITEM_CARRY),
          name: r.shop_items?.name,
          icon_url: r.shop_items?.icon_url,
          effect_type: r.shop_items?.effect_type,
          effect_value: r.shop_items?.effect_value,
        }));
        // ใช้อาวุธที่ผู้เล่นเลือกไว้ (equippedItemIds) ตามลำดับช่อง
        // ถ้ายังไม่ได้เลือกเลย → ใช้ 3 ชิ้นแรกที่มี (เข้ากันได้กับของเดิม)
        const eqIds = (equippedItemIds || []).filter(v => v != null);
        const chosen = eqIds.length > 0
          ? eqIds.map(id => invMapped.find(it => it.item_id === id)).filter(Boolean).slice(0, 3)
          : invMapped.slice(0, 3);
        setItems(chosen);

        // สร้างคิวศัตรู: มอนสเตอร์ตาม monster_count แล้วตามด้วยบอส (คูณ HP/ATK ตามระดับความยาก)
        const mult = getDifficultyMultiplier(difficulty);
        const scaleEnemy = (e, isBoss) => {
          const hp = (e.hp || 1) * mult;
          const atk = (e.attack || 1) * mult;
          return { ...e, hp, maxHp: hp, attack: atk, isBoss };
        };
        const monsters = cfg.enemies.filter(e => e.type === 'monster');
        const bosses = cfg.enemies.filter(e => e.type === 'boss');
        const queue = [];
        const count = cfg.stage.monster_count || 3;
        if (monsters.length > 0) {
          for (let i = 0; i < count; i++) {
            const m = monsters[i % monsters.length];
            queue.push(scaleEnemy(m, false));
          }
        }
        bosses.forEach(b => queue.push(scaleEnemy(b, true)));
        if (queue.length === 0) {
          // fallback ถ้า admin ยังไม่ตั้งศัตรู
          for (let i = 0; i < count; i++) queue.push(scaleEnemy({ name: 'มอนสเตอร์', image_url: null, hp: 3, attack: 1 }, false));
          queue.push(scaleEnemy({ name: 'บอส', image_url: null, hp: 8, attack: 2 }, true));
        }
        setEnemyQueue(queue);
        setEnemyIdx(0);
        setEnemyHp(queue[0].hp);

        // ใช้คำศัพท์ทั้งหมดจากคลัง (ตามที่ admin ตั้งค่าด่านไว้)
        // โดยไม่สนใจว่าผู้เล่นเลือกคำใน Select Study Words ไว้หรือไม่
        // แบ่งให้แต่ละด่านตามลำดับการ์ด: ด่านละ (monster_count + 1) คำ
        const allStages = await getStages();
        if (!alive) return;
        // เรียงการ์ดทั้งหมดตามลำดับ id (เหมือนหน้า Select Study Words)
        const orderedCards = [...allMasterCards]
          .sort((a, b) => Number(a.id1 || a.id) - Number(b.id1 || b.id));

        // จำนวนคำต่อด่าน = มอนสเตอร์ + บอส 1 ตัว
        const wordsInStage = (s) => (s.monster_count || 0) + 1;
        // offset = ผลรวมคำของด่านก่อนหน้า (เรียงตาม stage_no)
        let offset = 0;
        for (const s of allStages) {
          if (s.stage_no < stageNo) offset += wordsInStage(s);
        }
        const thisCount = wordsInStage(cfg.stage);
        const cards = orderedCards.slice(offset, offset + thisCount);
        if (cards.length === 0) {
          setErrorMsg('ยังไม่มีคำศัพท์สำหรับด่านนี้ — คลังคำศัพท์ไม่พอสำหรับด่านนี้');
          setPhase('empty');
          return;
        }
        wordsRef.current = shuffle(cards);

        // สร้างชุดโจทย์ของด่าน: ผูกแต่ละโจทย์กับ "การ์ด" ที่ไม่ซ้ำกัน (เลี่ยงโจทย์ซ้ำ)
        // จำนวนแต่ละชนิดเป็นไปตามที่ admin ตั้งไว้ และจำกัดด้วยจำนวนการ์ดที่เหมาะกับชนิดนั้น
        const choiceN = Math.max(0, cfg.stage.q_choice_count ?? 20);
        const typingN = Math.max(0, cfg.stage.q_typing_count ?? 5);
        const rearrangeN = Math.max(0, cfg.stage.q_rearrange_count ?? 5);
        const cardKey = (c) => Number(c.id1 || c.id);
        const used = new Set();
        // สุ่มหยิบการ์ด n ใบจาก pool ที่ยังไม่ถูกใช้ (กันการ์ดซ้ำข้ามชนิดโจทย์)
        const takeCards = (pool, n) => {
          const out = [];
          for (const c of shuffle(pool.filter(c => !used.has(cardKey(c))))) {
            if (out.length >= n) break;
            out.push(c);
            used.add(cardKey(c));
          }
          return out;
        };
        // ชนิดที่มีเงื่อนไข (เรียงคำ/พิมพ์) เลือกก่อน แล้วค่อยเลือกตอบจากที่เหลือ
        const rearrEligible = cards.filter(c => sentenceTokens(c).length >= 2);
        const typingEligible = cards.filter(c => norm(c?.vocabulary));
        const deck = [
          ...takeCards(rearrEligible, rearrangeN).map(card => ({ card, type: 'rearrange' })),
          ...takeCards(typingEligible, typingN).map(card => ({ card, type: 'typing' })),
          ...takeCards(cards, choiceN).map(card => ({ card, type: 'word' })),
        ];
        questionDeckRef.current = shuffle(deck);
        questionPosRef.current = 0;

        correctRef.current = 0;
        wrongRef.current = 0;
        runExpAccRef.current = 0;
        runExpAwardedRef.current = 0;
        setResultStats(null);
        setPhase('playing');
      } catch (e) {
        console.error('BattleGame load error:', e);
        if (alive) { setErrorMsg('เกิดข้อผิดพลาดในการโหลดด่าน'); setPhase('empty'); }
      }
    })();
    return () => { alive = false; stopBgm(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageNo, user?.id, loadKey, selectedCharacterId, difficulty]);

  // เริ่ม round แรกเมื่อพร้อมเล่น
  useEffect(() => {
    if (phase === 'playing' && !round) nextRound();
  }, [phase, round, nextRound]);

  // -------------------------------------------------------------------
  // combat resolution
  // -------------------------------------------------------------------
  // จ่าย EXP เข้ากระเป๋าจริง + อัปเดต UI (ใช้ร่วมกันทั้งรางวัลต่อตัวและโบนัสเคลียร์)
  const addExpDirect = useCallback(async (amount) => {
    if (amount <= 0) return;
    runExpAwardedRef.current += amount;
    setExpEarned(c => c + amount);
    const updated = await addCurrency({ exp: amount });
    if (updated && onReward) onReward(updated);
  }, [onReward]);

  // รางวัลต่อการฆ่า 1 ตัว: จ่ายแบบลดเหลือ 20% เสมอ (กันฟาร์มจากการเล่นไม่จบ/เล่นซ้ำ)
  const awardExp = useCallback((baseAmount) => {
    runExpAccRef.current += baseAmount * DURING_RUN_EXP_RATE;
    const gain = Math.floor(runExpAccRef.current);
    runExpAccRef.current -= gain;
    if (gain > 0) addExpDirect(gain);
  }, [addExpDirect]);

  // โบนัสเคลียร์ครั้งแรก: เติม EXP ให้ครบ "เต็มจำนวนของด่าน" (เฉพาะด่านที่ยังไม่เคยชนะ)
  const awardClearBonus = useCallback((queue) => {
    if (alreadyWon) return;
    const fullStageExp = (queue || []).reduce(
      (s, e) => s + (e.isBoss ? EXP_PER_BOSS : EXP_PER_MONSTER), 0);
    addExpDirect(Math.max(0, fullStageExp - runExpAwardedRef.current));
  }, [alreadyWon, addExpDirect]);

  const resolveAnswer = useCallback((isCorrect, answerText = '') => {
    if (answered || phase !== 'playing') return;
    setAnswered(true);
    setLastCorrect(isCorrect);
    setSelected(answerText);

    if (isCorrect) correctRef.current += 1;
    else wrongRef.current += 1;

    if (isCorrect) {
      playSfx(sfxRef.current.player_attack || sfxRef.current.hit);
      triggerFx('good');
      setEnemyHurt(true);
      setTimeout(() => setEnemyHurt(false), 350);
      const newHp = enemyHp - attack;
      if (newHp <= 0) {
        const enemy = enemyQueue[enemyIdx];
        awardExp(enemy?.isBoss ? EXP_PER_BOSS : EXP_PER_MONSTER);
        // ฆ่า Boss สำเร็จ → Level UP
        if (enemy?.isBoss) {
          levelUp(1).then((updated) => {
            if (updated) {
              setLeveledUpTo(updated.level);
              if (onLevelUp) onLevelUp(updated);
            }
          });
        }
        if (enemyIdx + 1 >= enemyQueue.length) {
          playSfx(sfxRef.current.win);
          stopBgm();
          setEnemyHp(0);
          awardClearBonus(enemyQueue); // เคลียร์สำเร็จครั้งแรก → เติม EXP ให้ครบเต็มด่าน
          const correct = correctRef.current;
          const total = correct + wrongRef.current;
          const medal = computeMedal(correct, total);
          setResultStats({ correct, total, medal });
          if (onStageComplete) onStageComplete(stageNo, { correct, total, medal, difficulty });
          setPhase('won');
        } else {
          // ให้หลอด HP ของศัตรูลดลงจนหมดก่อน แล้วค่อยสลับเป็นตัวถัดไป
          const ni = enemyIdx + 1;
          setEnemyHp(0);
          setTimeout(() => {
            setEnemyIdx(ni);
            setEnemyHp(enemyQueue[ni].hp);
          }, 450);
        }
      } else {
        setEnemyHp(newHp);
      }
    } else if (shield) {
      // มีโล่ → กันการโจมตีครั้งนี้
      triggerFx('block');
      setShield(false);
    } else {
      playSfx(sfxRef.current.enemy_attack || sfxRef.current.hit);
      triggerFx('bad');
      setPlayerHurt(true);
      setTimeout(() => setPlayerHurt(false), 350);
      const dmg = currentEnemy?.attack || 1;
      const np = playerHp - dmg;
      if (np <= 0) {
        playSfx(sfxRef.current.lose);
        stopBgm();
        setPlayerHp(0);
        setPhase('lost');
      } else {
        setPlayerHp(np);
      }
    }
  }, [answered, phase, attack, enemyHp, playerHp, enemyQueue, enemyIdx, shield, currentEnemy, awardExp, awardClearBonus, triggerFx, onLevelUp, onStageComplete, stageNo, difficulty]);

  // จัดการเลือกคำตอบ (pinyin/meaning)
  const handleChoice = (choice) => {
    if (!round || answered) return;
    const isCorrect = norm(choice) === norm(round.correctAnswer);
    setRevealAnswer(round.correctAnswer);
    resolveAnswer(isCorrect, norm(choice));
  };

  // ส่งคำตอบ rearrange (กดปุ่มเอง ไม่ auto)
  const submitRearrange = () => {
    if (answered || assembled.length === 0) return;
    const text = assembled.map(id => tokens.find(t => t.id === id)?.text || '').join('');
    const isCorrect = text === round.correct;
    setRevealAnswer(round.tokensOrder.join(''));
    resolveAnswer(isCorrect, text);
  };

  // ส่งคำตอบฝึกพิมพ์ (พิมพ์คำศัพท์จีนให้ตรง)
  const submitTyping = () => {
    if (answered || !typed.trim()) return;
    const clean = (s) => stripPunct(norm(s)).replace(/\s+/g, '');
    const isCorrect = clean(typed) === clean(round?.correct);
    setRevealAnswer(round?.correctAnswer || '');
    resolveAnswer(isCorrect, typed.trim());
  };

  // แตะ token ในคลัง → เพิ่มเข้าไปต่อท้าย
  const tapToken = (tk) => {
    if (answered || assembled.includes(tk.id)) return;
    setAssembled(prev => [...prev, tk.id]);
  };

  // ถอนคำที่ตำแหน่ง index ออก (แตะคำที่ประกอบไว้)
  const removeAt = (index) => {
    if (answered) return;
    setAssembled(prev => prev.filter((_, i) => i !== index));
  };

  // ลบคำตัวสุดท้าย (ปุ่ม backspace)
  const backspaceToken = () => {
    if (answered) return;
    setAssembled(prev => prev.slice(0, -1));
  };

  const resetAssembled = () => { if (!answered) setAssembled([]); };

  // โฟกัสกล่องพิมพ์เมื่อเข้าโจทย์ฝึกพิมพ์ (เรียกแป้นพิมพ์มือถือขึ้นมา)
  useEffect(() => {
    if (round?.type === 'typing' && !answered) {
      const t = setTimeout(() => typingInputRef.current?.focus(), 120);
      return () => clearTimeout(t);
    }
  }, [round, answered]);

  // เคลียร์เอฟเฟกต์อัตโนมัติ
  useEffect(() => {
    if (!screenFx) return;
    const t = setTimeout(() => setScreenFx(null), 650);
    return () => clearTimeout(t);
  }, [screenFx, fxKey]);

  // -------------------------------------------------------------------
  // advance หลังตอบ
  // -------------------------------------------------------------------
  useEffect(() => {
    if (!answered || phase !== 'playing') return;
    const t = setTimeout(() => {
      if (round?.type === 'word' && round.subStage === 'pinyin') {
        const c = buildChoices('th', round.card);
        setAnswered(false);
        setSelected('');
        setRevealAnswer('');
        setLastCorrect(false);
        setTimedOut(false);
        setTimer(answerTime);
        setRound(r => ({ ...r, subStage: 'meaning', choices: c.choices, correctAnswer: c.correctAnswer }));
      } else {
        setRound(null); // trigger nextRound
      }
    }, FEEDBACK_MS);
    return () => clearTimeout(t);
  }, [answered, phase, round, answerTime, buildChoices]);

  // -------------------------------------------------------------------
  // timer
  // -------------------------------------------------------------------
  useEffect(() => {
    if (phase !== 'playing' || !round || answered) return;
    if (timer <= 0) {
      setTimedOut(true);
      setRevealAnswer(round.type === 'rearrange' ? round.tokensOrder.join(' ') : round.correctAnswer);
      resolveAnswer(false, '');
      return;
    }
    const id = setInterval(() => setTimer(t => t - 1), 1000);
    return () => clearInterval(id);
  }, [phase, round, answered, timer, resolveAnswer]);

  // -------------------------------------------------------------------
  // ใช้ไอเทม
  // -------------------------------------------------------------------
  const activateItem = async (slot) => {
    if (!slot || slot.quantity <= 0 || phase !== 'playing') return;
    if (slot.effect_type === 'heal') {
      setPlayerHp(p => Math.min(maxHp, p + (slot.effect_value || 1)));
    } else if (slot.effect_type === 'shield') {
      setShield(true);
    } else if (slot.effect_type === 'add_attack') {
      setAttack(a => a + (slot.effect_value || 1));
    } else if (slot.effect_type === 'add_hp') {
      setMaxHp(m => m + (slot.effect_value || 1));
      setPlayerHp(p => p + (slot.effect_value || 1));
    } else if (slot.effect_type === 'add_time') {
      // นาฬิกาทราย: เพิ่มเวลาตอบของข้อปัจจุบัน
      setTimer(t => t + (slot.effect_value || 5));
    } else if (slot.effect_type === 'bomb') {
      // ระเบิดพลัง: สร้างความเสียหายให้ศัตรูทันทีโดยไม่ต้องตอบ
      const dmg = slot.effect_value || 5;
      playSfx(sfxRef.current.player_attack || sfxRef.current.hit);
      triggerFx('good');
      setEnemyHurt(true);
      setTimeout(() => setEnemyHurt(false), 350);
      const newHp = enemyHp - dmg;
      if (newHp <= 0) {
        const enemy = enemyQueue[enemyIdx];
        awardExp(enemy?.isBoss ? EXP_PER_BOSS : EXP_PER_MONSTER);
        if (enemy?.isBoss) {
          levelUp(1).then((updated) => {
            if (updated) {
              setLeveledUpTo(updated.level);
              if (onLevelUp) onLevelUp(updated);
            }
          });
        }
        if (enemyIdx + 1 >= enemyQueue.length) {
          playSfx(sfxRef.current.win);
          stopBgm();
          setEnemyHp(0);
          awardClearBonus(enemyQueue); // เคลียร์สำเร็จครั้งแรก → เติม EXP ให้ครบเต็มด่าน
          const correct = correctRef.current;
          const total = correct + wrongRef.current;
          const medal = computeMedal(correct, total);
          setResultStats({ correct, total, medal });
          if (onStageComplete) onStageComplete(stageNo, { correct, total, medal, difficulty });
          setPhase('won');
        } else {
          const ni = enemyIdx + 1;
          setEnemyHp(0);
          setTimeout(() => {
            setEnemyIdx(ni);
            setEnemyHp(enemyQueue[ni].hp);
          }, 450);
        }
      } else {
        setEnemyHp(newHp);
      }
    }
    playSfx(sfxRef.current.item);
    await consumeItem(user.id, slot.item_id);
    setItems(prev => prev.map(it => it.item_id === slot.item_id ? { ...it, quantity: it.quantity - 1 } : it));
  };

  // -------------------------------------------------------------------
  // render
  // -------------------------------------------------------------------
  // backdrop ฉากใช้ร่วมกันทุกสถานะ (เต็มหน้าจอ)
  const sceneStyle = {
    backgroundImage: bgUrl ? `url(${bgUrl})` : 'linear-gradient(135deg,#1e293b,#334155)',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  };

  if (phase === 'loading') {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900 text-slate-300 font-black italic">
        กำลังเข้าสู่สนามรบ...
      </div>
    );
  }

  if (phase === 'empty') {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 px-6 text-center bg-slate-900">
        <div className="text-5xl">🚫</div>
        <p className="text-slate-200 font-bold max-w-sm">{errorMsg}</p>
        <button onClick={onExit} className="bg-orange-500 text-white px-8 py-3 rounded-2xl font-black uppercase italic shadow-lg active:scale-95">กลับ</button>
      </div>
    );
  }

  if (phase === 'won' || phase === 'lost') {
    const won = phase === 'won';
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-5 px-6 text-center" style={sceneStyle}>
        <div className="absolute inset-0 bg-black/70" />
        <div className="relative flex flex-col items-center gap-5">
          <div className="text-7xl drop-shadow-lg">{won ? '🏆' : '💀'}</div>
          <h2 className={`text-4xl font-black uppercase italic drop-shadow ${won ? 'text-emerald-400' : 'text-red-400'}`}>
            {won ? 'ชนะแล้ว!' : 'Game Over'}
          </h2>
          {won && leveledUpTo != null && (
            <div className="bg-gradient-to-r from-orange-400 to-orange-600 border-2 border-orange-200 rounded-2xl px-6 py-3 shadow-lg">
              <div className="text-xs font-black text-orange-100 uppercase">Level Up!</div>
              <div className="text-2xl font-black text-white italic">⭐ LV.{leveledUpTo}</div>
            </div>
          )}
          {won && resultStats && (
            <div className="bg-white/95 border-2 border-slate-200 rounded-2xl px-6 py-4 flex flex-col items-center gap-2">
              {resultStats.medal && (
                <>
                  <RewardIcon
                    type={getDifficultyRewardType(difficulty)}
                    tier={resultStats.medal}
                    earned={true}
                    className="w-16 h-16"
                  />
                  <div className="text-lg font-black text-slate-700 italic">
                    {getDifficultyRewardLabel(difficulty)}{resultStats.medal === 'gold' ? 'ทอง' : resultStats.medal === 'silver' ? 'เงิน' : 'ทองแดง'}
                  </div>
                </>
              )}
              <div className="text-sm font-black text-emerald-600">
                ตอบถูก {resultStats.correct} / {resultStats.total} คำ
              </div>
            </div>
          )}
          <div className="bg-emerald-50/95 border-2 border-emerald-200 rounded-2xl px-6 py-4">
            <div className="text-xs font-black text-emerald-500 uppercase">EXP ที่ได้รับ{alreadyWon ? ' (เล่นซ้ำ)' : ''}</div>
            <div className="text-3xl font-black text-emerald-600 inline-flex items-center gap-2">⭐ {expEarned}</div>
          </div>
          <div className="flex flex-col gap-3 w-64 pt-1">
            {!won && (
              <button
                onClick={() => { setRound(null); setShield(false); setExpEarned(0); runExpAccRef.current = 0; runExpAwardedRef.current = 0; setLeveledUpTo(null); setResultStats(null); setPhase('loading'); setLoadKey(k => k + 1); }}
                className="bg-orange-500 text-white px-8 py-3 rounded-2xl font-black uppercase italic shadow-lg active:scale-95"
              >
                เริ่มด่านใหม่
              </button>
            )}
            <button onClick={onExit} className="bg-slate-700 text-white px-8 py-3 rounded-2xl font-black uppercase italic shadow-lg active:scale-95">
              กลับไปเลือกด่าน
            </button>
          </div>
        </div>
      </div>
    );
  }

  // playing
  const enemyHpPct = currentEnemy ? Math.max(0, (enemyHp / currentEnemy.maxHp) * 100) : 0;
  const isMeaning = round?.type === 'word' && round?.subStage === 'meaning';
  const showVocab = isMeaning && (round?.card?.vocabulary || round?.card?.pinyin_vocab);

  // กรอบโปร่งใสสำหรับตัวหนังสือคำถาม
  const wordFrame = 'rounded-2xl bg-white/10 backdrop-blur-[2px] border border-white/25 shadow-[0_6px_16px_rgba(0,0,0,0.4)] px-4 py-3 flex flex-col items-center justify-center';

  return (
    <div
      className="fixed inset-0 z-[100] select-none overflow-hidden"
      style={{ ...sceneStyle, userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none' }}
      onDragStart={(e) => e.preventDefault()}
    >
      <style>{`
        @keyframes battleShake {0%,100%{transform:translateX(0)}15%{transform:translateX(-11px)}30%{transform:translateX(11px)}45%{transform:translateX(-8px)}60%{transform:translateX(8px)}80%{transform:translateX(-5px)}}
        @keyframes battleFlashBad {0%{opacity:.72}35%{opacity:.42}100%{opacity:0}}
        @keyframes battleVignetteRed {0%{opacity:.85}100%{opacity:0}}
        @keyframes battlePop {0%{transform:translate(-50%,10px) scale(.5);opacity:0}25%{opacity:1}100%{transform:translate(-50%,-70px) scale(1.25);opacity:0}}
        @keyframes swordSlashMark {0%{transform:translate(-50%,-50%) rotate(var(--slash-angle, -38deg)) scaleX(0);opacity:0}18%{opacity:1}42%{transform:translate(-50%,-50%) rotate(var(--slash-angle, -38deg)) scaleX(1);opacity:1}100%{transform:translate(-50%,-50%) rotate(var(--slash-angle, -38deg)) scaleX(1.08);opacity:0}}
        @keyframes swordSlashGlow {0%{transform:translate(-50%,-50%) rotate(var(--slash-angle, -38deg)) scaleX(0);opacity:0}22%{opacity:.55}48%{transform:translate(-50%,-50%) rotate(var(--slash-angle, -38deg)) scaleX(1);opacity:.45}100%{opacity:0}}
        @keyframes hitSpark {0%{opacity:.75;transform:scale(.35)}100%{opacity:0;transform:scale(1.35)}}
        @keyframes bloodSplatter {0%{transform:scale(0) translate(0,0);opacity:0}22%{opacity:.95;transform:scale(1) translate(0,0)}100%{transform:scale(var(--blood-scale,1.35)) translate(var(--tx,0), var(--ty,0));opacity:0}}
        @keyframes enemyFloat {0%,100%{transform:translateY(0) rotate(0deg)}25%{transform:translateY(-7px) rotate(-1.2deg)}50%{transform:translateY(-12px) rotate(0deg)}75%{transform:translateY(-7px) rotate(1.2deg)}}
      `}</style>

      {/* ฟิล์มมืดให้อ่านตัวหนังสือง่ายขึ้น */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/75 pointer-events-none" />

      {/* ตอบผิด / โดนโจมตี: หน้าจอกระพริบแดง + vignette */}
      {screenFx === 'bad' && (
        <>
          <div
            key={`flash-bad-${fxKey}`}
            className="absolute inset-0 pointer-events-none z-[105] bg-red-600 mix-blend-screen"
            style={{ animation: 'battleFlashBad .58s ease-out forwards' }}
          />
          <div
            key={`vignette-bad-${fxKey}`}
            className="absolute inset-0 pointer-events-none z-[105]"
            style={{
              background: 'radial-gradient(circle at center, transparent 24%, rgba(127,29,29,0.72) 100%)',
              animation: 'battleVignetteRed .58s ease-out forwards',
            }}
          />
          <div key={`blood-layer-${fxKey}`} className="absolute inset-0 pointer-events-none z-[106] overflow-hidden">
            {[
              { x: '46%', y: '22%', size: '1.35rem', tx: '-18px', ty: '14px', delay: '0s', color: '#dc2626' },
              { x: '54%', y: '26%', size: '1rem', tx: '22px', ty: '10px', delay: '0.04s', color: '#b91c1c' },
              { x: '42%', y: '30%', size: '0.85rem', tx: '-26px', ty: '-8px', delay: '0.02s', color: '#991b1b' },
              { x: '58%', y: '28%', size: '1.1rem', tx: '28px', ty: '-12px', delay: '0.06s', color: '#ef4444' },
              { x: '50%', y: '34%', size: '1.5rem', tx: '4px', ty: '20px', delay: '0.01s', color: '#dc2626', scale: '1.6' },
              { x: '38%', y: '24%', size: '0.75rem', tx: '-32px', ty: '6px', delay: '0.05s', color: '#7f1d1d' },
              { x: '62%', y: '32%', size: '0.9rem', tx: '30px', ty: '16px', delay: '0.03s', color: '#b91c1c' },
              { x: '48%', y: '18%', size: '0.7rem', tx: '-8px', ty: '-18px', delay: '0.07s', color: '#ef4444' },
            ].map((drop, i) => (
              <div
                key={`blood-${fxKey}-${i}`}
                className="absolute rounded-full"
                style={{
                  left: drop.x,
                  top: drop.y,
                  width: drop.size,
                  height: drop.size,
                  background: `radial-gradient(circle at 35% 35%, ${drop.color} 0%, rgba(127,29,29,0.85) 55%, transparent 72%)`,
                  boxShadow: `0 0 8px rgba(220,38,38,0.55)`,
                  animation: 'bloodSplatter .62s ease-out forwards',
                  animationDelay: drop.delay,
                  ['--tx']: drop.tx,
                  ['--ty']: drop.ty,
                  ['--blood-scale']: drop.scale || '1.35',
                }}
              />
            ))}
          </div>
        </>
      )}

      {/* กันด้วยโล่ */}
      {screenFx === 'block' && (
        <div
          key={`flash-block-${fxKey}`}
          className="absolute inset-0 pointer-events-none bg-sky-400"
          style={{ animation: 'battleFlashBad .45s ease-out forwards', opacity: 0.35 }}
        />
      )}

      {/* คอนเทนต์เต็มความสูง จัดเป็นคอลัมน์ */}
      <div
        className="relative h-full flex flex-col max-w-md mx-auto px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]"
        style={{ animation: screenFx === 'bad' ? 'battleShake .42s ease-in-out' : undefined }}
      >
        {/* แถบบน: ออก / เวลา */}
        <div className="flex items-center justify-between mb-2 shrink-0">
          <button onClick={() => { stopBgm(); onExit(); }} className="text-white bg-slate-900/70 backdrop-blur px-3 py-1.5 rounded-full font-black text-[11px] uppercase italic shadow active:scale-95">ออก</button>
          <div className={`text-2xl font-black italic drop-shadow ${timer <= 3 ? 'text-red-400 animate-pulse' : 'text-white'}`}>{timer}s</div>
        </div>

        {/* หลอด HP ผู้เล่น (เขียว) */}
        <div className="flex items-center gap-2 mb-1.5 shrink-0">
          <span className="w-9 h-9 flex items-center justify-center text-2xl leading-none drop-shadow shrink-0" aria-hidden="true">
            {shield ? '🛡️' : '❤️'}
          </span>
          <div className={`relative flex-1 h-5 bg-black/55 rounded-full overflow-hidden border border-emerald-400/40 ${playerHurt ? 'animate-pulse' : ''}`}>
            <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-300" style={{ width: `${maxHp ? (Math.max(0, playerHp) / maxHp) * 100 : 0}%` }} />
          </div>
          <span className="text-sm font-black text-white drop-shadow shrink-0 tabular-nums">{Math.max(0, playerHp)}/{maxHp}</span>
        </div>

        {/* หลอด HP ศัตรู (แดง) */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="w-9 h-9 flex items-center justify-center text-2xl leading-none drop-shadow shrink-0">{currentEnemy?.isBoss ? '👑' : '👾'}</span>
          <div className="relative flex-1 h-4 bg-black/45 rounded-full overflow-hidden border border-white/20">
            <div className="h-full bg-gradient-to-r from-red-600 to-red-400 transition-all duration-300" style={{ width: `${enemyHpPct}%` }} />
          </div>
        </div>

        {/* จำนวนศัตรูคงเหลือ — ตัวใหญ่ ใต้หลอด HP ศัตรู */}
        <div className="text-center shrink-0 mt-0.5">
          {currentEnemy?.isBoss ? (
            <span className="text-lg font-black text-amber-300 italic drop-shadow">👑 BOSS</span>
          ) : (
            <span className="text-2xl font-black text-red-300 drop-shadow">{Math.max(0, enemyQueue.length - enemyIdx)}</span>
          )}
        </div>

        {/* มอนสเตอร์: ตรึงตำแหน่งไว้ด้านบน (ไม่ขยับตามชนิดโจทย์) + เงาที่พื้น */}
        <div className="flex-1 min-h-0 flex flex-col items-center justify-start relative pt-[1vh]">
          <div className="relative flex flex-col items-center" style={{ animation: 'enemyFloat 3.2s ease-in-out infinite' }}>
            {/* วงแสงหลังศัตรู — แยกตัวละครออกจากโทนฉากมืด */}
            <div
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[42%] w-[min(92vw,18rem)] h-[min(54vh,15rem)] rounded-[50%] pointer-events-none -z-10"
              style={{
                background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.28) 0%, rgba(255,230,180,0.12) 32%, rgba(0,0,0,0) 72%)',
              }}
            />
            <div
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[42%] w-[min(72vw,13rem)] h-[min(40vh,10rem)] rounded-[50%] pointer-events-none -z-10 border border-white/10"
              style={{
                background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.08) 0%, transparent 68%)',
                boxShadow: '0 0 36px rgba(255,255,255,0.12), inset 0 0 24px rgba(255,255,255,0.06)',
              }}
            />

            {currentEnemy?.image_url ? (
              <img
                src={currentEnemy.image_url}
                alt={currentEnemy.name || 'enemy'}
                className={`relative z-10 max-h-[42vh] w-auto object-contain transition-transform duration-200 ${enemyHurt ? 'translate-x-2 -rotate-3' : ''}`}
                style={{
                  filter: enemyHurt
                    ? 'brightness(1.22) contrast(1.12) saturate(1.18) drop-shadow(0 0 12px rgba(255,255,255,0.5)) drop-shadow(0 0 24px rgba(251,191,36,0.35)) drop-shadow(0 16px 24px rgba(0,0,0,0.8))'
                    : 'brightness(1.12) contrast(1.1) saturate(1.15) drop-shadow(0 0 10px rgba(255,255,255,0.38)) drop-shadow(0 0 20px rgba(0,0,0,0.55)) drop-shadow(0 16px 24px rgba(0,0,0,0.75))',
                }}
              />
            ) : (
              <div
                className={`relative z-10 text-[7rem] leading-none transition-transform ${enemyHurt ? 'scale-90 -rotate-6' : ''}`}
                style={{
                  filter: enemyHurt
                    ? 'brightness(1.2) drop-shadow(0 0 12px rgba(255,255,255,0.55)) drop-shadow(0 0 24px rgba(251,191,36,0.35)) drop-shadow(0 16px 24px rgba(0,0,0,0.8))'
                    : 'brightness(1.08) drop-shadow(0 0 10px rgba(255,255,255,0.4)) drop-shadow(0 0 20px rgba(0,0,0,0.55)) drop-shadow(0 16px 24px rgba(0,0,0,0.75))',
                }}
              >
                {currentEnemy?.isBoss ? '👹' : '👾'}
              </div>
            )}
            {/* เอฟเฟกต์รอยดาบฟันตอนตอบถูก */}
            {screenFx === 'good' && (
              <>
                <div
                  key={`spark-${fxKey}`}
                  className="absolute top-[42%] left-1/2 -translate-x-1/2 w-40 h-40 rounded-full pointer-events-none z-20 bg-white/30 blur-2xl"
                  style={{ animation: 'hitSpark .38s ease-out forwards' }}
                />
                <div
                  key={`slash-glow-a-${fxKey}`}
                  className="absolute top-1/2 left-1/2 pointer-events-none z-20 w-[min(78vw,15rem)] h-3 rounded-full origin-center"
                  style={{
                    ['--slash-angle']: '-38deg',
                    background: 'linear-gradient(90deg, transparent, rgba(186,230,253,0.55) 40%, rgba(255,255,255,0.35) 55%, transparent)',
                    filter: 'blur(3px)',
                    animation: 'swordSlashGlow .48s ease-out forwards',
                  }}
                />
                <div
                  key={`slash-glow-b-${fxKey}`}
                  className="absolute top-1/2 left-1/2 pointer-events-none z-20 w-[min(68vw,13rem)] h-3 rounded-full origin-center"
                  style={{
                    ['--slash-angle']: '28deg',
                    background: 'linear-gradient(90deg, transparent, rgba(186,230,253,0.45) 40%, rgba(255,255,255,0.28) 55%, transparent)',
                    filter: 'blur(3px)',
                    animation: 'swordSlashGlow .48s ease-out forwards',
                    animationDelay: '0.04s',
                  }}
                />
                <div
                  key={`slash-a-${fxKey}`}
                  className="absolute top-1/2 left-1/2 pointer-events-none z-[21] w-[min(72vw,14rem)] h-[4px] rounded-full origin-center"
                  style={{
                    ['--slash-angle']: '-38deg',
                    background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 12%, #ffffff 42%, #e0f2fe 52%, rgba(255,255,255,0.2) 68%, transparent 100%)',
                    boxShadow: '0 0 10px rgba(255,255,255,0.95), 0 0 22px rgba(147,197,253,0.75), 0 0 34px rgba(56,189,248,0.45)',
                    animation: 'swordSlashMark .46s ease-out forwards',
                  }}
                />
                <div
                  key={`slash-b-${fxKey}`}
                  className="absolute top-1/2 left-1/2 pointer-events-none z-[21] w-[min(62vw,12rem)] h-[3px] rounded-full origin-center"
                  style={{
                    ['--slash-angle']: '28deg',
                    background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.12) 14%, #f8fafc 45%, #dbeafe 55%, rgba(255,255,255,0.15) 70%, transparent 100%)',
                    boxShadow: '0 0 8px rgba(255,255,255,0.85), 0 0 18px rgba(147,197,253,0.6)',
                    animation: 'swordSlashMark .46s ease-out forwards',
                    animationDelay: '0.05s',
                  }}
                />
              </>
            )}
            {/* ตัวเลขดาเมจลอยขึ้น */}
            {screenFx === 'good' && (
              <span key={`dmg-${fxKey}`} className="absolute top-1/4 left-1/2 text-3xl font-black text-yellow-300 pointer-events-none drop-shadow-[0_2px_3px_rgba(0,0,0,0.8)]" style={{ animation: 'battlePop .7s ease-out forwards' }}>-{attack}</span>
            )}
            {screenFx === 'block' && (
              <span key={`blk-${fxKey}`} className="absolute top-1/4 left-1/2 text-5xl pointer-events-none" style={{ animation: 'battlePop .7s ease-out forwards' }}>🛡️</span>
            )}
          </div>
          {/* เงาที่พื้น — ช่วยยึดตำแหน่งศัตรูให้แยกจากฉาก */}
          <div
            className="relative z-0 w-44 h-5 -mt-2 rounded-[50%] blur-md"
            style={{ background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.28) 55%, transparent 78%)' }}
          />
        </div>

        {/* ส่วนล่าง: คำถาม (ไม่มีการ์ดพื้นหลัง) + ไอเทม */}
        <div className="relative z-10 flex gap-2 items-end shrink-0">
          {/* คำถาม — ลอยบนฉาก ชิดด้านล่าง */}
          <div className="flex-1 min-w-0">

            {round?.type === 'rearrange' ? (
              <>
                <div className="text-center mb-2 rounded-2xl bg-black/35 backdrop-blur-[2px] border border-white/25 px-3 py-2.5 -mt-[39vh] -mr-16">
                  <p
                    className="text-white font-black leading-tight drop-shadow-[0_2px_5px_rgba(0,0,0,0.95)]"
                    style={{ fontSize: 'clamp(1.6rem, 7vw, 2.75rem)' }}
                  >
                    {round.card?.translate || '—'}
                  </p>
                </div>
                {/* ช่องประโยคที่ประกอบ (แตะคำเพื่อถอนออก) */}
                <div className={`min-h-[3.25rem] rounded-2xl border-2 p-2 mb-2 -mr-16 flex flex-wrap gap-1.5 items-center justify-center transition-colors ${answered ? (lastCorrect ? 'bg-emerald-500/20 border-emerald-400' : 'bg-red-500/20 border-red-400') : 'bg-black/30 backdrop-blur-[2px] border-dashed border-white/40'}`}>
                  {assembled.length === 0 ? (
                    <span className="text-white/50 text-sm italic">แตะคำด้านล่างเพื่อเรียงประโยค</span>
                  ) : assembled.map((id, i) => (
                    <button
                      key={`${id}-${i}`}
                      onClick={() => removeAt(i)}
                      disabled={answered}
                      className="bg-gradient-to-b from-violet-500 to-violet-700 text-white px-2.5 py-1 rounded-lg font-black text-xl border-b-2 border-violet-900 active:translate-y-0.5"
                    >
                      {tokens.find(t => t.id === id)?.text}
                    </button>
                  ))}
                </div>
                {/* แถบควบคุม: ลบ / รีเซ็ต / ส่งคำตอบ */}
                {!answered && (
                  <div className="flex items-center gap-2 mb-2">
                    <button
                      onClick={backspaceToken}
                      disabled={assembled.length === 0}
                      className="flex items-center justify-center gap-1 px-3 py-2 rounded-xl bg-white/90 border-2 border-b-4 border-slate-400 text-slate-700 font-black active:translate-y-0.5 disabled:opacity-40"
                      title="ลบคำตัวสุดท้าย"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"/><line x1="18" y1="9" x2="12" y2="15"/><line x1="12" y1="9" x2="18" y2="15"/></svg>
                    </button>
                    <button
                      onClick={resetAssembled}
                      disabled={assembled.length === 0}
                      className="flex items-center justify-center px-3 py-2 rounded-xl bg-white/90 border-2 border-b-4 border-slate-400 text-slate-700 font-black active:translate-y-0.5 disabled:opacity-40"
                      title="ล้างทั้งหมด"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                    </button>
                    <button
                      onClick={submitRearrange}
                      disabled={assembled.length === 0}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-b from-emerald-400 to-emerald-600 border-2 border-b-4 border-emerald-800 text-white font-black text-lg active:translate-y-0.5 disabled:opacity-40"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      ส่งคำตอบ
                    </button>
                  </div>
                )}
                {/* token ในคลัง — แตะเพื่อเพิ่ม */}
                <div className="flex flex-wrap gap-2 justify-center">
                  {tokens.map(tk => {
                    const used = assembled.includes(tk.id);
                    return (
                      <button
                        key={tk.id}
                        onClick={() => tapToken(tk)}
                        disabled={used || answered}
                        className={`px-3.5 py-2 rounded-xl font-black text-xl border-2 border-b-4 transition-all active:translate-y-0.5 active:border-b-2 ${used ? 'opacity-25 bg-slate-200 border-slate-300' : 'bg-gradient-to-b from-white to-violet-100 border-violet-400 text-slate-800 shadow-md'}`}
                      >
                        {tk.text}
                      </button>
                    );
                  })}
                </div>
              </>
            ) : round?.type === 'typing' ? (
              <>
                {/* คำศัพท์จีน — จัดกึ่งกลาง ขนาดเท่าโจทย์คำแปล ไม่มี pinyin */}
                <div className="flex items-center justify-center mb-3 -mr-16 -mt-[30vh]">
                  <div className={`${wordFrame} flex-1 min-w-0`}>
                    <span className="font-black text-white leading-none drop-shadow-[0_3px_6px_rgba(0,0,0,0.9)] whitespace-nowrap" style={{ fontSize: 'clamp(2.5rem, 14vw, 4rem)' }}>{round?.card?.vocabulary || '-'}</span>
                  </div>
                </div>
                {showSpeaker && (
                  <div className="flex justify-center mb-2 -mt-1">
                    <SpeakerButton text={round?.card?.vocabulary} label="ฟังเสียง" className="w-9 h-9" />
                  </div>
                )}
                {/* กล่องพิมพ์ + ปุ่มส่งคำตอบด้านขวา (สัดส่วน 4:1) */}
                <div className="flex items-stretch gap-2 mb-2">
                  <input
                    ref={typingInputRef}
                    type="text"
                    lang="zh-CN"
                    inputMode="text"
                    enterKeyHint="done"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    value={typed}
                    disabled={answered}
                    onChange={(e) => setTyped(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submitTyping(); } }}
                    placeholder="พิมพ์คำศัพท์ภาษาจีน"
                    className={`flex-[4] min-w-0 rounded-2xl border-2 border-b-4 px-4 py-3 text-3xl font-black text-center outline-none transition-colors ${answered ? (lastCorrect ? 'bg-emerald-500/25 border-emerald-400 text-white' : 'bg-red-500/25 border-red-400 text-white') : 'bg-white/95 border-slate-400 text-slate-800 placeholder:text-base placeholder:font-bold placeholder:text-slate-400'}`}
                  />
                  {!answered && (
                    <button
                      onClick={submitTyping}
                      disabled={!typed.trim()}
                      className="flex-1 min-w-0 flex items-center justify-center px-1 rounded-2xl bg-gradient-to-b from-emerald-400 to-emerald-600 border-2 border-b-4 border-emerald-800 text-white font-black active:translate-y-0.5 disabled:opacity-40"
                      aria-label="ส่งคำตอบ"
                    >
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    </button>
                  )}
                </div>
                {answered && !lastCorrect && (
                  <div className="text-center text-emerald-200 font-black text-2xl mb-2 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                    เฉลย: {round?.correctAnswer}
                  </div>
                )}
              </>
            ) : (
              <>
                {/* คำจีน (+ คำศัพท์) จัดซ้าย-ขวา ตัวใหญ่ๆ — กล่องขวายืดสุดขอบขวาของจอ */}
                <div className={`flex items-stretch justify-center gap-3 mb-3 ${showVocab ? '-mr-16' : ''}`}>
                  <div className={`${wordFrame} ${showVocab ? 'shrink-0' : ''}`}>
                    <span className="font-black text-white leading-none drop-shadow-[0_3px_6px_rgba(0,0,0,0.9)]" style={{ fontSize: showVocab ? 'clamp(2.5rem, 14vw, 4rem)' : 'clamp(3.5rem, 22vw, 6rem)' }}>{round?.card?.cn || '-'}</span>
                  </div>
                  {showVocab && (
                    <div className={`${wordFrame} flex-1 min-w-0`}>
                      <span className="font-black text-white leading-none drop-shadow-[0_3px_6px_rgba(0,0,0,0.9)] whitespace-nowrap" style={{ fontSize: 'clamp(2.5rem, 14vw, 4rem)' }}>{round.card.vocabulary || '-'}</span>
                    </div>
                  )}
                </div>
                {showSpeaker && (
                  <div className="flex justify-center mb-2 -mt-1">
                    <SpeakerButton text={isMeaning ? (round?.card?.vocabulary || round?.card?.cn) : round?.card?.cn} label="ฟังเสียง" className="w-9 h-9" />
                  </div>
                )}
                {/* ปุ่มคำตอบสไตล์เกม (ไม่มีเลข 1-4) */}
                <div className="grid grid-cols-1 gap-2">
                  {(round?.choices || []).map((choice, i) => {
                    const isCorrectChoice = norm(round.correctAnswer) === norm(choice);
                    const isSel = selected === norm(choice);
                    const showCorrect = answered && isCorrectChoice;
                    const showWrong = answered && isSel && !lastCorrect;
                    const colorCls = showCorrect
                      ? 'bg-gradient-to-b from-emerald-400 to-emerald-600 border-emerald-800 text-white ring-emerald-200/60'
                      : showWrong
                      ? 'bg-gradient-to-b from-red-400 to-red-600 border-red-800 text-white ring-red-200/60'
                      : 'bg-gradient-to-b from-white to-slate-200 border-slate-400 text-slate-800 ring-white/70';
                    return (
                      <button
                        key={`${i}-${choice}`}
                        onClick={() => handleChoice(choice)}
                        disabled={answered}
                        className={`relative w-full rounded-2xl border-2 border-b-4 px-4 py-2.5 font-black text-lg text-center shadow-[0_4px_10px_rgba(0,0,0,0.45)] ring-1 ring-inset transition-all active:translate-y-1 active:border-b-2 disabled:active:translate-y-0 ${colorCls}`}
                      >
                        {choice}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* ช่องไอเทม 3 ช่อง ด้านขวา */}
          <div className="flex flex-col gap-2 w-14 shrink-0">
            {Array.from({ length: 3 }).map((_, i) => {
              const slot = items[i];
              const usable = slot && slot.quantity > 0;
              return (
                <button
                  key={i}
                  onClick={() => usable && activateItem(slot)}
                  disabled={!usable}
                  className={`w-14 h-14 rounded-2xl border-2 flex flex-col items-center justify-center ${usable ? 'bg-white/95 border-orange-300 shadow-lg active:scale-95' : 'bg-white/20 backdrop-blur border-dashed border-white/40'}`}
                  title={slot?.name || 'ว่าง'}
                >
                  {usable ? (
                    <>
                      {slot.icon_url
                        ? <img src={slot.icon_url} alt={slot.name} className="w-7 h-7 object-contain" />
                        : <span className="text-2xl">{slot.effect_type === 'heal' ? '❤️' : slot.effect_type === 'shield' ? '🛡️' : slot.effect_type === 'add_time' ? '⏳' : slot.effect_type === 'bomb' ? '💣' : '⚡'}</span>}
                      <span className="text-[9px] font-black text-slate-500">x{slot.quantity}</span>
                    </>
                  ) : (
                    <span className="text-white/50 text-xl">+</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
