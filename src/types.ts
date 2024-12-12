export enum TimeInterval {
  ONE_MINUTE = '1m',
  THREE_MINUTES = '3m',
  FIVE_MINUTES = '5m',
  FIFTEEN_MINUTES = '15m',
  THIRTY_MINUTES = '30m',
  ONE_HOUR = '1h',
  TWO_HOURS = '2h',
  FOUR_HOURS = '4h',
  SIX_HOURS = '6h',
  EIGHT_HOURS = '8h',
  TWELVE_HOURS = '12h',
  ONE_DAY = '1d',
  THREE_DAYS = '3d',
  ONE_WEEK = '1w',
  ONE_MONTH = '1M'
}

export interface TradeRecommendation {
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number; // 0-100%
  reason: string;
  suggestedAmount: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface TechnicalIndicators {
  sma: number;
  ema: number;
  rsi: number;
  macd: {
    macd: number;
    signal: number;
    histogram: number;
  };
}

export interface PredictionResult {
  timestamp: number;
  actual: number;
  predicted: number;
  indicators: TechnicalIndicators;
  recommendation?: TradeRecommendation;
}
