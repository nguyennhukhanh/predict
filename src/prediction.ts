import Binance from "node-binance-api";
import { mean } from "simple-statistics";
import { TimeInterval, type PredictionResult, type TechnicalIndicators, type TradeRecommendation } from "./types";

// Technical Analysis Constants
const EMA_PERIOD = 20;
const RSI_PERIOD = 14;
const MACD_FAST = 12;
const MACD_SLOW = 26;
const MACD_SIGNAL = 9;

const binance = new Binance();

function getMinutes(interval: TimeInterval): number {
  const value = parseInt(interval.slice(0, -1));
  const unit = interval.slice(-1);
  switch (unit) {
    case 'm': return value;
    case 'h': return value * 60;
    case 'd': return value * 24 * 60;
    case 'w': return value * 7 * 24 * 60;
    case 'M': return value * 30 * 24 * 60;
    default: return value;
  }
}

export async function predictPrice(symbol: string, interval: TimeInterval): Promise<PredictionResult[]> {
  try {
    const minutes = getMinutes(interval);
    // Increase limit to 1000 candles
    const limit = 1000;
    
    const candleData = await binance.candlesticks(
      symbol.toUpperCase(),
      interval,
      false,
      { limit }
    );

    if (!Array.isArray(candleData) || candleData.length === 0) {
      throw new Error(`No data available for symbol ${symbol}`);
    }

    // Increase historical data window to 7 days
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const filteredData = candleData.filter((candle: string[]) => 
      Number(candle[0]) >= sevenDaysAgo
    );

    const closes = filteredData.map((candle: string[]) => parseFloat(candle[4]));
    const timestamps = filteredData.map((candle: string[]) => Number(candle[0]));
    
    // Calculate technical indicators for all historical data
    const results: PredictionResult[] = [];

    for (let i = 0; i < closes.length; i++) {
      const priceWindow = closes.slice(0, i + 1);
      const indicators = calculateIndicators(priceWindow);

      results.push({
        timestamp: timestamps[i],
        actual: closes[i],
        predicted: closes[i],
        indicators
      });
    }

    // Add future prediction point
    const lastClose = closes[closes.length - 1];
    const lastIndicators = calculateIndicators(closes);
    const predicted = predictNextValue(lastClose, lastIndicators);
    const nextTimestamp = timestamps[timestamps.length - 1] + minutes * 60 * 1000;

    results.push({
      timestamp: nextTimestamp,
      actual: 0,
      predicted,
      indicators: lastIndicators,
      recommendation: generateRecommendation(lastClose, predicted, lastIndicators)
    });

    return results;
  } catch (error: any) {
    throw error;
  }
}

function calculateRSI(prices: number[]): number {
  let gains = 0;
  let losses = 0;

  for (let i = 1; i < prices.length; i++) {
    const difference = prices[i] - prices[i - 1];
    if (difference >= 0) {
      gains += difference;
    } else {
      losses -= difference;
    }
  }

  const averageGain = gains / 14;
  const averageLoss = losses / 14;
  
  if (averageLoss === 0) {
    return 100;
  }
  
  const rs = averageGain / averageLoss;
  return 100 - (100 / (1 + rs));
}

function calculateEMA(prices: number[], period: number): number[] {
  const multiplier = 2 / (period + 1);
  const ema = [prices[0]];
  
  for (let i = 1; i < prices.length; i++) {
    ema[i] = (prices[i] - ema[i-1]) * multiplier + ema[i-1];
  }
  
  return ema;
}

function calculateMACD(prices: number[]): { macd: number[], signal: number[], histogram: number[] } {
  const fastEMA = calculateEMA(prices, MACD_FAST);
  const slowEMA = calculateEMA(prices, MACD_SLOW);
  const macd = fastEMA.map((fast, i) => fast - slowEMA[i]);
  const signal = calculateEMA(macd, MACD_SIGNAL);
  const histogram = macd.map((value, i) => value - signal[i]);
  
  return { macd, signal, histogram };
}

function calculateIndicators(prices: number[]): TechnicalIndicators {
  const sma = mean(prices.slice(-EMA_PERIOD));
  const ema = calculateEMA(prices, EMA_PERIOD)[prices.length - 1];
  const rsi = calculateRSI(prices.slice(-RSI_PERIOD));
  const macdData = calculateMACD(prices);
  
  return {
    sma,
    ema,
    rsi,
    macd: {
      macd: macdData.macd[macdData.macd.length - 1],
      signal: macdData.signal[macdData.signal.length - 1],
      histogram: macdData.histogram[macdData.histogram.length - 1]
    }
  };
}

function predictNextValue(current: number, indicators: TechnicalIndicators): number {
  if (indicators.rsi > 70) {
    return current * 0.995;
  } else if (indicators.rsi < 30) {
    return current * 1.005;
  } else {
    return indicators.sma > current ? current * 1.002 : current * 0.998;
  }
}

function generateRecommendation(
  current: number,
  predicted: number,
  indicators: TechnicalIndicators
): TradeRecommendation {
  const priceChange = ((predicted - current) / current) * 100;
  const trendStrength = Math.abs(priceChange);
  
  const macdCrossover = indicators.macd.histogram > 0;
  const isOverbought = indicators.rsi > 70;
  const isOversold = indicators.rsi < 30;
  const emaTrend = current > indicators.ema;

  let confidence = 50;
  let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
  let reason = '';

  // Analyze multiple indicators for stronger signals
  if (isOversold && macdCrossover && !emaTrend) {
    action = 'BUY';
    confidence = Math.min(90, 60 + trendStrength);
    reason = 'Strong buy signal: RSI oversold, MACD crossover, price below EMA';
  } else if (isOverbought && !macdCrossover && emaTrend) {
    action = 'SELL';
    confidence = Math.min(90, 60 + trendStrength);
    reason = 'Strong sell signal: RSI overbought, MACD bearish, price above EMA';
  } else {
    action = 'HOLD';
    confidence = 60;
    reason = 'Mixed signals, recommend holding position';
  }

  const suggestedAmount = current * (trendStrength / 100);
  const riskLevel = trendStrength > 5 ? 'HIGH' : trendStrength > 2 ? 'MEDIUM' : 'LOW';

  return { action, confidence, reason, suggestedAmount, riskLevel };
}
