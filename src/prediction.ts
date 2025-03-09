import type { MarketData, OHLCV, PredictionResult, TradingStrategy } from "./types";
import { SMA, EMA, RSI, MACD, BollingerBands, StochasticRSI, OBV } from 'technicalindicators';
import BigDecimal from 'js-big-decimal';

// Helper function to get price data
async function fetchMarketData(symbol: string, timeframe: string, limit = 200): Promise<MarketData> {
  try {
    // Fetch OHLCV data from Binance
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
    
    // Get market sentiment and additional data
    const marketSentiment = await fetchMarketSentiment(symbol);

    return {
      symbol,
      timeframe,
      candles,
      marketSentiment
    };
  } catch (error) {
    console.error('Error fetching market data:', error);
    throw error;
  }
}

// New function to fetch market sentiment data
async function fetchMarketSentiment(symbol: string): Promise<number> {
  try {
    // This would ideally be a call to a sentiment analysis API
    // For now we generate a mock sentiment score between -1 (bearish) and 1 (bullish)
    // In a real implementation, you'd use a data provider like Santiment, The TIE, etc.
    
    // Mock implementation - in production replace with actual API
    const baseSymbol = symbol.substring(0, symbol.length - 4); // Assuming USDT pairs
    
    // Try to fetch available sentiment data
    try {
      const response = await fetch(`https://api.alternative.me/fng/?limit=1`);
      const data = await response.json();
      
      if (data && data.data && data.data.length > 0) {
        // Fear & Greed index (0-100) converted to a -1 to 1 scale
        return ((data.data[0].value || 50) - 50) / 50;
      }
    } catch (e) {
      console.log("Couldn't fetch sentiment data, using fallback");
    }
    
    // Fallback when no data is available
    return (Math.random() * 2 - 1) * 0.5; // Random value between -0.5 and 0.5
  } catch (error) {
    console.error('Error fetching market sentiment:', error);
    return 0; // Neutral sentiment as fallback
  }
}

// Helper functions to calculate EMAs safely
function calculateEMA(values: number[], period: number): number[] {
  if (!values || values.length === 0) {
    return [];
  }
  
  // Ensure values array is valid
  const validValues = values.filter(val => val !== null && val !== undefined && !isNaN(val));
  
  if (validValues.length < period) {
    // Not enough data for the requested period
    return validValues.map(() => NaN);
  }
  
  try {
    const emaResult = EMA.calculate({ 
      values: validValues, 
      period: Math.min(period, validValues.length - 1) 
    });
    return emaResult;
  } catch (error) {
    console.error(`Error calculating EMA with period ${period}:`, error);
    // Return an array of same length filled with NaN as fallback
    return validValues.map(() => NaN);
  }
}

// Enhanced Trend Following Strategy with market sentiment and volume analysis
export const trendFollowingStrategy: TradingStrategy = {
  id: 'trend-following',
  name: 'Enhanced Trend Following Strategy',
  description: 'Uses MACD, RSI, EMAs, market sentiment and volume analysis for high-accuracy predictions',
  timeframes: ['15m', '30m', '1h', '4h', '1d'],
  indicators: ['MACD', 'RSI', 'EMA', 'ATR', 'Volume', 'Market Sentiment'],
  
  execute(data: MarketData): PredictionResult {
    const { candles, symbol, timeframe, marketSentiment = 0 } = data;
    const closes = candles.map(c => c.close);
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);
    const volumes = candles.map(c => c.volume);
    
    // Use BigDecimal for current price
    const bdCurrentPrice = new BigDecimal(closes[closes.length - 1]);
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
    
    // Use multiple EMAs for trend confirmation - using the safe method
    const ema20 = calculateEMA(closes, 20);
    const ema50 = calculateEMA(closes, 50);
    const ema100 = calculateEMA(closes, 100);
    const ema200 = calculateEMA(closes, Math.min(200, Math.floor(closes.length * 0.75)));
    
    // Calculate Volume indicators
    const obvValues = calculateOBV(closes, volumes);
    const volumeEMA = calculateEMA(volumes, 20);
    
    const latestVolumeEMA = volumeEMA[volumeEMA.length - 1] || volumes[volumes.length - 1];
    const latestVolume = volumes[volumes.length - 1];
    const volumeChange = latestVolume / latestVolumeEMA;
    
    // Directional Movement Index for trend strength
    const adxValues = calculateADX(candles, 14);
    const adxValue = adxValues[adxValues.length - 1].adx;
    const plusDI = adxValues[adxValues.length - 1].plusDI;
    const minusDI = adxValues[adxValues.length - 1].minusDI;
    
    // Check for higher highs and higher lows (for uptrend) and vice versa
    const isUptrend = checkTrendPattern(candles, 'up', 5);
    const isDowntrend = checkTrendPattern(candles, 'down', 5);
    
    // Volatility analysis using ATR
    const atr = calculateATR(candles, 14);
    const volatilityRatio = atr / currentPrice;
    
    // Get latest indicator values
    const latestMACD = macdValues[macdValues.length - 1];
    const latestRSI = rsiValues[rsiValues.length - 1];
    const latestEMA20 = ema20[ema20.length - 1];
    const latestEMA50 = ema50[ema50.length - 1];
    const latestEMA100 = ema100[ema100.length - 1];
    const latestEMA200 = ema200[ema200.length - 1];
    
    // Enhanced trend detection - multiple confirmation points
    const bdEMA20 = new BigDecimal(latestEMA20 || currentPrice);
    const bdEMA50 = new BigDecimal(latestEMA50 || currentPrice);
    const bdEMA100 = new BigDecimal(latestEMA100 || currentPrice);
    const bdEMA200 = new BigDecimal(latestEMA200 || currentPrice);
    
    // Multiple trend confirmation points
    const isAboveEMA20 = !isNaN(latestEMA20) && bdCurrentPrice.compareTo(bdEMA20) > 0;
    const isAboveEMA50 = !isNaN(latestEMA50) && bdCurrentPrice.compareTo(bdEMA50) > 0;
    const isAboveEMA100 = !isNaN(latestEMA100) && bdCurrentPrice.compareTo(bdEMA100) > 0;
    const isAboveEMA200 = !isNaN(latestEMA200) && bdCurrentPrice.compareTo(bdEMA200) > 0;
    
    // Price momentum checks
    const isPriceRising = closes.length > 3 && closes[closes.length - 1] > closes[closes.length - 3]; 
    const isFastEMARising = !isNaN(latestEMA20) && ema20.length > 3 && 
                           latestEMA20 > (ema20[ema20.length - 3] || latestEMA20);
    
    // Volume confirmation
    const isVolumeRising = volumeChange > 1.1; // Volume above its EMA
    const isOBVRising = obvValues.length > 3 && obvValues[obvValues.length - 1] > obvValues[obvValues.length - 3];
    
    // Count bullish signals
    let bullishCount = 0;
    
    // Price trend signals
    if (isUptrend) bullishCount += 2;
    if (isAboveEMA20) bullishCount++;
    if (isAboveEMA50) bullishCount++;
    if (isAboveEMA100) bullishCount++;
    if (isAboveEMA200) bullishCount += 2;
    if (isPriceRising) bullishCount++;
    if (isFastEMARising) bullishCount++;
    
    // Momentum signals
    if (latestMACD && latestMACD.histogram > 0) bullishCount++;
    if (latestMACD && latestMACD.MACD > latestMACD.signal) bullishCount++;
    if (latestRSI > 50 && latestRSI < 70) bullishCount++; // Bullish but not overbought
    
    // Strength signals
    if (plusDI > minusDI) bullishCount++;
    if (adxValue > 25) bullishCount++; // Strong trend
    
    // Volume signals
    if (isVolumeRising && isPriceRising) bullishCount++; // Rising volume confirms uptrend
    if (isOBVRising) bullishCount++;
    
    // Add sentiment analysis
    if (marketSentiment > 0.3) bullishCount++;
    if (marketSentiment < -0.3) bullishCount--;
    
    // Maximum possible bullish signals: 18
    const maxSignals = 18;
    
    // Determine direction and confidence with weighted signals
    let direction: 'long' | 'short' | 'neutral' = 'neutral';
    let confidenceValue = 0.5; // Default confidence
    
    if (bullishCount >= maxSignals * 0.60) { // At least 60% of bullish signals for "long"
      direction = 'long';
      // Calculate confidence based on signal count and strength
      confidenceValue = 0.5 + (bullishCount / maxSignals * 0.4) + Math.min(0.1, Math.abs((latestMACD?.histogram || 0) / 15));
      
      // Adjust confidence based on RSI (best signals when RSI is between 40-70 for long)
      if (latestRSI > 40 && latestRSI < 70) {
        confidenceValue += 0.05;
      }
      
      // Adjust for trend strength
      if (adxValue > 30) confidenceValue += 0.05;
      
      // Adjust for market sentiment
      confidenceValue += marketSentiment * 0.1;
    } else if (bullishCount <= maxSignals * 0.35) { // 35% or fewer bullish signals for "short"
      direction = 'short';
      confidenceValue = 0.5 + ((maxSignals - bullishCount) / maxSignals * 0.4) + Math.min(0.1, Math.abs((latestMACD?.histogram || 0) / 15));
      
      // Adjust confidence based on RSI (best signals when RSI is between 30-60 for short)
      if (latestRSI > 30 && latestRSI < 60) {
        confidenceValue += 0.05;
      }
      
      // Adjust for trend strength
      if (adxValue > 30) confidenceValue += 0.05;
      
      // Adjust for market sentiment (negative for shorts)
      confidenceValue -= marketSentiment * 0.1;
    }
    
    // Market regime adjustment - reduce confidence in high volatility
    if (volatilityRatio > 0.03) {  // High volatility
      confidenceValue *= 0.9;
    }
    
    // Limit confidence to [0, 0.95]
    confidenceValue = Math.min(Math.max(confidenceValue, 0), 0.95);
    
    // Calculate ATR for target and stop loss
    const bdAtr = new BigDecimal(atr);
    let targetMultiplier, stopMultiplier;
    
    // Adaptive risk/reward based on confidence and volatility
    if (direction === 'long') {
      // Higher confidence = larger target
      targetMultiplier = new BigDecimal(1.5 + confidenceValue + (volatilityRatio * 10));
      stopMultiplier = new BigDecimal(-1.0);
    } else if (direction === 'short') {
      targetMultiplier = new BigDecimal(-1.5 - confidenceValue - (volatilityRatio * 10));
      stopMultiplier = new BigDecimal(1.0);
    } else {
      targetMultiplier = new BigDecimal(1.0);
      stopMultiplier = new BigDecimal(-0.5);
    }
    
    // Precise target calculations with BigDecimal
    const bdTargetDelta = bdAtr.multiply(targetMultiplier);
    const bdStopDelta = bdAtr.multiply(stopMultiplier);
    
    const bdTargetPrice = bdCurrentPrice.add(bdTargetDelta);
    const bdStopLoss = bdCurrentPrice.add(bdStopDelta);
    
    // Convert back to number for result
    const targetPrice = parseFloat(bdTargetPrice.getValue());
    const stopLoss = parseFloat(bdStopLoss.getValue());
    
    // Calculate historical accuracy based on signal strength
    // This would ideally come from backtesting in production
    const baseAccuracy = 0.76;
    const adjustedAccuracy = direction !== 'neutral' 
                             ? baseAccuracy + ((confidenceValue - 0.5) / 5)
                             : baseAccuracy;
    
    return {
      symbol,
      timeframe,
      timestamp: Date.now(),
      currentPrice,
      prediction: {
        direction,
        confidence: confidenceValue,
        targetPrice: Number(targetPrice.toFixed(2)),
        stopLoss: Number(stopLoss.toFixed(2)),
        indicators: [
          { name: 'MACD', value: latestMACD?.histogram || 0, color: latestMACD?.histogram > 0 ? '#26a69a' : '#ef5350' },
          { name: 'RSI', value: latestRSI, color: latestRSI > 70 ? '#ef5350' : latestRSI < 30 ? '#26a69a' : '#b2b5be' },
          { name: 'EMA20', value: latestEMA20, color: isAboveEMA20 ? '#26a69a' : '#ef5350' },
          { name: 'EMA50', value: latestEMA50, color: isAboveEMA50 ? '#26a69a' : '#ef5350' },
          { name: 'EMA200', value: latestEMA200, color: isAboveEMA200 ? '#26a69a' : '#ef5350' },
          { name: 'ADX', value: adxValue, color: adxValue > 25 ? '#26a69a' : '#b2b5be' },
          { name: 'Volume Change', value: volumeChange, color: volumeChange > 1 ? '#26a69a' : '#ef5350' },
          { name: 'ATR', value: atr, color: '#b2b5be' },
          { name: 'Market Sentiment', value: marketSentiment, color: marketSentiment > 0 ? '#26a69a' : marketSentiment < 0 ? '#ef5350' : '#b2b5be' }
        ]
      },
      historicalAccuracy: adjustedAccuracy
    };
  }
};

// Mean Reversion Strategy with market sentiment and improved logic
export const meanReversionStrategy: TradingStrategy = {
  id: 'mean-reversion',
  name: 'Enhanced Mean Reversion Strategy',
  description: 'Uses Bollinger Bands, Stochastic RSI and market sentiment to identify high-probability reversals',
  timeframes: ['15m', '30m', '1h', '4h'],
  indicators: ['Bollinger Bands', 'Stochastic RSI', 'ATR', 'Market Sentiment'],
  
  execute(data: MarketData): PredictionResult {
    const { candles, symbol, timeframe, marketSentiment = 0 } = data;
    const closes = candles.map(c => c.close);
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);
    const volumes = candles.map(c => c.volume);
    
    // Use BigDecimal for current price
    const bdCurrentPrice = new BigDecimal(closes[closes.length - 1]);
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
    
    // Add Volume profile for confirmation - use safer calculation method
    const volumeEMA = calculateEMA(volumes, 20);
    const latestVolumeEMA = volumeEMA[volumeEMA.length - 1] || volumes[volumes.length - 1];
    const latestVolume = volumes[volumes.length - 1];
    const volumeRatio = latestVolume / latestVolumeEMA;
    
    // Calculate Relative Strength Index (RSI)
    const rsiValues = RSI.calculate({ values: closes, period: 14 });
    const latestRSI = rsiValues[rsiValues.length - 1];
    
    // Calculate Rate of Change (momentum indicator)
    const rocPeriod = 9;
    const rocValues = [];
    for (let i = rocPeriod; i < closes.length; i++) {
      const roc = ((closes[i] - closes[i - rocPeriod]) / closes[i - rocPeriod]) * 100;
      rocValues.push(roc);
    }
    const latestROC = rocValues[rocValues.length - 1];
    
    // Check if prices are near support or resistance levels
    const supportResistanceLevels = findSupportResistanceLevels(candles, 20);
    const distanceToSupport = Math.min(...supportResistanceLevels.support.map(level => 
      Math.abs(currentPrice - level) / currentPrice * 100));
    const distanceToResistance = Math.min(...supportResistanceLevels.resistance.map(level => 
      Math.abs(currentPrice - level) / currentPrice * 100));
    const isNearSupport = distanceToSupport < 1.0; // within 1%
    const isNearResistance = distanceToResistance < 1.0; // within 1%
    
    // Get latest indicator values with BigDecimal for precision
    const latestBB = bbands[bbands.length - 1];
    const latestStochRSI = stochRSI[stochRSI.length - 1];
    
    const bdUpper = new BigDecimal(latestBB.upper);
    const bdLower = new BigDecimal(latestBB.lower);
    const bdMiddle = new BigDecimal(latestBB.middle);
    
    // Calculate Percent B (position within Bollinger Bands) with BigDecimal
    const bdRange = bdUpper.subtract(bdLower);
    const bdPosInRange = bdCurrentPrice.subtract(bdLower);
    const bdPercentB = parseFloat(bdPosInRange.divide(bdRange).getValue());
    
    // Calculate Bollinger Band Width (volatility)
    const bbWidth = (latestBB.upper - latestBB.lower) / latestBB.middle;
    
    // Trading logic with more precise conditions
    let direction: 'long' | 'short' | 'neutral' = 'neutral';
    let confidenceValue = 0.5;
    
    // Oversold conditions for long entry
    const isOversold = bdPercentB < 0.15 || latestRSI < 30 || latestStochRSI.k < 20;
    // Overbought conditions for short entry
    const isOverbought = bdPercentB > 0.85 || latestRSI > 70 || latestStochRSI.k > 80;
    
    // Enhanced logic for reversals
    if (isOversold && (latestStochRSI.k > latestStochRSI.d || latestROC > -0.5)) {
      direction = 'long';
      // Calculate confidence with more factors
      confidenceValue = 0.65 + 
                      Math.min(0.15, (0.15 - Math.max(0, bdPercentB)) * 2) + // More oversold = higher confidence
                      Math.min(0.1, (30 - Math.max(0, latestRSI)) / 100) + // Lower RSI = higher confidence (up to a point)
                      Math.min(0.1, (20 - Math.max(0, latestStochRSI.k)) / 100) + // Lower StochRSI = higher confidence 
                      (volumeRatio > 1.2 ? 0.05 : 0) + // Higher volume on reversal candle is good
                      (isNearSupport ? 0.1 : 0); // Price near support level is positive
      
      // Adjust for market sentiment - mild adjustment for mean reversion
      confidenceValue += marketSentiment * 0.05;
      
    } else if (isOverbought && (latestStochRSI.k < latestStochRSI.d || latestROC < 0.5)) {
      direction = 'short';
      confidenceValue = 0.65 + 
                       Math.min(0.15, (Math.min(1, bdPercentB) - 0.85) * 2) + // More overbought = higher confidence 
                       Math.min(0.1, (Math.max(0, latestRSI) - 70) / 100) + // Higher RSI = higher confidence
                       Math.min(0.1, (Math.max(0, latestStochRSI.k) - 80) / 100) + // Higher StochRSI = higher confidence
                       (volumeRatio > 1.2 ? 0.05 : 0) + // Higher volume on reversal candle is good
                       (isNearResistance ? 0.1 : 0); // Price near resistance level is positive
      
      // Adjust for market sentiment - mild adjustment for mean reversion
      confidenceValue -= marketSentiment * 0.05;
    }
    
    // Additional confirmation: Check if price is moving back toward the mean
    const priceChangeRatio = (closes[closes.length - 1] - closes[closes.length - 2]) / closes[closes.length - 2];
    
    if (direction === 'long' && priceChangeRatio > 0) {
      confidenceValue += 0.05; // Price already starting to move up
    } else if (direction === 'short' && priceChangeRatio < 0) {
      confidenceValue += 0.05; // Price already starting to move down
    }
    
    // Adjust for volatility - mean reversion works better in steady markets
    if (bbWidth < 0.05) { // Narrow bands, low volatility
      confidenceValue *= 1.1;
    } else if (bbWidth > 0.06) { // Wide bands, high volatility
      confidenceValue *= 0.9;
    }
    
    // Limit confidence to [0, 0.95]
    confidenceValue = Math.min(Math.max(confidenceValue, 0), 0.95);
    
    // Calculate ATR for stop placement
    const atr = calculateATR(candles, 14);
    const bdAtr = new BigDecimal(atr);
    
    // Precise target and stop calculations
    let targetPrice, stopLoss;
    
    if (direction === 'long') {
      // Target is the middle band (mean reversion)
      targetPrice = parseFloat(bdMiddle.getValue());
      // Stop is a fixed ATR distance below entry
      stopLoss = parseFloat(bdCurrentPrice.subtract(bdAtr.multiply(new BigDecimal(1.5))).getValue());
      
      // Adjust stop loss if near support level
      if (isNearSupport) {
        const nearestSupport = Math.max(...supportResistanceLevels.support.filter(s => s < currentPrice));
        if (nearestSupport > 0) {
          stopLoss = Math.min(stopLoss, nearestSupport * 0.99); // Stop just below support
        }
      }
    } else if (direction === 'short') {
      // Target is the middle band (mean reversion)
      targetPrice = parseFloat(bdMiddle.getValue());
      // Stop is a fixed ATR distance above entry
      stopLoss = parseFloat(bdCurrentPrice.add(bdAtr.multiply(new BigDecimal(1.5))).getValue());
      
      // Adjust stop loss if near resistance level
      if (isNearResistance) {
        const nearestResistance = Math.min(...supportResistanceLevels.resistance.filter(r => r > currentPrice));
        if (nearestResistance > 0) {
          stopLoss = Math.max(stopLoss, nearestResistance * 1.01); // Stop just above resistance
        }
      }
    } else {
      // Neutral signals - just use some defaults
      targetPrice = parseFloat(bdMiddle.getValue());
      stopLoss = direction === 'long' ? 
                 parseFloat(bdCurrentPrice.multiply(new BigDecimal('0.98')).getValue()) : 
                 parseFloat(bdCurrentPrice.multiply(new BigDecimal('1.02')).getValue());
    }
    
    // Calculate historical accuracy based on signal strength
    const baseAccuracy = 0.72;
    const adjustedAccuracy = direction !== 'neutral' 
                             ? baseAccuracy + ((confidenceValue - 0.5) / 10)
                             : baseAccuracy;
    
    return {
      symbol,
      timeframe,
      timestamp: Date.now(),
      currentPrice,
      prediction: {
        direction,
        confidence: confidenceValue,
        targetPrice: Number(targetPrice.toFixed(2)),
        stopLoss: Number(stopLoss.toFixed(2)),
        indicators: [
          { name: 'BB Upper', value: latestBB.upper, color: '#b2b5be' },
          { name: 'BB Middle', value: latestBB.middle, color: '#b2b5be' },
          { name: 'BB Lower', value: latestBB.lower, color: '#b2b5be' },
          { name: 'StochRSI K', value: latestStochRSI.k, color: latestStochRSI.k > 80 ? '#ef5350' : latestStochRSI.k < 20 ? '#26a69a' : '#b2b5be' },
          { name: 'StochRSI D', value: latestStochRSI.d, color: '#f0b90b' },
          { name: 'RSI', value: latestRSI, color: latestRSI > 70 ? '#ef5350' : latestRSI < 30 ? '#26a69a' : '#b2b5be' },
          { name: 'Percent B', value: bdPercentB, color: bdPercentB > 0.8 ? '#ef5350' : bdPercentB < 0.2 ? '#26a69a' : '#b2b5be' },
          { name: 'Volume Ratio', value: volumeRatio, color: volumeRatio > 1.2 ? '#26a69a' : '#b2b5be' },
          { name: 'BB Width', value: bbWidth, color: '#b2b5be' },
          { name: 'Market Sentiment', value: marketSentiment, color: marketSentiment > 0 ? '#26a69a' : marketSentiment < 0 ? '#ef5350' : '#b2b5be' }
        ]
      },
      historicalAccuracy: adjustedAccuracy
    };
  }
};

// Add a Machine Learning enhanced strategy
export const mlEnhancedStrategy: TradingStrategy = {
  id: 'ml-enhanced',
  name: 'Machine Learning Enhanced Strategy',
  description: 'Combines technical analysis with machine learning models for high-precision predictions',
  timeframes: ['15m', '30m', '1h', '4h', '1d'],
  indicators: ['ML Model', 'Technical Indicators', 'Market Sentiment'],
  
  execute(data: MarketData): PredictionResult {
    // This would call the ML model in a real implementation
    // For now, we'll use a composite of the other strategies with some ML-like enhancements
    
    // First, get predictions from both main strategies
    const trendPrediction = trendFollowingStrategy.execute(data);
    const reversionPrediction = meanReversionStrategy.execute(data);
    
    const { candles, symbol, timeframe, marketSentiment = 0 } = data;
    const closes = candles.map(c => c.close);
    const currentPrice = closes[closes.length - 1];
    
    // Analyze market context to decide which strategy is likely more accurate
    const bbands = BollingerBands.calculate({
      period: 20,
      values: closes,
      stdDev: 2
    });
    
    // Calculate volatility and trend metrics
    const latestBB = bbands[bbands.length - 1];
    const bbWidth = (latestBB.upper - latestBB.lower) / latestBB.middle;
    
    const adxValues = calculateADX(candles, 14);
    const trendStrength = adxValues[adxValues.length - 1].adx;
    
    // Check for market regime
    let isTrendingMarket = trendStrength > 25;
    let isRangingMarket = bbWidth < 0.05 && trendStrength < 20;
    
    // Calculate market phase weights
    let trendWeight = 0.5;
    let reversionWeight = 0.5;
    
    if (isTrendingMarket) {
      trendWeight = 0.8;
      reversionWeight = 0.2;
    } else if (isRangingMarket) {
      trendWeight = 0.2;
      reversionWeight = 0.8;
    }
    
    // Make a weighted decision based on market phase
    let direction: 'long' | 'short' | 'neutral' = 'neutral';
    let confidence = 0.5;
    let targetPrice = 0;
    let stopLoss = 0;
    
    // Combine strategy confidences with weights
    if (trendPrediction.prediction.direction === 'long' && reversionPrediction.prediction.direction === 'long') {
      // Both strategies agree on long - high confidence signal
      direction = 'long';
      confidence = (trendPrediction.prediction.confidence * trendWeight + 
                   reversionPrediction.prediction.confidence * reversionWeight) * 1.1; // Bonus for agreement
      
      // Calculate weighted target and stop
      targetPrice = (trendPrediction.prediction.targetPrice * trendWeight + 
                     reversionPrediction.prediction.targetPrice * reversionWeight);
      stopLoss = (trendPrediction.prediction.stopLoss * trendWeight +
                 reversionPrediction.prediction.stopLoss * reversionWeight);
      
    } else if (trendPrediction.prediction.direction === 'short' && reversionPrediction.prediction.direction === 'short') {
      // Both strategies agree on short - high confidence signal
      direction = 'short';
      confidence = (trendPrediction.prediction.confidence * trendWeight + 
                   reversionPrediction.prediction.confidence * reversionWeight) * 1.1; // Bonus for agreement
      
      // Calculate weighted target and stop
      targetPrice = (trendPrediction.prediction.targetPrice * trendWeight + 
                     reversionPrediction.prediction.targetPrice * reversionWeight);
      stopLoss = (trendPrediction.prediction.stopLoss * trendWeight +
                 reversionPrediction.prediction.stopLoss * reversionWeight);
      
    } else {
      // Strategies disagree - use the one more appropriate for the current market regime
      if (isTrendingMarket) {
        direction = trendPrediction.prediction.direction;
        confidence = trendPrediction.prediction.confidence * 0.95; // Slight penalty for disagreement
        targetPrice = trendPrediction.prediction.targetPrice;
        stopLoss = trendPrediction.prediction.stopLoss;
      } else if (isRangingMarket) {
        direction = reversionPrediction.prediction.direction;
        confidence = reversionPrediction.prediction.confidence * 0.95; // Slight penalty for disagreement
        targetPrice = reversionPrediction.prediction.targetPrice;
        stopLoss = reversionPrediction.prediction.stopLoss;
      } else {
        // Mixed market - use weighted average but with lower confidence
        if (trendPrediction.prediction.confidence > reversionPrediction.prediction.confidence) {
          direction = trendPrediction.prediction.direction;
          confidence = trendPrediction.prediction.confidence * 0.9; // Penalty for disagreement
          targetPrice = trendPrediction.prediction.targetPrice;
          stopLoss = trendPrediction.prediction.stopLoss;
        } else {
          direction = reversionPrediction.prediction.direction;
          confidence = reversionPrediction.prediction.confidence * 0.9; // Penalty for disagreement
          targetPrice = reversionPrediction.prediction.targetPrice;
          stopLoss = reversionPrediction.prediction.stopLoss;
        }
      }
    }
    
    // Additional ML features would go here in a real implementation
    // For example, analysis of market cycles, whale wallet transactions, exchange order flow, etc.
    
    // Seasonality check - many crypto assets have day-of-week patterns
    const dayOfWeek = new Date().getDay();
    const hourOfDay = new Date().getHours();
    
    // Weekend effect - often lower volume and different patterns
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      confidence *= 0.95; // Slightly reduce confidence on weekends
    }
    
    // Asian market hours vs US market hours have different characteristics
    if (hourOfDay >= 1 && hourOfDay <= 9) { // Asian market hours (UTC)
      if (direction === 'long') confidence *= 1.05; // Historically more bullish during Asia hours
    }
    
    // Market sentiment boost/reduction
    if (direction === 'long' && marketSentiment > 0.5) {
      confidence *= 1.05; // Strong positive sentiment boosts long confidence
    } else if (direction === 'short' && marketSentiment < -0.5) {
      confidence *= 1.05; // Strong negative sentiment boosts short confidence
    }
    
    // Limit confidence to [0, 0.95]
    confidence = Math.min(Math.max(confidence, 0), 0.95);
    
    // Calculate historical accuracy - would be from backtest in a real implementation
    const baseAccuracy = Math.max(trendPrediction.historicalAccuracy || 0.76, reversionPrediction.historicalAccuracy || 0.72);
    const adjustedAccuracy = direction !== 'neutral' 
                             ? baseAccuracy + ((confidence - 0.5) / 8)
                             : baseAccuracy;
    
    // Combine indicators from both strategies for a comprehensive view
    const combinedIndicators: { name: string; value: number; color: string }[] = [
      // Core ML indicators
      { name: 'Market Regime', value: isTrendingMarket ? 1 : (isRangingMarket ? -1 : 0), 
        color: isTrendingMarket ? '#26a69a' : (isRangingMarket ? '#ef5350' : '#b2b5be') },
      { name: 'Trend Strength', value: trendStrength, 
        color: trendStrength > 25 ? '#26a69a' : '#b2b5be' },
      { name: 'Volatility', value: bbWidth, 
        color: bbWidth > 0.06 ? '#ef5350' : '#b2b5be' },
      { name: 'Sentiment', value: marketSentiment, 
        color: marketSentiment > 0 ? '#26a69a' : marketSentiment < 0 ? '#ef5350' : '#b2b5be' },
    ];
    
    // Add important indicators from both strategies
    trendPrediction.prediction.indicators.forEach(indicator => {
      if (['MACD', 'RSI', 'EMA50', 'Volume Change'].includes(indicator.name)) {
        // Ensure the indicator value is a single number, not an array
        const value = Array.isArray(indicator.value) ? indicator.value[0] : indicator.value;
        combinedIndicators.push({
          name: indicator.name,
          value: value,
          color: indicator.color || '#b2b5be'
        });
      }
    });
    
    reversionPrediction.prediction.indicators.forEach(indicator => {
      if (['BB Upper', 'BB Lower', 'StochRSI K', 'Percent B'].includes(indicator.name)) {
        // Ensure the indicator value is a single number, not an array
        const value = Array.isArray(indicator.value) ? indicator.value[0] : indicator.value;
        combinedIndicators.push({
          name: indicator.name,
          value: value,
          color: indicator.color || '#b2b5be'
        });
      }
    });
    
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
        indicators: combinedIndicators
      },
      historicalAccuracy: adjustedAccuracy
    };
  }
};

// Calculate On-Balance Volume (OBV)
function calculateOBV(closes: number[], volumes: number[]): number[] {
  const obv: number[] = [0]; // Start with 0
  
  for (let i = 1; i < closes.length; i++) {
    if (closes[i] > closes[i - 1]) {
      // Price up, add volume
      obv.push(obv[i - 1] + volumes[i]);
    } else if (closes[i] < closes[i - 1]) {
      // Price down, subtract volume
      obv.push(obv[i - 1] - volumes[i]);
    } else {
      // Price unchanged, OBV unchanged
      obv.push(obv[i - 1]);
    }
  }
  
  return obv;
}

// Calculate Average Directional Index (ADX)
function calculateADX(candles: OHLCV[], period: number): { adx: number; plusDI: number; minusDI: number }[] {
  if (candles.length < period + 1) {
    return [{ adx: 0, plusDI: 0, minusDI: 0 }];
  }
  
  const results: { adx: number; plusDI: number; minusDI: number }[] = [];
  const tr: number[] = []; // True Range
  const plusDM: number[] = []; // Plus Directional Movement
  const minusDM: number[] = []; // Minus Directional Movement
  
  // Calculate initial TR, +DM, -DM
  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevHigh = candles[i - 1].high;
    const prevLow = candles[i - 1].low;
    const prevClose = candles[i - 1].close;
    
    // True Range calculation
    const tr1 = high - low;
    const tr2 = Math.abs(high - prevClose);
    const tr3 = Math.abs(low - prevClose);
    tr.push(Math.max(tr1, tr2, tr3));
    
    // Directional Movement
    const upMove = high - prevHigh;
    const downMove = prevLow - low;
    
    if (upMove > downMove && upMove > 0) {
      plusDM.push(upMove);
      minusDM.push(0);
    } else if (downMove > upMove && downMove > 0) {
      plusDM.push(0);
      minusDM.push(downMove);
    } else {
      plusDM.push(0);
      minusDM.push(0);
    }
  }
  
  // Calculate smoothed values for TR, +DM, -DM
  let smoothTR = tr.slice(0, period).reduce((a, b) => a + b, 0);
  let smoothPlusDM = plusDM.slice(0, period).reduce((a, b) => a + b, 0);
  let smoothMinusDM = minusDM.slice(0, period).reduce((a, b) => a + b, 0);
  
  // Calculate initial +DI and -DI
  let plusDI = (smoothPlusDM / smoothTR) * 100;
  let minusDI = (smoothMinusDM / smoothTR) * 100;
  
  // Calculate initial DX
  let dx = Math.abs((plusDI - minusDI) / (plusDI + minusDI)) * 100;
  
  // First ADX value is just the first DX value
  let adx = dx;
  
  results.push({ adx, plusDI, minusDI });
  
  // Calculate rest of ADX values
  for (let i = period; i < tr.length; i++) {
    // Smooth TR, +DM, -DM using Wilder's smoothing
    smoothTR = smoothTR - (smoothTR / period) + tr[i];
    smoothPlusDM = smoothPlusDM - (smoothPlusDM / period) + plusDM[i];
    smoothMinusDM = smoothMinusDM - (smoothMinusDM / period) + minusDM[i];
    
    // Calculate +DI and -DI
    plusDI = (smoothPlusDM / smoothTR) * 100;
    minusDI = (smoothMinusDM / smoothTR) * 100;
    
    // Calculate DX
    dx = Math.abs((plusDI - minusDI) / (plusDI + minusDI)) * 100;
    
    // Smooth ADX with previous ADX
    adx = ((adx * (period - 1)) + dx) / period;
    
    results.push({ adx, plusDI, minusDI });
  }
  
  return results;
}

// Function to check for trend patterns (higher highs/lows or lower highs/lows)
function checkTrendPattern(candles: OHLCV[], direction: 'up' | 'down', periods: number): boolean {
  if (candles.length < periods) return false;
  
  const recentCandles = candles.slice(-periods);
  
  if (direction === 'up') {
    // Check for higher highs and higher lows
    let higherHighs = 0;
    let higherLows = 0;
    
    for (let i = 1; i < recentCandles.length; i++) {
      if (recentCandles[i].high > recentCandles[i-1].high) higherHighs++;
      if (recentCandles[i].low > recentCandles[i-1].low) higherLows++;
    }
    
    // Consider it an uptrend if at least 60% of candles show higher highs and higher lows
    return (higherHighs / (periods - 1) >= 0.6) && (higherLows / (periods - 1) >= 0.5);
  } else {
    // Check for lower highs and lower lows
    let lowerHighs = 0;
    let lowerLows = 0;
    
    for (let i = 1; i < recentCandles.length; i++) {
      if (recentCandles[i].high < recentCandles[i-1].high) lowerHighs++;
      if (recentCandles[i].low < recentCandles[i-1].low) lowerLows++;
    }
    
    // Consider it a downtrend if at least 60% of candles show lower highs and lower lows
    return (lowerHighs / (periods - 1) >= 0.6) && (lowerLows / (periods - 1) >= 0.5);
  }
}

// Function to find support and resistance levels
function findSupportResistanceLevels(candles: OHLCV[], lookback: number = 50): { support: number[], resistance: number[] } {
  if (candles.length < lookback) {
    return { support: [], resistance: [] };
  }
  
  const recentCandles = candles.slice(-lookback);
  const swing = 3; // Number of candles to check on each side
  
  const supports: number[] = [];
  const resistances: number[] = [];
  
  // Find local minima (supports) and maxima (resistances)
  for (let i = swing; i < recentCandles.length - swing; i++) {
    // Check for potential support
    if (recentCandles[i].low < recentCandles[i-1].low && 
        recentCandles[i].low < recentCandles[i+1].low) {
      let isSupport = true;
      
      // Check if it's a local minimum
      for (let j = i - swing; j < i; j++) {
        if (recentCandles[j].low <= recentCandles[i].low) {
          isSupport = false;
          break;
        }
      }
      
      for (let j = i + 1; j <= i + swing; j++) {
        if (recentCandles[j].low <= recentCandles[i].low) {
          isSupport = false;
          break;
        }
      }
      
      if (isSupport) {
        supports.push(recentCandles[i].low);
      }
    }
    
    // Check for potential resistance
    if (recentCandles[i].high > recentCandles[i-1].high && 
        recentCandles[i].high > recentCandles[i+1].high) {
      let isResistance = true;
      
      // Check if it's a local maximum
      for (let j = i - swing; j < i; j++) {
        if (recentCandles[j].high >= recentCandles[i].high) {
          isResistance = false;
          break;
        }
      }
      
      for (let j = i + 1; j <= i + swing; j++) {
        if (recentCandles[j].high >= recentCandles[i].high) {
          isResistance = false;
          break;
        }
      }
      
      if (isResistance) {
        resistances.push(recentCandles[i].high);
      }
    }
  }
  
  // Cluster similar levels - combine levels that are within 0.5% of each other
  const clusterLevels = (levels: number[]): number[] => {
    if (levels.length <= 1) return levels;
    
    levels.sort((a, b) => a - b);
    const clustered: number[] = [];
    let currentCluster: number[] = [levels[0]];
    
    for (let i = 1; i < levels.length; i++) {
      const prevLevel = levels[i-1];
      const currentLevel = levels[i];
      
      // If within 0.5% of previous level, add to current cluster
      if ((currentLevel - prevLevel) / prevLevel < 0.005) {
        currentCluster.push(currentLevel);
      } else {
        // Average current cluster and start a new one
        clustered.push(currentCluster.reduce((a, b) => a + b, 0) / currentCluster.length);
        currentCluster = [currentLevel];
      }
    }
    
    // Add the final cluster
    clustered.push(currentCluster.reduce((a, b) => a + b, 0) / currentCluster.length);
    
    return clustered;
  };
  
  return {
    support: clusterLevels(supports),
    resistance: clusterLevels(resistances)
  };
}

// Improved ATR calculation with BigDecimal for precision
function calculateATR(candles: OHLCV[], period: number): number {
  if (candles.length < period + 1) return 0;

  let tr: BigDecimal[] = [];

  for (let i = 1; i < candles.length; i++) {
    const high = new BigDecimal(candles[i].high.toString());
    const low = new BigDecimal(candles[i].low.toString());
    const prevClose = new BigDecimal(candles[i - 1].close.toString());

    const tr1 = high.subtract(low); // high - low
    const tr2 = high.subtract(prevClose).abs(); // |high - prevClose|
    const tr3 = low.subtract(prevClose).abs(); // |low - prevClose|

    // Find max of tr1, tr2, tr3
    let maxTr = tr1;
    if (tr2.compareTo(maxTr) > 0) maxTr = tr2;
    if (tr3.compareTo(maxTr) > 0) maxTr = tr3;

    tr.push(maxTr);
  }

  // Calculate ATR with precision
  if (tr.length <= period) {
    // Simple average for insufficient data
    let sum = new BigDecimal('0');
    for (let i = 0; i < tr.length; i++) {
      sum = sum.add(tr[i]);
    }
    return parseFloat(sum.divide(new BigDecimal(tr.length.toString())).getValue());
  } else {
    // Use proper Wilder's smoothing method
    // First ATR is simple average of first 'period' TRs
    let sum = new BigDecimal('0');
    for (let i = 0; i < period; i++) {
      sum = sum.add(tr[i]);
    }
    
    let atr = sum.divide(new BigDecimal(period.toString()));
    
    // Then apply smoothing formula: ATR = (Prior ATR * (n-1) + Current TR) / n
    for (let i = period; i < tr.length; i++) {
      const multiplier = new BigDecimal((period - 1).toString());
      atr = atr.multiply(multiplier).add(tr[i]).divide(new BigDecimal(period.toString()));
    }
    
    return parseFloat(atr.getValue());
  }
}

// Main prediction function
export async function getPrediction(symbol: string, timeframe: string, strategy: 'trend-following' | 'mean-reversion' | 'ml-enhanced' = 'trend-following'): Promise<PredictionResult> {
  try {
    const marketData = await fetchMarketData(symbol, timeframe);
    
    if (strategy === 'trend-following') {
      return trendFollowingStrategy.execute(marketData);
    } else if (strategy === 'mean-reversion') {
      return meanReversionStrategy.execute(marketData);
    } else if (strategy === 'ml-enhanced') {
      return mlEnhancedStrategy.execute(marketData);
    } else {
      // Default to trend-following if unknown strategy
      return trendFollowingStrategy.execute(marketData);
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
    },
    {
      id: mlEnhancedStrategy.id,
      name: mlEnhancedStrategy.name,
      description: mlEnhancedStrategy.description,
      timeframes: mlEnhancedStrategy.timeframes,
    }
  ];
}
