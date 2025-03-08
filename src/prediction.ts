import { MarketData, OHLCV, PredictionResult, TradingStrategy } from "./types";
import { SMA, EMA, RSI, MACD, BollingerBands, StochasticRSI } from 'technicalindicators';

// Helper function to get price data
async function fetchMarketData(symbol: string, timeframe: string, limit = 200): Promise<MarketData> {
  try {
    const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${timeframe}&limit=${limit}`);
    const data = await response.json();
    
    const candles: OHLCV[] = data.map((candle: any) => ({
      time: candle[0],
      open: parseFloat(candle[1]),
      high: parseFloat(candle[2]),
      low: parseFloat(candle[3]),
      close: parseFloat(candle[4]),
      volume: parseFloat(candle[5])
    }));

    return {
      symbol,
      timeframe,
      candles
    };
  } catch (error) {
    console.error('Error fetching market data:', error);
    throw error;
  }
}

// Strategy 1: Trend following with MACD + RSI
export const trendFollowingStrategy: TradingStrategy = {
  id: 'trend-following',
  name: 'Trend Following Strategy',
  description: 'Uses MACD and RSI to identify trends and momentum',
  timeframes: ['15m', '30m', '1h', '4h', '1d'],
  indicators: ['MACD', 'RSI', 'EMA'],
  
  execute(data: MarketData): PredictionResult {
    const { candles, symbol, timeframe } = data;
    const closes = candles.map(c => c.close);
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);
    const currentPrice = closes[closes.length - 1];
    
    // Calculate indicators
    const macdValues = MACD.calculate({
      values: closes,
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
      SimpleMAOscillator: false,
      SimpleMASignal: false
    });
    
    const rsiValues = RSI.calculate({ values: closes, period: 14 });
    
    // Ensure we have enough data for EMA200 or use a smaller period
    const emaPeriod = closes.length >= 200 ? 200 : Math.floor(closes.length * 0.75);
    const ema200 = EMA.calculate({ values: closes, period: emaPeriod });
    
    // Get latest indicator values
    const latestMACD = macdValues[macdValues.length - 1];
    const latestRSI = rsiValues[rsiValues.length - 1];
    const latestEMA = ema200[ema200.length - 1];
    const isTrendUp = currentPrice > latestEMA;
    
    // Trading logic
    let direction: 'long' | 'short' | 'neutral' = 'neutral';
    let confidence = 0.5;
    
    if (isTrendUp && latestMACD.histogram > 0 && latestRSI < 70) {
      direction = 'long';
      confidence = 0.7 + (latestMACD.histogram / 10) + ((latestRSI - 50) / 100);
    } else if (!isTrendUp && latestMACD.histogram < 0 && latestRSI > 30) {
      direction = 'short';
      confidence = 0.7 + (Math.abs(latestMACD.histogram) / 10) + ((70 - latestRSI) / 100);
    }
    
    // Limit confidence to [0, 1]
    confidence = Math.min(Math.max(confidence, 0), 0.95);
    
    // Calculate targets and stop loss
    const atr = calculateATR(candles, 14);
    const targetMultiplier = direction === 'long' ? 2 : -2;
    const stopMultiplier = direction === 'long' ? -1 : 1;
    
    const targetPrice = currentPrice + (atr * targetMultiplier);
    const stopLoss = currentPrice + (atr * stopMultiplier);
    
    return {
      symbol,
      timeframe,
      timestamp: Date.now(),
      currentPrice,
      prediction: {
        direction,
        confidence,
        targetPrice: Number(targetPrice.toFixed(2)),
        stopLoss: Number(stopLoss.toFixed(2)),
        indicators: [
          { name: 'MACD', value: latestMACD.histogram, color: latestMACD.histogram > 0 ? '#26a69a' : '#ef5350' },
          { name: 'RSI', value: latestRSI, color: latestRSI > 70 ? '#ef5350' : latestRSI < 30 ? '#26a69a' : '#b2b5be' },
          { name: 'EMA' + emaPeriod, value: latestEMA, color: isTrendUp ? '#26a69a' : '#ef5350' }
        ]
      }
    };
  }
};

// Strategy 2: Mean Reversion with Bollinger Bands + StochRSI
export const meanReversionStrategy: TradingStrategy = {
  id: 'mean-reversion',
  name: 'Mean Reversion Strategy',
  description: 'Uses Bollinger Bands and Stochastic RSI to identify overbought/oversold conditions',
  timeframes: ['15m', '30m', '1h', '4h'],
  indicators: ['Bollinger Bands', 'Stochastic RSI'],
  
  execute(data: MarketData): PredictionResult {
    const { candles, symbol, timeframe } = data;
    const closes = candles.map(c => c.close);
    const currentPrice = closes[closes.length - 1];
    
    // Calculate indicators
    const bbands = BollingerBands.calculate({
      period: 20,
      values: closes,
      stdDev: 2
    });
    
    const stochRSI = StochasticRSI.calculate({
      values: closes,
      rsiPeriod: 14,
      stochasticPeriod: 14,
      kPeriod: 3,
      dPeriod: 3
    });
    
    // Get latest indicator values
    const latestBB = bbands[bbands.length - 1];
    const latestStochRSI = stochRSI[stochRSI.length - 1];
    
    // Calculate Percent B (position within Bollinger Bands)
    const percentB = (currentPrice - latestBB.lower) / (latestBB.upper - latestBB.lower);
    
    // Trading logic
    let direction: 'long' | 'short' | 'neutral' = 'neutral';
    let confidence = 0.5;
    
    if (percentB < 0.2 && latestStochRSI.k < 20) {
      direction = 'long';
      confidence = 0.7 + (0.2 - percentB) + ((20 - latestStochRSI.k) / 100);
    } else if (percentB > 0.8 && latestStochRSI.k > 80) {
      direction = 'short';
      confidence = 0.7 + (percentB - 0.8) + ((latestStochRSI.k - 80) / 100);
    }
    
    // Limit confidence to [0, 1]
    confidence = Math.min(Math.max(confidence, 0), 0.95);
    
    // Calculate targets and stop loss
    const targetPrice = direction === 'long' ? latestBB.middle : latestBB.middle;
    const stopLoss = direction === 'long' ? currentPrice * 0.98 : currentPrice * 1.02;
    
    return {
      symbol,
      timeframe,
      timestamp: Date.now(),
      currentPrice,
      prediction: {
        direction,
        confidence,
        targetPrice: Number(targetPrice.toFixed(2)),
        stopLoss: Number(stopLoss.toFixed(2)),
        indicators: [
          { name: 'BB Upper', value: latestBB.upper, color: '#b2b5be' },
          { name: 'BB Middle', value: latestBB.middle, color: '#b2b5be' },
          { name: 'BB Lower', value: latestBB.lower, color: '#b2b5be' },
          { name: 'StochRSI K', value: latestStochRSI.k, color: latestStochRSI.k > 80 ? '#ef5350' : latestStochRSI.k < 20 ? '#26a69a' : '#b2b5be' },
          { name: 'StochRSI D', value: latestStochRSI.d, color: '#f0b90b' },
          { name: 'Percent B', value: percentB, color: percentB > 0.8 ? '#ef5350' : percentB < 0.2 ? '#26a69a' : '#b2b5be' }
        ]
      },
      historicalAccuracy: 0.68 // Placeholder, should be calculated from backtest
    };
  }
};

// Utility functions
function calculateATR(candles: OHLCV[], period: number): number {
  if (candles.length < period + 1) return 0;

  let atr = 0;
  let tr: number[] = [];

  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevClose = candles[i - 1].close;

    const tr1 = high - low;
    const tr2 = Math.abs(high - prevClose);
    const tr3 = Math.abs(low - prevClose);

    tr.push(Math.max(tr1, tr2, tr3));
  }

  if (tr.length <= period) {
    atr = tr.reduce((sum, val) => sum + val, 0) / tr.length;
  } else {
    const initialAtr = tr.slice(0, period).reduce((sum, val) => sum + val, 0) / period;
    atr = tr.slice(period).reduce((acc, val, i) => {
      return ((period - 1) * acc + val) / period;
    }, initialAtr);
  }

  return atr;
}

// Main prediction function
export async function getPrediction(symbol: string, timeframe: string, strategy: 'trend-following' | 'mean-reversion' = 'trend-following'): Promise<PredictionResult> {
  try {
    const marketData = await fetchMarketData(symbol, timeframe);
    
    if (strategy === 'trend-following') {
      return trendFollowingStrategy.execute(marketData);
    } else {
      return meanReversionStrategy.execute(marketData);
    }
  } catch (error) {
    console.error('Error getting prediction:', error);
    throw error;
  }
}

// Get available strategies
export function getAvailableStrategies(): Pick<TradingStrategy, 'id' | 'name' | 'description' | 'timeframes'>[] {
  return [
    {
      id: trendFollowingStrategy.id,
      name: trendFollowingStrategy.name,
      description: trendFollowingStrategy.description,
      timeframes: trendFollowingStrategy.timeframes,
    },
    {
      id: meanReversionStrategy.id,
      name: meanReversionStrategy.name,
      description: meanReversionStrategy.description,
      timeframes: meanReversionStrategy.timeframes,
    }
  ];
}
