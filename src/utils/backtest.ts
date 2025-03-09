import type { OHLCV, MarketData, TradingStrategy, BacktestResult } from '../types';
import BigDecimal from 'js-big-decimal';

/**
 * Performs a backtest of a trading strategy on historical data
 * @param strategy The trading strategy to backtest
 * @param marketData Historical market data to test on
 * @param startIndex Index to start the backtest from (to account for indicator warmup period)
 * @returns Backtest results including statistics and individual trades
 */
export function backtest(
  strategy: TradingStrategy, 
  marketData: MarketData, 
  startIndex: number = 50
): BacktestResult {
  // Ensure we have enough data for backtesting
  if (!marketData || !marketData.candles || marketData.candles.length <= startIndex) {
    throw new Error("Insufficient data for backtesting");
  }

  const { symbol, timeframe, candles } = marketData;
  const trades: BacktestResult['trades'] = [];
  
  let activePosition: {
    entry: {
      timestamp: number;
      price: number;
      direction: 'long' | 'short';
      index: number;
    };
    targetPrice: number;
    stopLoss: number;
  } | null = null;
  
  // Loop through each candle for testing (skipping the first few for indicator calculation)
  for (let i = startIndex; i < candles.length; i++) {
    const testCandles = candles.slice(0, i + 1);
    const testMarketData: MarketData = {
      ...marketData,
      candles: testCandles
    };
    
    // If we have an active position, check if we hit target or stop
    if (activePosition) {
      const candle = candles[i];
      
      if (activePosition.entry.direction === 'long') {
        // Check if target hit (high >= target)
        if (candle.high >= activePosition.targetPrice) {
          trades.push({
            entry: {
              timestamp: activePosition.entry.timestamp,
              price: activePosition.entry.price,
              direction: activePosition.entry.direction
            },
            exit: {
              timestamp: candle.time,
              price: activePosition.targetPrice,
              reason: 'target'
            },
            profitLoss: activePosition.targetPrice - activePosition.entry.price,
            profitLossPercent: (activePosition.targetPrice - activePosition.entry.price) / activePosition.entry.price * 100
          });
          activePosition = null;
          continue;
        }
        
        // Check if stop hit (low <= stop)
        if (candle.low <= activePosition.stopLoss) {
          trades.push({
            entry: {
              timestamp: activePosition.entry.timestamp,
              price: activePosition.entry.price,
              direction: activePosition.entry.direction
            },
            exit: {
              timestamp: candle.time,
              price: activePosition.stopLoss,
              reason: 'stop'
            },
            profitLoss: activePosition.stopLoss - activePosition.entry.price,
            profitLossPercent: (activePosition.stopLoss - activePosition.entry.price) / activePosition.entry.price * 100
          });
          activePosition = null;
          continue;
        }
      } else { // Short position
        // Check if target hit (low <= target)
        if (candle.low <= activePosition.targetPrice) {
          trades.push({
            entry: {
              timestamp: activePosition.entry.timestamp,
              price: activePosition.entry.price,
              direction: activePosition.entry.direction
            },
            exit: {
              timestamp: candle.time,
              price: activePosition.targetPrice,
              reason: 'target'
            },
            profitLoss: activePosition.entry.price - activePosition.targetPrice,
            profitLossPercent: (activePosition.entry.price - activePosition.targetPrice) / activePosition.entry.price * 100
          });
          activePosition = null;
          continue;
        }
        
        // Check if stop hit (high >= stop)
        if (candle.high >= activePosition.stopLoss) {
          trades.push({
            entry: {
              timestamp: activePosition.entry.timestamp,
              price: activePosition.entry.price,
              direction: activePosition.entry.direction
            },
            exit: {
              timestamp: candle.time,
              price: activePosition.stopLoss,
              reason: 'stop'
            },
            profitLoss: activePosition.entry.price - activePosition.stopLoss,
            profitLossPercent: (activePosition.entry.price - activePosition.stopLoss) / activePosition.entry.price * 100
          });
          activePosition = null;
          continue;
        }
      }
      
      // If we've reached max holding period (e.g., 10 candles), close position at market
      if (i - activePosition.entry.index >= 10) {
        const exitPrice = candles[i].close;
        const pnl = activePosition.entry.direction === 'long' 
          ? exitPrice - activePosition.entry.price 
          : activePosition.entry.price - exitPrice;
        const pnlPercent = pnl / activePosition.entry.price * 100;
        
        trades.push({
          entry: {
            timestamp: activePosition.entry.timestamp,
            price: activePosition.entry.price,
            direction: activePosition.entry.direction
          },
          exit: {
            timestamp: candle.time,
            price: exitPrice,
            reason: 'signal'
          },
          profitLoss: pnl,
          profitLossPercent: pnlPercent
        });
        activePosition = null;
      }
    }
    
    // If no active position, check for new signals from the strategy
    if (!activePosition) {
      try {
        const prediction = strategy.execute(testMarketData);
        
        // Only enter positions with confidence > 0.65 for backtest
        if (prediction.prediction.confidence > 0.65 && prediction.prediction.direction !== 'neutral') {
          activePosition = {
            entry: {
              timestamp: candles[i].time,
              price: candles[i].close,
              direction: prediction.prediction.direction,
              index: i
            },
            targetPrice: prediction.prediction.targetPrice,
            stopLoss: prediction.prediction.stopLoss
          };
        }
      } catch (error) {
        console.error(`Backtest error at candle ${i}:`, error);
      }
    }
  }
  
  // Calculate backtest statistics
  const completedTrades = trades.filter(trade => trade.exit);
  const winningTrades = completedTrades.filter(trade => (trade.profitLoss || 0) > 0);
  const losingTrades = completedTrades.filter(trade => (trade.profitLoss || 0) < 0);
  
  const winRate = winningTrades.length / completedTrades.length || 0;
  
  const totalGain = winningTrades.reduce((sum, trade) => sum + (trade.profitLoss || 0), 0);
  const totalLoss = Math.abs(losingTrades.reduce((sum, trade) => sum + (trade.profitLoss || 0), 0));
  
  // Calculate profit factor (total gain / total loss)
  const profitFactor = totalLoss > 0 ? totalGain / totalLoss : totalGain > 0 ? Infinity : 0;
  
  // Calculate max drawdown
  let maxDrawdown = 0;
  let peak = 0;
  let balance = 0;
  
  for (const trade of completedTrades) {
    balance += trade.profitLoss || 0;
    
    if (balance > peak) {
      peak = balance;
    }
    
    const drawdown = (peak - balance) / peak;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }
  
  return {
    strategy: strategy.id,
    symbol,
    timeframe,
    startDate: new Date(candles[startIndex].time).toISOString().split('T')[0],
    endDate: new Date(candles[candles.length - 1].time).toISOString().split('T')[0],
    totalTrades: completedTrades.length,
    winRate,
    profitFactor,
    maxDrawdown,
    trades
  };
}

/**
 * Fetch historical data for backtesting
 * @param symbol Symbol to fetch data for
 * @param timeframe Timeframe to fetch data
 * @param limit Number of candles to fetch
 */
export async function fetchHistoricalData(
  symbol: string, 
  timeframe: string, 
  limit: number = 1000
): Promise<MarketData> {
  try {
    // Enhanced error handling
    const response = await fetch(
      `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${timeframe}&limit=${limit}`
    );
    
    if (!response.ok) {
      throw new Error(`Error fetching historical data: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Validate data structure
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error("Invalid data format received from API");
    }
    
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
    console.error('Error fetching historical data:', error);
    throw error;
  }
}

/**
 * Run a quick backtest for a given strategy to help calculate expected accuracy
 * @param strategy Strategy to test
 * @param symbol Symbol to test on
 * @param timeframe Timeframe to test
 */
export async function calculateStrategyAccuracy(
  strategy: TradingStrategy,
  symbol: string,
  timeframe: string
): Promise<number> {
  try {
    const data = await fetchHistoricalData(symbol, timeframe);
    const results = backtest(strategy, data);
    
    return results.winRate;
  } catch (error) {
    console.error('Error calculating strategy accuracy:', error);
    return 0.5; // Neutral default
  }
}