export interface OHLCV {
  time: number;
  open: number;
  high: number;
  close: number;
  low: number;
  volume: number;
}

export interface MarketData {
  symbol: string;
  timeframe: string;
  candles: OHLCV[];
  marketSentiment?: number;
  orderFlowData?: any;
  onChainMetrics?: any;
}

export interface Indicator {
  name: string;
  value: number | number[]; // Can be a single number or array of numbers
  color?: string;
}

export interface PredictionResult {
  symbol: string;
  timeframe: string;
  timestamp: number;
  currentPrice: number;
  prediction: {
    direction: 'long' | 'short' | 'neutral';
    confidence: number;
    targetPrice: number;
    stopLoss: number;
    indicators: Indicator[];
  };
  historicalAccuracy?: number;
}

export interface TradingStrategy {
  id: string;
  name: string;
  description: string;
  timeframes: string[];
  indicators: string[];
  execute(data: MarketData): PredictionResult;
}

export interface BacktestResult {
  strategy: string;
  symbol: string;
  timeframe: string;
  startDate: string;
  endDate: string;
  totalTrades: number;
  winRate: number;
  profitFactor: number;
  maxDrawdown: number;
  trades: {
    entry: {
      timestamp: number;
      price: number;
      direction: 'long' | 'short';
    };
    exit?: {
      timestamp: number;
      price: number;
      reason: 'target' | 'stop' | 'signal';
    };
    profitLoss?: number;
    profitLossPercent?: number;
  }[];
}
