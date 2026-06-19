import React, { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';
import SpeakerButton from './SpeakerButton';
import CoinIcon from './CoinIcon';
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
} from '../utils/gameStorage';
import { playBgm, stopBgm, playSfx } from '../utils/gameAudio';

const COIN_PER_MONSTER = 5;
const COIN_PER_BOSS = 25;
const FEEDBACK_MS = 1200;
// ทุกๆ 6 โจทย์ (pinyin/แปลไทย) จะแทรกโจทย์เรียงคำ 1 โจทย์
const REARRANGE_EVERY = 6;
// ทุกๆ 4 โจทย์ (pinyin/แปลไทย) จะแทรกโจทย์ฝึกพิมพ์ 1 โจทย์
const TYPING_EVERY = 4;

const norm = (v) => String(v || '').trim();
const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);

export default function BattleGame({ user, stageNo, selectedCharacterId = null, equippedItemIds = [], allMasterCards = [], onExit, onReward, onLevelUp }) {
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
  const wordIdxRef = useRef(0);
  const qSinceRearrangeRef = useRef(0); // นับโจทย์ pinyin/แปลไทย ตั้งแต่เรียงคำครั้งล่าสุด
  const qSinceTypingRef = useRef(0); // นับโจทย์ pinyin/แปลไทย ตั้งแต่ฝึกพิมพ์ครั้งล่าสุด

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
  const [coinsEarned, setCoinsEarned] = useState(0);
  const [leveledUpTo, setLeveledUpTo] = useState(null); // เลเวลใหม่หลังฆ่า Boss
  const [screenFx, setScreenFx] = useState(null); // 'good' | 'bad' | 'block'
  const [fxKey, setFxKey] = useState(0);

  const triggerFx = useCallback((kind) => {
    setScreenFx(kind);
    setFxKey(k => k + 1);
  }, []);

  const currentEnemy = enemyQueue[enemyIdx] || null;
  const answerTime = stage?.answer_time_sec || 8;
  const rearrangeTime = stage?.answer_time_rearrange_sec || 12;
  const showSpeaker = (stage?.source_level ?? 3) <= 2;

  // -------------------------------------------------------------------
  // build a 4-choice question from the master pool
  // -------------------------------------------------------------------
  const buildChoices = useCallback((field, card) => {
    const correct = norm(card?.[field]);
    if (!correct) return { choices: ['-', '-2', '-3', '-4'], correctAnswer: '' };
    const pool = allMasterCards.map(c => norm(c?.[field])).filter(Boolean);
    const uniq = [...new Set(pool)].filter(t => t !== correct);
    let distractors = shuffle(uniq).slice(0, 3);
    while (distractors.length < 3) distractors.push(`ตัวเลือก ${distractors.length + 1}`);
    return { choices: shuffle([correct, ...distractors]), correctAnswer: correct };
  }, [allMasterCards]);

  // ตัดเครื่องหมายวรรคตอนทิ้ง (ทั้งไทย/อังกฤษ/จีน)
  const stripPunct = (s) => String(s || '').replace(/[,.，。、；;：:!?！？""''「」『』（）()\[\]【】~～·\-—_]/g, '');

  // แบ่งประโยคเป็น token: ถ้ามีช่องว่าง → แบ่งตามช่องว่าง
  // ถ้าไม่มี (ภาษาจีน) → จับเป็นกลุ่มละ 2 ตัวอักษร จนเหลือเศษ 1 ตัวท้าย
  const sentenceTokens = (card) => {
    let raw = stripPunct(norm(card?.sentence_test)).replace(/\s+/g, ' ').trim();
    if (!raw) return [];
    if (raw.includes(' ')) return raw.split(/\s+/).filter(Boolean);

    const chars = Array.from(raw);
    const groups = [];
    for (let i = 0; i < chars.length; i += 2) {
      groups.push(chars.slice(i, i + 2).join(''));
    }
    return groups;
  };

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

    // ครบ 4 โจทย์ (pinyin/แปลไทย) แล้ว → แทรกโจทย์ฝึกพิมพ์ 1 โจทย์
    if (qSinceTypingRef.current >= TYPING_EVERY) {
      // หา card ที่มีคำศัพท์ (vocabulary) — ฝึกพิมพ์เฉพาะคำศัพท์ ไม่ใช่ตัวอักษรเดี่ยว
      for (let k = 0; k < words.length; k++) {
        const idx = (wordIdxRef.current + k) % words.length;
        const vocab = norm(words[idx]?.vocabulary);
        if (vocab) {
          wordIdxRef.current = idx + 1;
          qSinceTypingRef.current = 0;
          setTimer(rearrangeTime);
          setRound({ type: 'typing', card: words[idx], correct: vocab, correctAnswer: vocab });
          return;
        }
      }
      // ไม่พบ card ที่มีคำศัพท์ → เล่นแบบเลือกตอบต่อไป (คงตัวนับไว้)
    }

    // ครบ 6 โจทย์ (pinyin/แปลไทย) แล้ว → แทรกโจทย์เรียงคำ 1 โจทย์
    if (qSinceRearrangeRef.current >= REARRANGE_EVERY) {
      // หา card ที่เรียงประโยคได้ (มี token ตั้งแต่ 2 ขึ้นไป)
      for (let k = 0; k < words.length; k++) {
        const idx = (wordIdxRef.current + k) % words.length;
        const toks = sentenceTokens(words[idx]);
        if (toks.length >= 2) {
          wordIdxRef.current = idx + 1;
          qSinceRearrangeRef.current = 0;
          setTimer(rearrangeTime);
          const withIds = toks.map((t, i) => ({ id: `${i}-${t}`, text: t }));
          setTokens(shuffle(withIds));
          setAssembled([]);
          setRound({ type: 'rearrange', card: words[idx], correct: toks.join(''), tokensOrder: toks });
          return;
        }
      }
      // ไม่พบ card ที่เรียงประโยคได้ → เล่นแบบเลือกตอบต่อไป (คงตัวนับไว้)
    }

    // โจทย์แบบเลือกตอบ — เริ่มที่ pinyin
    if (wordIdxRef.current >= words.length) {
      wordsRef.current = shuffle(words);
      wordIdxRef.current = 0;
    }
    const card = wordsRef.current[wordIdxRef.current];
    wordIdxRef.current += 1;
    qSinceRearrangeRef.current += 1; // นับโจทย์ pinyin
    qSinceTypingRef.current += 1;
    setTimer(answerTime);
    const c = buildChoices('pinyin', card);
    setRound({ type: 'word', card, subStage: 'pinyin', choices: c.choices, correctAnswer: c.correctAnswer });
  }, [answerTime, rearrangeTime, buildChoices]);

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
          quantity: r.quantity,
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

        // สร้างคิวศัตรู: มอนสเตอร์ตาม monster_count แล้วตามด้วยบอส
        const monsters = cfg.enemies.filter(e => e.type === 'monster');
        const bosses = cfg.enemies.filter(e => e.type === 'boss');
        const queue = [];
        const count = cfg.stage.monster_count || 3;
        if (monsters.length > 0) {
          for (let i = 0; i < count; i++) {
            const m = monsters[i % monsters.length];
            queue.push({ ...m, maxHp: m.hp, isBoss: false });
          }
        }
        bosses.forEach(b => queue.push({ ...b, maxHp: b.hp, isBoss: true }));
        if (queue.length === 0) {
          // fallback ถ้า admin ยังไม่ตั้งศัตรู
          for (let i = 0; i < count; i++) queue.push({ name: 'มอนสเตอร์', image_url: null, hp: 3, maxHp: 3, attack: 1, isBoss: false });
          queue.push({ name: 'บอส', image_url: null, hp: 8, maxHp: 8, attack: 2, isBoss: true });
        }
        setEnemyQueue(queue);
        setEnemyIdx(0);
        setEnemyHp(queue[0].hp);

        // โหลดคำที่เลือกไว้ทั้งหมดจาก Select Study Words (ไม่กรองตาม level/wrong_count)
        // แล้วแบ่งให้แต่ละด่านตามลำดับการ์ด: ด่านละ (monster_count + 1) คำ
        const [{ data: progress }, allStages] = await Promise.all([
          supabase
            .from('user_progress')
            .select('flashcard_id')
            .eq('user_id', user.id),
          getStages(),
        ]);
        if (!alive) return;
        const selIds = new Set((progress || []).map(p => Number(p.flashcard_id)).filter(n => !isNaN(n)));
        // เรียงการ์ดที่เลือกตามลำดับ id (เหมือนหน้า Select Study Words)
        const orderedCards = allMasterCards
          .filter(c => selIds.has(Number(c.id1 || c.id)))
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
          setErrorMsg('ยังไม่มีคำศัพท์สำหรับด่านนี้ — ไปเลือกคำเพิ่มที่ Select Study Words');
          setPhase('empty');
          return;
        }
        wordsRef.current = shuffle(cards);
        wordIdxRef.current = 0;
        qSinceRearrangeRef.current = 0;
        qSinceTypingRef.current = 0;
        setPhase('playing');
      } catch (e) {
        console.error('BattleGame load error:', e);
        if (alive) { setErrorMsg('เกิดข้อผิดพลาดในการโหลดด่าน'); setPhase('empty'); }
      }
    })();
    return () => { alive = false; stopBgm(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageNo, user?.id, loadKey, selectedCharacterId]);

  // เริ่ม round แรกเมื่อพร้อมเล่น
  useEffect(() => {
    if (phase === 'playing' && !round) nextRound();
  }, [phase, round, nextRound]);

  // -------------------------------------------------------------------
  // combat resolution
  // -------------------------------------------------------------------
  const awardCoin = useCallback(async (amount) => {
    setCoinsEarned(c => c + amount);
    const updated = await addCurrency({ coin: amount });
    if (updated && onReward) onReward(updated);
  }, [onReward]);

  const resolveAnswer = useCallback((isCorrect, answerText = '') => {
    if (answered || phase !== 'playing') return;
    setAnswered(true);
    setLastCorrect(isCorrect);
    setSelected(answerText);

    if (isCorrect) {
      playSfx(sfxRef.current.player_attack || sfxRef.current.hit);
      triggerFx('good');
      setEnemyHurt(true);
      setTimeout(() => setEnemyHurt(false), 350);
      const newHp = enemyHp - attack;
      if (newHp <= 0) {
        const enemy = enemyQueue[enemyIdx];
        awardCoin(enemy?.isBoss ? COIN_PER_BOSS : COIN_PER_MONSTER);
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
  }, [answered, phase, attack, enemyHp, playerHp, enemyQueue, enemyIdx, shield, currentEnemy, awardCoin, triggerFx, onLevelUp]);

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
        qSinceRearrangeRef.current += 1; // นับโจทย์แปลไทย
        qSinceTypingRef.current += 1;
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
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900 text-slate-300 font-black italic">
        กำลังเข้าสู่สนามรบ...
      </div>
    );
  }

  if (phase === 'empty') {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 px-6 text-center bg-slate-900">
        <div className="text-5xl">🚫</div>
        <p className="text-slate-200 font-bold max-w-sm">{errorMsg}</p>
        <button onClick={onExit} className="bg-orange-500 text-white px-8 py-3 rounded-2xl font-black uppercase italic shadow-lg active:scale-95">กลับ</button>
      </div>
    );
  }

  if (phase === 'won' || phase === 'lost') {
    const won = phase === 'won';
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 px-6 text-center" style={sceneStyle}>
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
          <div className="bg-yellow-50/95 border-2 border-yellow-200 rounded-2xl px-6 py-4">
            <div className="text-xs font-black text-yellow-500 uppercase">Coin ที่ได้รับ</div>
            <div className="text-3xl font-black text-yellow-600 inline-flex items-center gap-2"><CoinIcon className="w-8 h-8" /> {coinsEarned}</div>
          </div>
          <div className="flex flex-col gap-3 w-64 pt-1">
            {!won && (
              <button
                onClick={() => { setRound(null); setShield(false); setCoinsEarned(0); setLeveledUpTo(null); setPhase('loading'); setLoadKey(k => k + 1); }}
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
      className="fixed inset-0 z-50 select-none overflow-hidden"
      style={{ ...sceneStyle, userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none' }}
      onDragStart={(e) => e.preventDefault()}
    >
      <style>{`
        @keyframes battleShake {0%,100%{transform:translateX(0)}15%{transform:translateX(-9px)}30%{transform:translateX(9px)}45%{transform:translateX(-7px)}60%{transform:translateX(7px)}80%{transform:translateX(-4px)}}
        @keyframes battleFlash {0%{opacity:.5}100%{opacity:0}}
        @keyframes battlePop {0%{transform:translate(-50%,10px) scale(.5);opacity:0}25%{opacity:1}100%{transform:translate(-50%,-70px) scale(1.25);opacity:0}}
        @keyframes battleSlash {0%{transform:translate(-50%,-50%) scale(.3) rotate(-35deg);opacity:0}30%{opacity:1}100%{transform:translate(-50%,-50%) scale(1.6) rotate(-35deg);opacity:0}}
        @keyframes enemyFloat {0%,100%{transform:translateY(0) rotate(0deg)}25%{transform:translateY(-7px) rotate(-1.2deg)}50%{transform:translateY(-12px) rotate(0deg)}75%{transform:translateY(-7px) rotate(1.2deg)}}
      `}</style>

      {/* ฟิล์มมืดให้อ่านตัวหนังสือง่ายขึ้น */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/75 pointer-events-none" />

      {/* แฟลชสีเต็มจอ: เขียว=ตอบถูก / แดง=โดนโจมตี / ฟ้า=กันด้วยโล่ */}
      {screenFx && (
        <div
          key={`flash-${fxKey}`}
          className={`absolute inset-0 pointer-events-none ${screenFx === 'good' ? 'bg-emerald-400' : screenFx === 'bad' ? 'bg-red-500' : 'bg-sky-400'}`}
          style={{ animation: 'battleFlash .6s ease-out forwards' }}
        />
      )}

      {/* คอนเทนต์เต็มความสูง จัดเป็นคอลัมน์ */}
      <div
        className="relative h-full flex flex-col max-w-md mx-auto px-3 pt-3 pb-4"
        style={{ animation: screenFx === 'bad' ? 'battleShake .42s ease-in-out' : undefined }}
      >
        {/* แถบบน: ออก / เวลา */}
        <div className="flex items-center justify-between mb-2 shrink-0">
          <button onClick={() => { stopBgm(); onExit(); }} className="text-white bg-slate-900/70 backdrop-blur px-3 py-1.5 rounded-full font-black text-[11px] uppercase italic shadow active:scale-95">ออก</button>
          <div className={`text-2xl font-black italic drop-shadow ${timer <= 3 ? 'text-red-400 animate-pulse' : 'text-white'}`}>{timer}s</div>
        </div>

        {/* หลอด HP ผู้เล่น (เขียว) + ไอเทมที่ใช้อยู่ (ไอคอนใหญ่หน้าหลอด) */}
        <div className="flex items-center gap-2 mb-1.5 shrink-0">
          <span className="w-9 h-9 flex items-center justify-center text-3xl leading-none drop-shadow shrink-0">{shield ? '🛡️' : ''}</span>
          <div className={`relative flex-1 h-4 bg-black/45 rounded-full overflow-hidden border border-white/20 ${playerHurt ? 'animate-pulse' : ''}`}>
            <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-300" style={{ width: `${maxHp ? (Math.max(0, playerHp) / maxHp) * 100 : 0}%` }} />
          </div>
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
            {currentEnemy?.image_url ? (
              <img
                src={currentEnemy.image_url}
                alt={currentEnemy.name || 'enemy'}
                className={`max-h-[42vh] w-auto object-contain transition-transform duration-200 ${enemyHurt ? 'translate-x-2 -rotate-3' : ''}`}
                style={{ filter: `drop-shadow(0 12px 18px rgba(0,0,0,0.55))${enemyHurt ? ' brightness(1.7)' : ''}` }}
              />
            ) : (
              <div className={`text-[7rem] leading-none transition-transform ${enemyHurt ? 'scale-90 -rotate-6' : ''}`} style={{ filter: 'drop-shadow(0 12px 18px rgba(0,0,0,0.55))' }}>{currentEnemy?.isBoss ? '👹' : '👾'}</div>
            )}
            {/* เอฟเฟกต์ฟันตอนตอบถูก */}
            {screenFx === 'good' && (
              <span key={`slash-${fxKey}`} className="absolute top-1/2 left-1/2 text-7xl pointer-events-none" style={{ animation: 'battleSlash .5s ease-out forwards' }}>⚔️</span>
            )}
            {/* ตัวเลขดาเมจลอยขึ้น */}
            {screenFx === 'good' && (
              <span key={`dmg-${fxKey}`} className="absolute top-1/4 left-1/2 text-3xl font-black text-yellow-300 pointer-events-none drop-shadow-[0_2px_3px_rgba(0,0,0,0.8)]" style={{ animation: 'battlePop .7s ease-out forwards' }}>-{attack}</span>
            )}
            {screenFx === 'block' && (
              <span key={`blk-${fxKey}`} className="absolute top-1/4 left-1/2 text-5xl pointer-events-none" style={{ animation: 'battlePop .7s ease-out forwards' }}>🛡️</span>
            )}
          </div>
          {/* เงาที่พื้นแทนกล่องสี่เหลี่ยม */}
          <div className="w-36 h-4 -mt-1 rounded-[50%] bg-black/55 blur-md" />
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
                {/* กล่องพิมพ์ + แป้นพิมพ์มือถือภาษาจีน */}
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
                  className={`w-full rounded-2xl border-2 border-b-4 px-4 py-3 text-3xl font-black text-center outline-none mb-2 transition-colors ${answered ? (lastCorrect ? 'bg-emerald-500/25 border-emerald-400 text-white' : 'bg-red-500/25 border-red-400 text-white') : 'bg-white/95 border-slate-400 text-slate-800 placeholder:text-base placeholder:font-bold placeholder:text-slate-400'}`}
                />
                {answered && !lastCorrect && (
                  <div className="text-center text-emerald-200 font-black text-2xl mb-2 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                    เฉลย: {round?.correctAnswer}
                  </div>
                )}
                {!answered && (
                  <button
                    onClick={submitTyping}
                    disabled={!typed.trim()}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-gradient-to-b from-emerald-400 to-emerald-600 border-2 border-b-4 border-emerald-800 text-white font-black text-lg active:translate-y-0.5 disabled:opacity-40"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    ส่งคำตอบ
                  </button>
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
                        : <span className="text-2xl">{slot.effect_type === 'heal' ? '❤️' : slot.effect_type === 'shield' ? '🛡️' : '⚡'}</span>}
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
