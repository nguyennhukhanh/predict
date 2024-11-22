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

const binance = new Binance().options({});

interface PricePattern {
  pattern: string;
  strength: number;
}

interface MLPrediction {
  price: number;
  probability: number;
  timeframe: string;
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
  const signal = calculateEMA([macd], 9);
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

function calculateAdvancedStats(prices: number[]) {
  try {
    return {
      variance: Math.min(variance(prices), prices[prices.length - 1] * 0.1),
      skewness: normalizeValue(sampleSkewness(prices)),
      kurtosis: normalizeValue(sampleKurtosis(prices)),
      quartiles: {
        q1: quantile(prices, 0.25),
        q2: quantile(prices, 0.5),
        q3: quantile(prices, 0.75),
      },
      density: kernelDensityEstimation(prices, "gaussian"),
      harmonicMean: harmonicMean(prices.filter((p) => p > 0)),
      geometricMean: geometricMean(prices.filter((p) => p > 0)),
    };
  } catch (error) {
    console.error("Stats calculation error:", error);
    return {
      variance: 0,
      skewness: 0,
      kurtosis: 0,
      quartiles: { q1: 0, q2: 0, q3: 0 },
      density: kernelDensityEstimation([1], "gaussian"),
      harmonicMean: 0,
      geometricMean: 0,
    };
  }
}

function identifyPricePatterns(prices: number[]): PricePattern {
  const recent = prices.slice(-10);
  const regression = linearRegression(recent.map((p, i) => [i, p]));
  const slope = regression.m;
  // Sửa cách sử dụng kernelDensityEstimation và xử lý kết quả
  const densityFn = kernelDensityEstimation(recent, "gaussian");
  const densityValues = recent.map((p) => densityFn(p));
  const volatility = standardDeviation(recent) / mean(recent);

  let pattern = "UNKNOWN";
  let strength = 0;

  // Sửa logic kiểm tra density
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

  // RSI confidence (higher near extremes)
  const rsiConfidence =
    rsi > 70 || rsi < 30 ? 85 : rsi > 65 || rsi < 35 ? 75 : 60;

  // Trend confidence based on strength and MACD confirmation
  const trendConfidence =
    trend.strength * (Math.sign(macd.histogram) === Math.sign(score) ? 1 : 0.5);

  // Pattern confidence with volatility adjustment
  const patternConfidence = pattern.strength * (1 - volatility);

  // Calculate weighted confidence
  const confidence =
    rsiConfidence * 0.3 + trendConfidence * 0.4 + patternConfidence * 0.3;

  // Reduce confidence based on volatility
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

async function predictPrice(symbol = "BTCUSDT", interval = "1h") {
  try {
    // Validate symbol
    if (!symbol || typeof symbol !== "string") {
      throw new Error("Invalid symbol");
    }

    const klines = await binance.candlesticks(symbol, interval, false, {
      limit: 200,
    });
    if (!klines || klines.length === 0) {
      throw new Error("No data available for this symbol");
    }

    const prices = klines.map((k: any) => Number(k[4]));
    const volumes = klines.map((k: any) => Number(k[5]));

    // Thêm kiểm tra giá trị hợp lệ
    if (
      prices.some((p: any) => !p || isNaN(p)) ||
      volumes.some((v: any) => !v || isNaN(v))
    ) {
      throw new Error("Invalid price or volume data");
    }

    // Advanced Technical Analysis
    const macd = calculateMACD(prices);
    const rsi = calculateRSI(prices);
    const bb = calculateBollingerBands(prices);
    const trend = detectTrend(prices);
    const currentPrice = prices[prices.length - 1];

    const stats = calculateAdvancedStats(prices);
    const pattern = identifyPricePatterns(prices);

    // Enhanced scoring with volatility adjustment
    let score = 0;
    const volatility = Math.min(stats.variance / currentPrice, 0.1); // Cap at 10%
    const momentum = Math.min(
      Math.abs(stats.geometricMean / (stats.harmonicMean || currentPrice) - 1),
      0.05 // Cap at 5%
    );
    const volatilityFactor = 1 - Math.min(volatility * 10, 0.8);

    // Trend Analysis (30%)
    score += trend.strength * 0.3 * volatilityFactor;

    // Pattern Analysis (20%)
    score += pattern.strength * 0.2 * volatilityFactor;

    // RSI Analysis (20%)
    const rsiScore =
      rsi < 30 ? 20 : rsi > 70 ? -20 : ((50 - Math.abs(rsi - 50)) / 50) * 20;
    score += rsiScore * volatilityFactor;

    // MACD Analysis (15%)
    const macdScore =
      15 *
      Math.sign(macd.histogram) *
      Math.min(Math.abs(macd.histogram / currentPrice), 0.01) *
      100;
    score += macdScore * volatilityFactor;

    // Volume Analysis (15%)
    const volumeMA = mean(volumes.slice(-20));
    const volumeScore = volumes[volumes.length - 1] > volumeMA ? 15 : -15;
    score += volumeScore * volatilityFactor;

    // Normalize score
    score = normalizeValue(score, -100, 100);

    // Calculate predicted movement with more conservative limits
    const maxDailyMove = currentPrice * 0.05; // Max 5% move
    const predictedMove =
      Math.min(
        Math.abs(volatility * (score / 100) * currentPrice),
        maxDailyMove
      ) *
      (1 + momentum * 0.5); // Momentum impact reduced by 50%

    const predictedPrice =
      score >= 0
        ? currentPrice * (1 + predictedMove / currentPrice)
        : currentPrice * (1 - predictedMove / currentPrice);

    // Calculate confidence with new function
    const confidence = calculateConfidence({
      score,
      rsi,
      trend,
      pattern,
      volatility,
      macd,
      currentPrice,
    });

    // Add Ichimoku Cloud analysis
    const ichimoku = calculateIchimokuCloud(prices);
    const stochRSI = calculateStochRSI(prices);

    // Enhanced scoring system
    // Volume Profile Analysis (10%)
    const volumeProfile = calculateVolumeProfile(prices, volumes);
    score += volumeProfile.score * 0.1;

    // Market Depth Analysis (10%)
    let depthAnalysis;
    try {
      const depth = await binance.depth(symbol);
      depthAnalysis = analyzeMarketDepth(depth);
    } catch (error) {
      console.warn("Market depth analysis failed:", error);
      depthAnalysis = {
        score: 0,
        buyPressure: 0,
        sellPressure: 0,
        imbalance: 0,
      };
    }
    score += depthAnalysis.score * 0.1;

    // Order Flow Analysis (15%)
    const orderFlow = analyzeOrderFlow(prices, volumes);
    score += orderFlow.score * 0.15;

    return {
      symbol,
      currentPrice: formatPrice(currentPrice, symbol),
      predictedPrice: formatPrice(predictedPrice, symbol),
      trend: trend.trend,
      pattern: pattern.pattern,
      confidence,
      score,
      analytics: {
        technical: {
          macd,
          rsi,
          bollingerBands: bb,
        },
        statistical: stats,
        pattern,
        trendStrength: trend.strength,
        volatility: normalizeValue(volatility * 100, 0, 100),
        momentum: normalizeValue(momentum * 100, 0, 100),
        ichimoku,
        stochRSI,
        volumeProfile,
        depthAnalysis,
        orderFlow,
        risk: calculateRiskMetrics(prices, predictedPrice, confidence),
        signals: generateTradingSignals({
          price: currentPrice,
          ichimoku,
          macd,
          rsi: stochRSI,
          trend,
        }),
      },
    };
  } catch (error: any) {
    console.error("Prediction error:", error);
    throw new Error(`Failed to predict price: ${error.message}`);
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
    console.log(
      `Skewness: ${result.analytics.statistical.skewness.toFixed(4)}`
    );
    console.log(
      `Kurtosis: ${result.analytics.statistical.kurtosis.toFixed(4)}`
    );
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
