import type { MarketData, OHLCV } from "../types";
import BigDecimal from 'js-big-decimal';

/**
 * Enhances market data with additional metrics and signals to improve prediction accuracy
 * @param data Original market data
 * @returns Enhanced market data with additional properties
 */
export async function enhanceMarketData(data: MarketData): Promise<MarketData> {
  try {
    // Deep clone to avoid modifying original
    const enhancedData: MarketData = JSON.parse(JSON.stringify(data));
    
    // Add market sentiment data if not already present
    if (enhancedData.marketSentiment === undefined) {
      enhancedData.marketSentiment = await fetchMarketSentiment(enhancedData.symbol);
    }

    // Add on-chain metrics for crypto assets
    if (isCryptoAsset(enhancedData.symbol)) {
      enhancedData.onChainMetrics = await fetchOnChainMetrics(enhancedData.symbol);
    }

    // Add order flow data
    enhancedData.orderFlowData = await fetchOrderFlowData(enhancedData.symbol);

    return enhancedData;
  } catch (error) {
    console.error('Error enhancing market data:', error);
    return data; // Return original data if enhancement fails
  }
}

/**
 * Fetches market sentiment data from relevant sources
 * @param symbol The trading symbol to get sentiment for
 * @returns A sentiment score between -1 (extremely bearish) and 1 (extremely bullish)
 */
async function fetchMarketSentiment(symbol: string): Promise<number> {
  try {
    // This would ideally fetch from a sentiment analysis API
    // For now, we'll simulate with the Fear & Greed Index for crypto
    // or general market sentiment for stocks
    
    // Check if it's a crypto asset
    if (isCryptoAsset(symbol)) {
      try {
        const response = await fetch('https://api.alternative.me/fng/?limit=1');
        const data = await response.json();
        
        if (data && data.data && data.data.length > 0) {
          // Convert Fear & Greed index (0-100) to our scale (-1 to 1)
          return ((data.data[0].value - 50) / 50);
        }
      } catch (e) {
        console.log('Could not fetch Fear & Greed index, using fallback');
      }
    }
    
    // Fallback to simulated sentiment
    // In a real system, you'd use more sophisticated sentiment analysis
    // from news, social media, etc.
    return (Math.random() * 2 - 1) * 0.5;
  } catch (error) {
    console.error('Error fetching market sentiment:', error);
    return 0; // Neutral sentiment as fallback
  }
}

/**
 * Checks if a symbol is a crypto asset
 * @param symbol Symbol to check
 * @returns True if it's a crypto asset
 */
function isCryptoAsset(symbol: string): boolean {
  // Simple check - crypto assets typically end with common quote currencies
  const cryptoQuotes = ['USDT', 'BTC', 'ETH', 'BUSD', 'USDC'];
  return cryptoQuotes.some(quote => symbol.endsWith(quote));
}

/**
 * Fetches on-chain metrics for crypto assets
 * @param symbol Crypto symbol to fetch data for
 * @returns On-chain metrics like active addresses, transaction counts, etc.
 */
async function fetchOnChainMetrics(symbol: string): Promise<any> {
  try {
    // In a real implementation, this would call a blockchain data provider
    // like Glassnode, Santiment, IntoTheBlock, etc.
    
    // For now, we'll return simulated data
    const baseSymbol = symbol.replace(/USDT|BTC|ETH|BUSD|USDC/g, '');
    
    return {
      activeAddresses: Math.floor(Math.random() * 10000) + 5000,
      transactionCount: Math.floor(Math.random() * 50000) + 20000,
      networkHashRate: Math.floor(Math.random() * 1000) + 500,
      largeTransactions: Math.floor(Math.random() * 100) + 20,
      whaleRatio: (Math.random() * 0.4) + 0.3, // 30%-70% 
    };
  } catch (error) {
    console.error('Error fetching on-chain metrics:', error);
    return {};
  }
}

/**
 * Fetches order flow data from exchange APIs
 * @param symbol Symbol to fetch order flow for
 * @returns Order flow metrics
 */
async function fetchOrderFlowData(symbol: string): Promise<any> {
  try {
    // In a real implementation, this would use exchange API 
    // to fetch order book, recent trades, etc.
    
    // For now, we'll simulate order flow metrics
    // buyVolume vs sellVolume, order book imbalance, etc.
    
    const buyVolume = Math.random() * 1000 + 500;
    const sellVolume = Math.random() * 1000 + 500;
    const volumeRatio = buyVolume / sellVolume;
    
    const askDepth = Math.random() * 10000 + 5000;
    const bidDepth = Math.random() * 10000 + 5000;
    const depthRatio = bidDepth / askDepth;
    
    return {
      buyVolume,
      sellVolume,
      volumeRatio,
      askDepth,
      bidDepth,
      depthRatio,
      buySellImbalance: volumeRatio > 1 ? (volumeRatio - 1) : -(1 - volumeRatio)
    };
  } catch (error) {
    console.error('Error fetching order flow data:', error);
    return {};
  }
}

/**
 * Enhances a single prediction with additional context and metrics
 * @param prediction Original prediction result
 * @param data Enhanced market data
 * @returns Enhanced prediction with additional context
 */
export function enhancePrediction(prediction: any, data: MarketData): any {
  try {
    // Create a deep copy
    const enhancedPrediction = JSON.parse(JSON.stringify(prediction));
    
    // Add order flow insights
    if (data.orderFlowData) {
      const orderFlow = data.orderFlowData;
      
      // Add order flow based confidence adjustment
      if (prediction.prediction.direction === 'long' && orderFlow.buySellImbalance > 0.2) {
        // Strong buying pressure confirms long signal
        enhancedPrediction.prediction.confidence = 
          Math.min(0.95, prediction.prediction.confidence * (1 + orderFlow.buySellImbalance * 0.2));
        enhancedPrediction.orderFlowConfirmation = true;
      } else if (prediction.prediction.direction === 'short' && orderFlow.buySellImbalance < -0.2) {
        // Strong selling pressure confirms short signal
        enhancedPrediction.prediction.confidence = 
          Math.min(0.95, prediction.prediction.confidence * (1 + Math.abs(orderFlow.buySellImbalance) * 0.2));
        enhancedPrediction.orderFlowConfirmation = true;
      } else if ((prediction.prediction.direction === 'long' && orderFlow.buySellImbalance < -0.3) ||
                (prediction.prediction.direction === 'short' && orderFlow.buySellImbalance > 0.3)) {
        // Order flow contradicts signal, reduce confidence
        enhancedPrediction.prediction.confidence *= 0.85;
        enhancedPrediction.orderFlowContradiction = true;
      }
    }
    
    // Add on-chain insights for crypto
    if (data.onChainMetrics && isCryptoAsset(data.symbol)) {
      const metrics = data.onChainMetrics;
      
      // Checking if whale activity is high
      if (metrics.whaleRatio > 0.6) {
        enhancedPrediction.whaleActivity = true;
        // Whales accumulating often precedes price increase
        if (prediction.prediction.direction === 'long') {
          enhancedPrediction.prediction.confidence = 
            Math.min(0.95, prediction.prediction.confidence * 1.1);
        }
      }
    }
    
    // Recalculate historical accuracy with all factors
    enhancedPrediction.historicalAccuracy = prediction.historicalAccuracy * 
      (enhancedPrediction.orderFlowConfirmation ? 1.05 : 
      (enhancedPrediction.orderFlowContradiction ? 0.95 : 1));
    
    return enhancedPrediction;
  } catch (error) {
    console.error('Error enhancing prediction:', error);
    return prediction; // Return original if enhancement fails
  }
}
