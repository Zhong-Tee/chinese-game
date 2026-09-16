type JsonObject = Record<string, any>;

type RankedSignal = {
  value: string;
  score: number;
};

export type ReaderPreferenceProfile = {
  reviewed_books: number;
  completed_books: number;
  positive: {
    genres: RankedSignal[];
    categories: RankedSignal[];
    tones: RankedSignal[];
    interests: RankedSignal[];
    favorite_aspects: RankedSignal[];
  };
  reduce: {
    genres: RankedSignal[];
    categories: RankedSignal[];
    tones: RankedSignal[];
    interests: RankedSignal[];
  };
};

const ENJOYMENT_WEIGHT: Record<string, number> = {
  love: 3,
  like: 2,
  neutral: 0.5,
  dislike: -3,
};

const ASPECT_LABELS: Record<string, string> = {
  character: 'strong memorable characters',
  adventure: 'adventure and discovery',
  comedy: 'humor and comedy',
  mystery: 'mystery and investigation',
  images: 'visual and illustration-rich storytelling',
  story: 'plot and story progression',
};

function addScore(target: Map<string, number>, value: unknown, score: number) {
  const normalized = String(value || '').trim();
  if (!normalized || !Number.isFinite(score)) return;
  target.set(normalized, (target.get(normalized) || 0) + score);
}

function ranked(source: Map<string, number>, direction: 'positive' | 'negative', limit = 5): RankedSignal[] {
  return [...source.entries()]
    .filter(([, score]) => direction === 'positive' ? score > 0 : score < 0)
    .sort((a, b) => direction === 'positive' ? b[1] - a[1] : a[1] - b[1])
    .slice(0, limit)
    .map(([value, score]) => ({ value, score: Math.round(Math.abs(score) * 10) / 10 }));
}

function bookSignals(book: JsonObject, score: number, buckets: Record<string, Map<string, number>>) {
  addScore(buckets.genres, book.primary_genre, score);
  addScore(buckets.genres, book.secondary_genre, score * 0.6);
  addScore(buckets.genres, book.series_genre, score);
  addScore(buckets.categories, book.category, score);
  addScore(buckets.tones, book.tone, score);
  addScore(buckets.tones, book.secondary_tone, score * 0.6);
  for (const interest of Array.isArray(book.interests) ? book.interests : []) addScore(buckets.interests, interest, score);
}

export async function buildReaderPreferenceProfile(admin: any, userId: string, limit = 20): Promise<ReaderPreferenceProfile> {
  const [{ data: reviews }, { data: reads }] = await Promise.all([
    admin.from('ai_book_reviews').select('book_id,enjoyment,favorite_aspect,updated_at').eq('user_id', userId).order('updated_at', { ascending: false }).limit(limit),
    admin.from('ai_book_reads').select('book_id,completed_at').eq('user_id', userId).order('completed_at', { ascending: false }).limit(limit),
  ]);
  const reviewRows = Array.isArray(reviews) ? reviews : [];
  const readRows = Array.isArray(reads) ? reads : [];
  const bookIds = [...new Set([...reviewRows, ...readRows].map((item: JsonObject) => String(item.book_id || '')).filter(Boolean))];
  const { data: books } = bookIds.length
    ? await admin.from('ai_books').select('id,category,book_format,primary_genre,secondary_genre,series_genre,tone,secondary_tone,interests').in('id', bookIds)
    : { data: [] };
  const booksById = new Map((Array.isArray(books) ? books : []).map((book: JsonObject) => [String(book.id), book]));
  const reviewedIds = new Set(reviewRows.map((review: JsonObject) => String(review.book_id)));
  const buckets = {
    genres: new Map<string, number>(),
    categories: new Map<string, number>(),
    tones: new Map<string, number>(),
    interests: new Map<string, number>(),
    aspects: new Map<string, number>(),
  };

  for (const review of reviewRows) {
    const weight = ENJOYMENT_WEIGHT[String(review.enjoyment)] ?? 0;
    const book = booksById.get(String(review.book_id));
    if (book) bookSignals(book, weight, buckets);
    const aspect = ASPECT_LABELS[String(review.favorite_aspect)];
    if (aspect) addScore(buckets.aspects, aspect, Math.max(0.5, weight));
  }
  for (const read of readRows) {
    if (reviewedIds.has(String(read.book_id))) continue;
    const book = booksById.get(String(read.book_id));
    if (book) bookSignals(book, 0.35, buckets);
  }

  return {
    reviewed_books: reviewRows.length,
    completed_books: readRows.length,
    positive: {
      genres: ranked(buckets.genres, 'positive'),
      categories: ranked(buckets.categories, 'positive'),
      tones: ranked(buckets.tones, 'positive'),
      interests: ranked(buckets.interests, 'positive'),
      favorite_aspects: ranked(buckets.aspects, 'positive'),
    },
    reduce: {
      genres: ranked(buckets.genres, 'negative'),
      categories: ranked(buckets.categories, 'negative'),
      tones: ranked(buckets.tones, 'negative'),
      interests: ranked(buckets.interests, 'negative'),
    },
  };
}

export function readerPreferenceGuidance(profile: ReaderPreferenceProfile | null) {
  if (!profile || (!profile.reviewed_books && !profile.completed_books)) {
    return 'No personal reading-preference signals are available. Create a fresh, varied story.';
  }
  return `Personal reading profile for this creator only: ${JSON.stringify(profile)}.
Use the current form selections and requested topic as the highest-priority requirements. Use positive profile signals only as secondary guidance, reduce negatively scored patterns, and keep at least 25% novelty. Never copy a prior title, plot, scene sequence, character, or setting. Completed books without a review are weak signals only. Do not infer preferences from reviews written by other users.`;
}
