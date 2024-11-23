import Binance from "node-binance-api";
import {
  mean,
  standardDeviation,
  linearRegression,
  quantile,
  variance,
  sampleKurtosis,
  sampleSkewness,
  kernelDensityEstimation,
  harmonicMean,
  geometricMean,
} from "simple-statistics";

const binance = new Binance().options({
  useServerTime: true,
  test: false,
  verbose: false,
  reconnect: true,
  keepAlive: true,
  family: 4,
});

interface PricePattern {
  pattern: string;
  strength: number;
}

interface MLPrediction {
  price: number;
  probability: number;
  timeframe: string;
}

interface StatsResult {
  volatility: number;
  meanReturn: number;
  momentum: number;
  variance: number;
  skewness: number;
  kurtosis: number;
  quartiles: { q1: number; q2: number; q3: number };
  geometricMean: number;
  harmonicMean: number;
}

interface PredictionResult {
  symbol: string;
  timestamps: number[];
  prices: number[]; // Add full price history
  currentPrice: number;
  predictedPrice: number;
  trend: string;
  pattern: string;
  confidence: number;
  score: number;
  analytics: {
    technical: {
      macd: { macd: number; signal: number; histogram: number };
      rsi: number;
      bollingerBands: { upper: number; middle: number; lower: number };
    };
    momentum: number;
    volatility: number;
    trend: number;
    pattern: PricePattern;
  };
}

// Technical indicators calculation
function calculateEMA(prices: number[], period: number): number {
  const multiplier = 2 / (period + 1);
  return prices.reduce((ema, price, i) => {
    return i === 0 ? price : price * multiplier + ema * (1 - multiplier);
  }, 0);
}

function calculateMACD(prices: number[]): {
  macd: number;
  signal: number;
  histogram: number;
} {
  const ema12 = calculateEMA(prices, 12);
  const ema26 = calculateEMA(prices, 26);
  const macd = ema12 - ema26;
  const signal = calculateEMA(prices.slice(-9), 9); // Corrected signal calculation
  return { macd, signal, histogram: macd - signal };
}

function calculateRSI(prices: number[], period: number = 14): number {
  const changes = prices.slice(1).map((price, i) => price - prices[i]);
  const gains = changes.map((change) => (change > 0 ? change : 0));
  const losses = changes.map((change) => (change < 0 ? Math.abs(change) : 0));

  const avgGain = mean(gains.slice(-period));
  const avgLoss = mean(losses.slice(-period));

  return 100 - 100 / (1 + avgGain / (avgLoss || 1));
}

function calculateBollingerBands(prices: number[], period: number = 20) {
  const sma = mean(prices.slice(-period));
  const stdDev = standardDeviation(prices.slice(-period));
  return {
    upper: sma + stdDev * 2,
    middle: sma,
    lower: sma - stdDev * 2,
  };
}

function detectTrend(prices: number[]): { trend: string; strength: number } {
  const ema20 = calculateEMA(prices, 20);
  const ema50 = calculateEMA(prices, 50);
  const ema200 = calculateEMA(prices, 200);

  let strength = 0;
  let trend = "NEUTRAL";

  if (ema20 > ema50 && ema50 > ema200) {
    trend = "STRONG_BULLISH";
    strength = (ema20 - ema200) / ema200;
  } else if (ema20 < ema50 && ema50 < ema200) {
    trend = "STRONG_BEARISH";
    strength = (ema200 - ema20) / ema200;
  } else if (ema20 > ema50) {
    trend = "BULLISH";
    strength = (ema20 - ema50) / ema50;
  } else {
    trend = "BEARISH";
    strength = (ema50 - ema20) / ema50;
  }

  return { trend, strength: Math.min(strength * 100, 100) };
}

function normalizeValue(
  value: number,
  min: number = -100,
  max: number = 100
): number {
  return Math.min(Math.max(value, min), max);
}

function calculateAdvancedStats(prices: number[]): StatsResult {
  try {
    const returns = prices.slice(1).map((p, i) => (p - prices[i]) / prices[i]);
    const volatility = standardDeviation(returns) * Math.sqrt(365); // Annualized volatility
    const positivePrices = prices.filter((p) => p > 0);

    return {
      volatility: volatility * 100, // Convert to percentage
      meanReturn: mean(returns) * 100,
      momentum:
        (prices[prices.length - 1] / prices[prices.length - 20] - 1) * 100,
      variance: Math.min(variance(returns) * 100, 10), // Cap at 10%
      skewness: normalizeValue(sampleSkewness(returns)),
      kurtosis: normalizeValue(sampleKurtosis(returns)),
      quartiles: {
        q1: quantile(prices, 0.25),
        q2: quantile(prices, 0.5),
        q3: quantile(prices, 0.75),
      },
      geometricMean: geometricMean(positivePrices),
      harmonicMean: harmonicMean(positivePrices),
    };
  } catch (error) {
    console.error("Stats calculation error:", error);
    return {
      volatility: 0,
      meanReturn: 0,
      momentum: 0,
      variance: 0,
      skewness: 0,
      kurtosis: 0,
      quartiles: { q1: 0, q2: 0, q3: 0 },
      geometricMean: 0,
      harmonicMean: 0,
    };
  }
}

function identifyPricePatterns(prices: number[]): PricePattern {
  const recent = prices.slice(-10);
  const regression = linearRegression(recent.map((p, i) => [i, p]));
  const slope = regression.m;
  const densityFn = kernelDensityEstimation(recent);
  const densityValues = recent.map((p) => densityFn(p));
  const volatility = standardDeviation(recent) / mean(recent);

  let pattern = "UNKNOWN";
  let strength = 0;

  if (Math.max(...densityValues) > 2) {
    pattern = "ACCUMULATION";
    strength = Math.min(Math.max(...densityValues) / 2, 1);
  } else if (volatility > 0.02) {
    if (slope > 0) {
      pattern = "BREAKOUT_UP";
      strength = Math.min(slope * 100, 1);
    } else {
      pattern = "BREAKOUT_DOWN";
      strength = Math.min(Math.abs(slope) * 100, 1);
    }
  } else if (volatility < 0.005) {
    pattern = "CONSOLIDATION";
    strength = 1 - volatility * 100;
  }

  return { pattern, strength: strength * 100 };
}

function calculateConfidence(params: {
  score: number;
  rsi: number;
  trend: { strength: number };
  pattern: { strength: number };
  volatility: number;
  macd: { histogram: number };
  currentPrice: number;
}): number {
  const { score, rsi, trend, pattern, volatility, macd, currentPrice } = params;

  const rsiConfidence =
    rsi > 70 || rsi < 30 ? 85 : rsi > 65 || rsi < 35 ? 75 : 60;

  const trendConfidence =
    trend.strength * (Math.sign(macd.histogram) === Math.sign(score) ? 1 : 0.5);

  const patternConfidence = pattern.strength * (1 - volatility);

  const confidence =
    rsiConfidence * 0.3 + trendConfidence * 0.4 + patternConfidence * 0.3;

  return confidence * (1 - volatility);
}

// Add this function before calculateIchimokuCloud
function calculatePeriod(prices: number[], period: number): number {
  const highPrices = prices.slice(-period);
  const lowPrices = prices.slice(-period);
  return (Math.max(...highPrices) + Math.min(...lowPrices)) / 2;
}

function calculateIchimokuCloud(prices: number[]) {
  const tenkan = calculatePeriod(prices, 9);
  const kijun = calculatePeriod(prices, 26);
  const senkouA = (tenkan + kijun) / 2;
  const senkouB = calculatePeriod(prices, 52);

  return { tenkan, kijun, senkouA, senkouB };
}

function calculateStochRSI(prices: number[], period: number = 14): number {
  const rsiValues = prices
    .map((_, i, arr) =>
      i >= period ? calculateRSI(arr.slice(i - period, i)) : 0
    )
    .slice(period);

  const minRSI = Math.min(...rsiValues);
  const maxRSI = Math.max(...rsiValues);
  return ((rsiValues[rsiValues.length - 1] - minRSI) / (maxRSI - minRSI)) * 100;
}

// Modify predictPrice to accept interval parameter
function formatPrice(price: number, symbol: string): number {
  // Custom precision for different types of coins
  if (symbol.includes("SHIB") || symbol.includes("DOGE") || price < 0.01) {
    return Number(price.toPrecision(8));
  } else if (price < 1) {
    return Number(price.toPrecision(6));
  } else if (price < 100) {
    return Number(price.toPrecision(8));
  } else {
    return Number(price.toPrecision(10));
  }
}

async function predictPrice(
  symbol = "BTCUSDT",
  interval = "1h"
): Promise<PredictionResult> {
  try {
    if (!symbol || typeof symbol !== "string") {
      throw new Error("Invalid symbol");
    }

    // Sử dụng node-binance-api để lấy candlesticks
    let klines;
    try {
      klines = await binance.candlesticks(symbol, interval, false, {
        limit: 200,
      });

      if (!Array.isArray(klines) || klines.length === 0) {
        throw new Error("No data available for this symbol");
      }
    } catch (binanceError: any) {
      console.error("Binance API error:", binanceError);
      throw new Error(
        `Failed to fetch data: ${binanceError.message || "API error"}`
      );
    }

    // Convert dữ liệu với validation chặt chẽ
    const prices = klines.map((k: any[], i: number) => {
      const closePrice = parseFloat(k[4]);
      if (isNaN(closePrice) || closePrice <= 0) {
        throw new Error(`Invalid price at index ${i}`);
      }
      return closePrice;
    });

    const volumes = klines.map((k: any[], i: number) => {
      const volume = parseFloat(k[5]);
      if (isNaN(volume) || volume < 0) {
        throw new Error(`Invalid volume at index ${i}`);
      }
      return volume;
    });

    const timestamps = klines.map((k: any[], i: number) => {
      const timestamp = parseInt(k[0]);
      if (isNaN(timestamp) || timestamp <= 0) {
        throw new Error(`Invalid timestamp at index ${i}`);
      }
      return timestamp;
    });

    // Calculate indicators
    const currentPrice = prices[prices.length - 1];
    const stats = calculateAdvancedStats(prices);
    const trend = detectTrend(prices);
    const pricePattern = identifyPricePatterns(prices);
    const rsi = calculateRSI(prices);
    const macd = calculateMACD(prices);
    const bb = calculateBollingerBands(prices);

    // Price prediction logic
    const volatilityImpact = stats.volatility / 100;
    const momentumImpact = stats.momentum / 100;
    const trendImpact = trend.strength / 100;
    const rsiImpact = (rsi - 50) / 50;

    const priceChange =
      currentPrice *
      (volatilityImpact * 0.3 +
        momentumImpact * 0.3 +
        trendImpact * 0.2 +
        rsiImpact * 0.2);

    const calculatedPrice = currentPrice + priceChange;
    const formattedCurrentPrice = formatPrice(currentPrice, symbol);
    const formattedPredictedPrice = formatPrice(calculatedPrice, symbol);

    // Calculate confidence and score
    const confidenceScore = Math.min(
      100,
      (1 - Math.abs(volatilityImpact)) * 30 +
        Math.abs(momentumImpact) * 30 +
        trend.strength * 20 +
        (1 - Math.abs(rsiImpact)) * 20
    );

    const totalScore = normalizeValue(
      trendImpact * 40 +
        momentumImpact * 30 +
        rsiImpact * 20 +
        volatilityImpact * 10,
      -100,
      100
    );

    // Prepare result
    const result: PredictionResult = {
      symbol,
      timestamps,
      prices, // Add full price history
      currentPrice: formattedCurrentPrice,
      predictedPrice: formattedPredictedPrice,
      trend: trend.trend,
      pattern: pricePattern.pattern,
      confidence: confidenceScore,
      score: totalScore,
      analytics: {
        technical: { macd, rsi, bollingerBands: bb },
        momentum: stats.momentum,
        volatility: stats.volatility,
        trend: trend.strength,
        pattern: pricePattern,
      },
    };

    return result;
  } catch (error: any) {
    console.error("Prediction error details:", {
      error,
      message: error.message,
      stack: error.stack,
    });
    throw new Error(error.message || "Failed to predict price");
  }
}

function calculateVolumeProfile(prices: number[], volumes: number[]) {
  // Add volume profile analysis logic
  return {
    score: 0,
    poc: 0, // Point of Control
    valueAreas: [],
  };
}

function analyzeMarketDepth(depth: any) {
  try {
    // Check if depth data exists and has the correct structure
    if (
      !depth ||
      !depth.bids ||
      !depth.asks ||
      !Array.isArray(depth.bids) ||
      !Array.isArray(depth.asks)
    ) {
      return {
        score: 0,
        buyPressure: 0,
        sellPressure: 0,
        imbalance: 0,
      };
    }

    // Convert string values to numbers and calculate pressures
    const buyPressure = depth.bids.reduce(
      (acc: number, bid: any[]) =>
        acc + parseFloat(bid[0]) * parseFloat(bid[1]),
      0
    );
    const sellPressure = depth.asks.reduce(
      (acc: number, ask: any[]) =>
        acc + parseFloat(ask[0]) * parseFloat(ask[1]),
      0
    );

    const totalPressure = buyPressure + sellPressure;
    if (totalPressure === 0)
      return { score: 0, buyPressure: 0, sellPressure: 0, imbalance: 0 };

    return {
      score: (buyPressure - sellPressure) / totalPressure,
      buyPressure,
      sellPressure,
      imbalance: Math.abs(buyPressure - sellPressure) / totalPressure,
    };
  } catch (error) {
    console.error("Market depth analysis error:", error);
    return {
      score: 0,
      buyPressure: 0,
      sellPressure: 0,
      imbalance: 0,
    };
  }
}

function analyzeOrderFlow(prices: number[], volumes: number[]) {
  // Add order flow analysis logic
  return {
    score: 0,
    buySellRatio: 0,
    largeOrdersImpact: 0,
  };
}

function calculateRiskMetrics(
  prices: number[],
  predictedPrice: number,
  confidence: number
) {
  const volatility = standardDeviation(prices) / mean(prices);
  const var95 = calculateValueAtRisk(prices, 0.95);
  const maxDrawdown = calculateMaxDrawdown(prices);

  return {
    volatility,
    valueAtRisk: var95,
    maxDrawdown,
    sharpeRatio: calculateSharpeRatio(prices),
    riskAdjustedReturn: (predictedPrice - prices[prices.length - 1]) / var95,
    confidenceInterval: calculateConfidenceInterval(prices, confidence),
  };
}

// Add these missing helper functions before calculateRiskMetrics
function calculateValueAtRisk(prices: number[], confidence: number): number {
  const returns = prices
    .slice(1)
    .map((price, i) => (price - prices[i]) / prices[i]);
  const sortedReturns = returns.sort((a, b) => a - b);
  const index = Math.floor((1 - confidence) * sortedReturns.length);
  return sortedReturns[index];
}

function calculateMaxDrawdown(prices: number[]): number {
  let maxDrawdown = 0;
  let peak = prices[0];

  for (const price of prices) {
    if (price > peak) {
      peak = price;
    }
    const drawdown = (peak - price) / peak;
    maxDrawdown = Math.max(maxDrawdown, drawdown);
  }

  return maxDrawdown;
}

function calculateConfidenceInterval(prices: number[], confidence: number) {
  const std = standardDeviation(prices);
  const meanPrice = mean(prices);
  const zScore = 1.96; // 95% confidence interval
  return {
    lower: meanPrice - zScore * std * (1 - confidence / 100),
    upper: meanPrice + zScore * std * (1 - confidence / 100),
  };
}

// Add this missing function that was referenced earlier
function generateTradingSignals(params: {
  price: number;
  ichimoku: any;
  macd: any;
  rsi: number;
  trend: any;
}) {
  const signals = [];

  if (params.rsi < 30) signals.push("OVERSOLD");
  if (params.rsi > 70) signals.push("OVERBOUGHT");
  if (params.macd.histogram > 0) signals.push("MACD_BULLISH");
  if (params.macd.histogram < 0) signals.push("MACD_BEARISH");
  if (params.price > params.ichimoku.senkouA) signals.push("ABOVE_CLOUD");
  if (params.price < params.ichimoku.senkouB) signals.push("BELOW_CLOUD");

  return {
    signals,
    strength: (signals.length / 6) * 100, // Normalize to percentage
    primarySignal: signals[0] || "NEUTRAL",
  };
}

// Make predictPrice available for import
export {
  predictPrice,
  calculateRiskMetrics,
  analyzeMarketDepth,
  calculateVolumeProfile,
};

async function main() {
  try {
    const result = await predictPrice("ADAUSDT");
    console.log("\nAdvanced Price Prediction Results:");
    console.log("----------------------------------");
    console.log(`Symbol: ${result.symbol}`);
    console.log(`Current Price: $${result.currentPrice.toFixed(2)}`);
    console.log(`Predicted Price: $${result.predictedPrice.toFixed(2)}`);
    console.log(`Market Pattern: ${result.pattern}`);
    console.log(`Market Trend: ${result.trend}`);
    console.log(`Prediction Score: ${result.score.toFixed(2)}`);
    console.log(`Confidence: ${result.confidence.toFixed(2)}%`);
    console.log("\nDetailed Analytics:");
    console.log(`Momentum: ${result.analytics.momentum.toFixed(2)}%`);
    console.log(`Volatility: ${result.analytics.volatility.toFixed(2)}%`);
    console.log(
      `Pattern Strength: ${result.analytics.pattern.strength.toFixed(2)}%`
    );
    console.log(`RSI: ${result.analytics.technical.rsi.toFixed(2)}`);
    console.log(`Trend: ${result.analytics.trend}`);
  } catch (error: any) {
    console.error("Error in main:", error.message);
  }
}

// Only run main if directly executed
if (import.meta.main) {
  main();
}

function calculateSharpeRatio(prices: number[]) {
  try {
    const returns = prices
      .slice(1)
      .map((price, i) => (price - prices[i]) / prices[i]);
    const meanReturn = mean(returns);
    const stdReturn = standardDeviation(returns);
    const riskFreeRate = 0.02 / 365; // Assuming 2% annual risk-free rate

    return (meanReturn - riskFreeRate) / (stdReturn || 1);
  } catch (error) {
    console.error("Sharpe ratio calculation error:", error);
    return 0;
  }
}
