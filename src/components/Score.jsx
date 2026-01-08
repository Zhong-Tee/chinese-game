import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function Score({ user, selectedIds, levelCounts, setPage }) {
  const [personalStats, setPersonalStats] = useState({
    selectedWords: 0,
    level7Words: 0,
    currentTotalScore: 0,
    bestTotalScore: 0,
    bestScoresPerGame: {
      th: 0,
      pinyin: 0,
      vol: 0,
      type: 0
    },
    bestStreaksPerGame: {
      th: 0,
      pinyin: 0,
      vol: 0,
      type: 0
    },
    currentScoresPerGame: {
      th: 0,
      pinyin: 0,
      vol: 0,
      type: 0
    }
  });

  const [rankings, setRankings] = useState({
    overall: [],
    byGame: {
      th: [],
      pinyin: [],
      vol: [],
      type: []
    }
  });

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('personal');
  const [rankingGameType, setRankingGameType] = useState('overall');

  const fetchPersonalStats = async () => {
    if (!user?.id) return;

    try {
      const selectedWordsCount = selectedIds.length;
      const level7Count = levelCounts[7] || 0;

      const { data: scores, error } = await supabase
        .from('user_scores')
        .select('game_type, total_score, best_score, best_streak')
        .eq('user_id', user.id);

      if (error) {
        console.error('Error fetching scores:', error);
        return;
      }

      let currentTotalScore = 0;
      let bestTotalScore = 0;
      const bestScoresPerGame = { th: 0, pinyin: 0, vol: 0, type: 0 };
      const bestStreaksPerGame = { th: 0, pinyin: 0, vol: 0, type: 0 };
      const currentScoresPerGame = { th: 0, pinyin: 0, vol: 0, type: 0 };

      if (scores) {
        scores.forEach(score => {
          currentTotalScore += score.total_score || 0;
          bestTotalScore += score.best_score || 0;
          if (bestScoresPerGame.hasOwnProperty(score.game_type)) {
            bestScoresPerGame[score.game_type] = score.best_score || 0;
            bestStreaksPerGame[score.game_type] = score.best_streak || 0;
            currentScoresPerGame[score.game_type] = score.total_score || 0;
          }
        });
      }

      setPersonalStats({
        selectedWords: selectedWordsCount,
        level7Words: level7Count,
        currentTotalScore,
        bestTotalScore,
        bestScoresPerGame,
        bestStreaksPerGame,
        currentScoresPerGame
      });
    } catch (error) {
      console.error('Error in fetchPersonalStats:', error);
    }
  };

  const fetchRankings = async () => {
    try {
      const { data: allScores, error } = await supabase
        .from('user_scores')
        .select('user_id, game_type, total_score');

      if (error) {
        console.error('Error fetching rankings:', error);
        return;
      }

      const overallMap = {};
      if (allScores) {
        allScores.forEach(score => {
          if (!overallMap[score.user_id]) {
            overallMap[score.user_id] = 0;
          }
          overallMap[score.user_id] += score.total_score || 0;
        });
      }

      const overallRanking = Object.entries(overallMap)
        .map(([userId, total]) => ({ user_id: userId, total_score: total }))
        .sort((a, b) => b.total_score - a.total_score)
        .slice(0, 100);

      const gameRankings = {
        th: [],
        pinyin: [],
        vol: [],
        type: []
      };

      ['th', 'pinyin', 'vol', 'type'].forEach(gameType => {
        const gameScores = allScores
          ?.filter(s => s.game_type === gameType)
          .map(s => ({ user_id: s.user_id, total_score: s.total_score || 0 }))
          .sort((a, b) => b.total_score - a.total_score)
          .slice(0, 100) || [];
        gameRankings[gameType] = gameScores;
      });

      setRankings({
        overall: overallRanking,
        byGame: gameRankings
      });
    } catch (error) {
      console.error('Error in fetchRankings:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchPersonalStats();
      fetchRankings();
    }
  }, [user?.id, selectedIds, levelCounts]);

  const getUserRank = (rankingList) => {
    if (!user?.id) return null;
    const index = rankingList.findIndex(r => r.user_id === user.id);
    return index >= 0 ? index + 1 : null;
  };

  const overallRank = getUserRank(rankings.overall);
  const thRank = getUserRank(rankings.byGame.th);
  const pinyinRank = getUserRank(rankings.byGame.pinyin);
  const volRank = getUserRank(rankings.byGame.vol);
  const typeRank = getUserRank(rankings.byGame.type);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="text-center">
          <div className="text-2xl font-black italic text-slate-600">กำลังโหลด...</div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="space-y-6 pt-4 pb-10 select-none"
      style={{ userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none' }}
      onTouchStart={(e) => e.preventDefault()}
      onTouchMove={(e) => e.preventDefault()}
      onSelectStart={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
    >
      <button onClick={() => setPage('dashboard')} className="text-orange-600 font-black text-sm uppercase italic underline">← Back</button>
      <h2 className="text-3xl font-black text-center uppercase italic mb-6">📊 Score Dashboard</h2>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('personal')}
          className={`flex-1 py-3 rounded-full font-black text-sm uppercase transition-all ${
            activeTab === 'personal' 
              ? 'bg-orange-500 text-white' 
              : 'bg-white border-2 border-slate-300 text-slate-700'
          }`}
        >
          ข้อมูลส่วนตัว
        </button>
        <button
          onClick={() => setActiveTab('ranking')}
          className={`flex-1 py-3 rounded-full font-black text-sm uppercase transition-all ${
            activeTab === 'ranking' 
              ? 'bg-orange-500 text-white' 
              : 'bg-white border-2 border-slate-300 text-slate-700'
          }`}
        >
          Ranking
        </button>
      </div>

      {activeTab === 'personal' && (
        <div className="space-y-4">
          <div className="bg-white p-6 rounded-3xl border-2 border-slate-100 shadow-sm">
            <h3 className="text-xl font-black uppercase italic mb-4 text-center">📈 สถิติของคุณ</h3>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl">
                <span className="text-slate-700 font-bold">จำนวนคำศัพท์ที่เลือก</span>
                <span className="text-2xl font-black text-orange-600">{personalStats.selectedWords}</span>
              </div>

              <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl">
                <span className="text-slate-700 font-bold">คำศัพท์ Level 7</span>
                <span className="text-2xl font-black text-purple-600">{personalStats.level7Words}</span>
              </div>

              <div className="flex justify-between items-center p-4 bg-gradient-to-r from-emerald-50 to-emerald-100 rounded-2xl border-2 border-emerald-200">
                <span className="text-slate-700 font-bold">คะแนนปัจจุบัน</span>
                <span className="text-3xl font-black text-emerald-600">{personalStats.currentTotalScore}</span>
              </div>

              <div className="flex justify-between items-center p-4 bg-gradient-to-r from-yellow-50 to-yellow-100 rounded-2xl border-2 border-yellow-200">
                <span className="text-slate-700 font-bold">คะแนนรวมสูงสุด</span>
                <span className="text-3xl font-black text-yellow-600">{personalStats.bestTotalScore}</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border-2 border-slate-100 shadow-sm">
            <h3 className="text-xl font-black uppercase italic mb-4 text-center">🎮 คะแนนสูงสุดแต่ละเกม</h3>
            
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-4 bg-emerald-50 rounded-2xl border-2 border-emerald-200 text-center">
                <div className="text-xs font-black text-slate-600 uppercase mb-1">เกมแปลไทย</div>
                <div className="text-2xl font-black text-emerald-600">{personalStats.bestScoresPerGame.th}</div>
              </div>
              <div className="p-4 bg-blue-50 rounded-2xl border-2 border-blue-200 text-center">
                <div className="text-xs font-black text-slate-600 uppercase mb-1">Pinyin</div>
                <div className="text-2xl font-black text-blue-600">{personalStats.bestScoresPerGame.pinyin}</div>
              </div>
              <div className="p-4 bg-purple-50 rounded-2xl border-2 border-purple-200 text-center">
                <div className="text-xs font-black text-slate-600 uppercase mb-1">เติมคำ</div>
                <div className="text-2xl font-black text-purple-600">{personalStats.bestScoresPerGame.vol}</div>
              </div>
              <div className="p-4 bg-indigo-50 rounded-2xl border-2 border-indigo-200 text-center">
                <div className="text-xs font-black text-slate-600 uppercase mb-1">ฝึกพิมพ์</div>
                <div className="text-2xl font-black text-indigo-600">{personalStats.bestScoresPerGame.type}</div>
              </div>
            </div>

            <h3 className="text-xl font-black uppercase italic mb-4 text-center mt-6">📊 คะแนนปัจจุบันแต่ละเกม</h3>
            
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-4 bg-emerald-50 rounded-2xl border-2 border-emerald-200 text-center">
                <div className="text-xs font-black text-slate-600 uppercase mb-1">เกมแปลไทย</div>
                <div className="text-2xl font-black text-emerald-600">{personalStats.currentScoresPerGame.th}</div>
              </div>
              <div className="p-4 bg-blue-50 rounded-2xl border-2 border-blue-200 text-center">
                <div className="text-xs font-black text-slate-600 uppercase mb-1">Pinyin</div>
                <div className="text-2xl font-black text-blue-600">{personalStats.currentScoresPerGame.pinyin}</div>
              </div>
              <div className="p-4 bg-purple-50 rounded-2xl border-2 border-purple-200 text-center">
                <div className="text-xs font-black text-slate-600 uppercase mb-1">เติมคำ</div>
                <div className="text-2xl font-black text-purple-600">{personalStats.currentScoresPerGame.vol}</div>
              </div>
              <div className="p-4 bg-indigo-50 rounded-2xl border-2 border-indigo-200 text-center">
                <div className="text-xs font-black text-slate-600 uppercase mb-1">ฝึกพิมพ์</div>
                <div className="text-2xl font-black text-indigo-600">{personalStats.currentScoresPerGame.type}</div>
              </div>
            </div>

            <h3 className="text-xl font-black uppercase italic mb-4 text-center mt-6">🔥 Best Streak แต่ละเกม</h3>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 bg-emerald-50 rounded-2xl border-2 border-emerald-200 text-center">
                <div className="text-xs font-black text-slate-600 uppercase mb-1">เกมแปลไทย</div>
                <div className="text-2xl font-black text-emerald-600">{personalStats.bestStreaksPerGame.th} คำ</div>
              </div>
              <div className="p-4 bg-blue-50 rounded-2xl border-2 border-blue-200 text-center">
                <div className="text-xs font-black text-slate-600 uppercase mb-1">Pinyin</div>
                <div className="text-2xl font-black text-blue-600">{personalStats.bestStreaksPerGame.pinyin} คำ</div>
              </div>
              <div className="p-4 bg-purple-50 rounded-2xl border-2 border-purple-200 text-center">
                <div className="text-xs font-black text-slate-600 uppercase mb-1">เติมคำ</div>
                <div className="text-2xl font-black text-purple-600">{personalStats.bestStreaksPerGame.vol} คำ</div>
              </div>
              <div className="p-4 bg-indigo-50 rounded-2xl border-2 border-indigo-200 text-center">
                <div className="text-xs font-black text-slate-600 uppercase mb-1">ฝึกพิมพ์</div>
                <div className="text-2xl font-black text-indigo-600">{personalStats.bestStreaksPerGame.type} คำ</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'ranking' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border-2 border-slate-100">
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setRankingGameType('overall')}
                className={`py-2 rounded-xl font-black text-xs uppercase transition-all ${
                  rankingGameType === 'overall'
                    ? 'bg-orange-500 text-white'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                รวม
              </button>
              <button
                onClick={() => setRankingGameType('th')}
                className={`py-2 rounded-xl font-black text-xs uppercase transition-all ${
                  rankingGameType === 'th'
                    ? 'bg-emerald-500 text-white'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                แปลไทย
              </button>
              <button
                onClick={() => setRankingGameType('pinyin')}
                className={`py-2 rounded-xl font-black text-xs uppercase transition-all ${
                  rankingGameType === 'pinyin'
                    ? 'bg-blue-500 text-white'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                Pinyin
              </button>
              <button
                onClick={() => setRankingGameType('vol')}
                className={`py-2 rounded-xl font-black text-xs uppercase transition-all ${
                  rankingGameType === 'vol'
                    ? 'bg-purple-500 text-white'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                เติมคำ
              </button>
              <button
                onClick={() => setRankingGameType('type')}
                className={`py-2 rounded-xl font-black text-xs uppercase transition-all ${
                  rankingGameType === 'type'
                    ? 'bg-indigo-500 text-white'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                ฝึกพิมพ์
              </button>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border-2 border-slate-100 shadow-sm">
            <h3 className="text-xl font-black uppercase italic mb-4 text-center">
              {rankingGameType === 'overall' ? '🏆 Overall Ranking' : `🏆 ${rankingGameType === 'th' ? 'เกมแปลไทย' : rankingGameType === 'pinyin' ? 'Pinyin' : rankingGameType === 'vol' ? 'เติมคำ' : 'ฝึกพิมพ์'} Ranking`}
            </h3>

            {((rankingGameType === 'overall' && overallRank) || 
              (rankingGameType === 'th' && thRank) ||
              (rankingGameType === 'pinyin' && pinyinRank) ||
              (rankingGameType === 'vol' && volRank) ||
              (rankingGameType === 'type' && typeRank)) && (
              <div className="mb-4 p-4 bg-gradient-to-r from-orange-100 to-orange-200 rounded-2xl border-2 border-orange-300">
                <div className="text-center">
                  <div className="text-sm font-black text-slate-700 uppercase mb-1">อันดับของคุณ</div>
                  <div className="text-3xl font-black text-orange-600">
                    #{rankingGameType === 'overall' ? overallRank : 
                      rankingGameType === 'th' ? thRank :
                      rankingGameType === 'pinyin' ? pinyinRank :
                      rankingGameType === 'vol' ? volRank : typeRank}
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {((rankingGameType === 'overall' ? rankings.overall : rankings.byGame[rankingGameType]) || []).map((item, index) => {
                const isCurrentUser = item.user_id === user?.id;
                return (
                  <div
                    key={item.user_id || index}
                    className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${
                      isCurrentUser
                        ? 'bg-orange-100 border-orange-300 shadow-md'
                        : index < 3
                        ? 'bg-slate-50 border-slate-200'
                        : 'bg-white border-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {index < 3 ? (
                        <span className="text-2xl">
                          {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                        </span>
                      ) : (
                        <span className="text-xl font-black text-slate-400 w-8">#{index + 1}</span>
                      )}
                      <div>
                        <div className={`font-black ${isCurrentUser ? 'text-orange-600' : 'text-slate-800'}`}>
                          {isCurrentUser ? '✨ คุณ' : `User #${index + 1}`}
                        </div>
                      </div>
                    </div>
                    <div className="text-2xl font-black text-orange-600">
                      {item.total_score || 0}
                    </div>
                  </div>
                );
              })}
              
              {((rankingGameType === 'overall' ? rankings.overall : rankings.byGame[rankingGameType]) || []).length === 0 && (
                <div className="text-center py-8 text-slate-400">
                  ยังไม่มีข้อมูล Ranking
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
