# Crypto Quant Trading Platform

A quantitative trading platform for cryptocurrency that provides trading signals for long/short positions based on technical analysis.

## Features

- Multiple trading strategies:
  - Trend Following Strategy: Uses MACD and RSI to identify trends and momentum
  - Mean Reversion Strategy: Uses Bollinger Bands and Stochastic RSI to identify overbought/oversold conditions
- Real-time market data from Binance API
- Technical indicators calculation
- Target price and stop loss recommendations
- Interactive UI with charts

## Installation

```bash
# Install dependencies
bun install

# Run in development mode
bun dev

# Run in production
bun start
```

## API Endpoints

### GET /api/predict

Generate a trading signal for a specified symbol and timeframe.

**Parameters:**
- `symbol` (string): Cryptocurrency pair (e.g., BTCUSDT)
- `timeframe` (string): Candle timeframe (15m, 1h, 4h, 1d)
- `strategy` (string): Trading strategy to use (trend-following, mean-reversion)

**Response:**
```json
{
  "symbol": "BTCUSDT",
  "timeframe": "1h",
  "timestamp": 1630000000000,
  "currentPrice": 50000,
  "prediction": {
    "direction": "long",
    "confidence": 0.85,
    "targetPrice": 52500,
    "stopLoss": 48750,
    "indicators": [
      { "name": "MACD", "value": 125.5, "color": "#26a69a" },
      { "name": "RSI", "value": 58.2, "color": "#b2b5be" }
    ]
  },
  "historicalAccuracy": 0.72
}
```

### GET /api/strategies

Get available trading strategies.

**Response:**
```json
[
  {
    "id": "trend-following",
    "name": "Trend Following Strategy", 
    "description": "Uses MACD and RSI to identify trends and momentum",
    "timeframes": ["1h", "4h", "1d"]
  },
  {
    "id": "mean-reversion",
    "name": "Mean Reversion Strategy",
    "description": "Uses Bollinger Bands and Stochastic RSI to identify overbought/oversold conditions",
    "timeframes": ["15m", "1h", "4h"]
  }
]
```

## Technologies Used

- Bun.js - JavaScript/TypeScript runtime
- TechnicalIndicators - Technical analysis library
- ApexCharts - Interactive charts
- TailwindCSS - Styling
- Binance API - Market data

## License

MIT
