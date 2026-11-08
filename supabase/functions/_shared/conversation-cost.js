// Project estimates shared with the existing Books configuration, not a live price feed.
const PROJECT_RATES = {
  'gpt-5.6-luna': { input: 0.2, cached: 0.02, output: 1.2 },
  'gpt-5.6-terra': { input: 2, cached: 0.2, output: 12 },
  'gpt-5.6-sol': { input: 4, cached: 0.4, output: 20 },
};

export function conversationCost(model, usage, env = {}) {
  const overrides = ['CONVERSATION_INPUT_USD_PER_M', 'CONVERSATION_CACHED_INPUT_USD_PER_M', 'CONVERSATION_OUTPUT_USD_PER_M'];
  const configured = overrides.some(key => env[key] !== undefined && env[key] !== '');
  const rates = configured ? { input: Number(env[overrides[0]]), cached: Number(env[overrides[1]]), output: Number(env[overrides[2]]) } : PROJECT_RATES[model];
  const exchangeRate = Number(env.USD_THB_RATE || 34);
  const pricingVersion = env.CONVERSATION_PRICING_VERSION || 'project-books-defaults-2026-09-14';
  const input = Number(usage?.input_tokens);
  const cached = Number(usage?.input_tokens_details?.cached_tokens || 0);
  const output = Number(usage?.output_tokens);
  const valid = rates && Object.values(rates).every(n => Number.isFinite(n) && n >= 0)
    && [input, cached, output].every(n => Number.isFinite(n) && n >= 0) && cached <= input
    && Number.isFinite(exchangeRate) && exchangeRate > 0;
  const usd = valid ? ((input - cached) * rates.input + cached * rates.cached + output * rates.output) / 1_000_000 : null;
  return { cost_usd: usd, cost_thb: usd === null ? null : usd * exchangeRate, exchange_rate: Number.isFinite(exchangeRate) && exchangeRate > 0 ? exchangeRate : null, pricing_version: pricingVersion, rates: rates || null };
}

export function formatConversationCost(value, currency = 'THB') {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return 'ยังไม่มีข้อมูลราคา';
  const number = Number(value);
  if (number > 0 && number < 0.0001) return currency === 'THB' ? '< ฿0.0001' : '< $0.0001';
  return new Intl.NumberFormat('th-TH', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(number);
}
