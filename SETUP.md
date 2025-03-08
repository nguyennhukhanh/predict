# Quant Trading Setup Guide

## Installation Instructions

1. Make sure you have [Bun](https://bun.sh/) installed. If not, install it with:
   ```bash
   curl -fsSL https://bun.sh/install | bash
   ```

2. Install dependencies:
   ```bash
   cd /predict
   bun install
   ```

3. Start the development server:
   ```bash
   bun dev
   ```

   Or for production:
   ```bash
   bun start
   ```

4. Access the application at `http://localhost:1505`

## API Documentation

### GET /api/predict

Generate a trading signal for a specified symbol and timeframe.

**Parameters:**
- `symbol` (string): Cryptocurrency pair (e.g., BTCUSDT)
- `timeframe` (string): Candle timeframe (15m, 30m, 1h, 4h, 1d)
- `strategy` (string): Trading strategy to use (trend-following, mean-reversion)

**Example:**
```
GET /api/predict?symbol=BTCUSDT&timeframe=1h&strategy=trend-following
```

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
      { "name": "RSI", "value": 58.2, "color": "#b2b5be" },
      { "name": "EMA200", "value": 49500, "color": "#26a69a" }
    ]
  },
  "historicalAccuracy": 0.72
}
```

### GET /api/strategies

Get available trading strategies.

**Example:**
```
GET /api/strategies
```

**Response:**
```json
[
  {
    "id": "trend-following",
    "name": "Trend Following Strategy", 
    "description": "Uses MACD and RSI to identify trends and momentum",
    "timeframes": ["15m", "30m", "1h", "4h", "1d"]
  },
  {
    "id": "mean-reversion",
    "name": "Mean Reversion Strategy",
    "description": "Uses Bollinger Bands and Stochastic RSI to identify overbought/oversold conditions",
    "timeframes": ["15m", "30m", "1h", "4h"]
  }
]
```

## Trading Strategies

### Trend Following Strategy

Uses momentum indicators to follow established trends:

- **Indicators**: MACD, RSI, EMA
- **Long Signal**: Price above EMA, MACD histogram positive, RSI < 70
- **Short Signal**: Price below EMA, MACD histogram negative, RSI > 30
- **Target calculation**: Based on ATR (Average True Range)
- **Stop loss calculation**: Based on ATR (Average True Range)

### Mean Reversion Strategy

Detects overbought/oversold conditions for potential trend reversals:

- **Indicators**: Bollinger Bands, Stochastic RSI
- **Long Signal**: Price near lower Bollinger Band (percentB < 0.2), StochRSI < 20
- **Short Signal**: Price near upper Bollinger Band (percentB > 0.8), StochRSI > 80
- **Target calculation**: Mid Bollinger Band
- **Stop loss calculation**: Percentage-based (2%)

## Troubleshooting

1. **Server won't start**
   - Ensure port 1505 is not in use
   - Check logs for errors: `bun dev --debug`

2. **API errors**
   - Verify Binance API is accessible from your network
   - Some symbols may not be available on Binance

3. **NaN indicator values**
   - This typically means insufficient historical data
   - Try a more common trading pair or shorter timeframe
