import { serve } from "bun";
import { file } from "bun";
import { getPrediction, getAvailableStrategies } from "./prediction";
import { backtest, fetchHistoricalData, calculateStrategyAccuracy } from "./utils/backtest";
import { enhanceMarketData, enhancePrediction } from "./utils/dataEnhancer";

// Rate limiter to prevent abuse
import { RateLimiter } from "limiter";
const limiter = new RateLimiter({ tokensPerInterval: 50, interval: "minute" });

const server = serve({
    port: 1505,
    async fetch(req) {
        const url = new URL(req.url);

        // Apply rate limiting
        if (!await limiter.removeTokens(1)) {
            return new Response("Too many requests", { status: 429 });
        }

        try {
            // Serve static HTML
            if (url.pathname === "/" || url.pathname === "/index.html") {
                return new Response(file("public/index.html"));
            }

            // Serve static JS
            if (url.pathname === "/app.js") {
                return new Response(file("public/app.js"), {
                    headers: { "Content-Type": "application/javascript" }
                });
            }

            // API endpoints
            if (url.pathname === "/api/strategies") {
                return new Response(JSON.stringify(getAvailableStrategies()), {
                    headers: { "Content-Type": "application/json" }
                });
            }

            // Handle prediction requests
            if (url.pathname === "/api/predict") {
                const symbol = url.searchParams.get("symbol")?.toUpperCase() || "BTCUSDT";
                const timeframe = url.searchParams.get("timeframe") || "1h";
                const strategy = url.searchParams.get("strategy") as "trend-following" | "mean-reversion" | "ml-enhanced" || "trend-following";
                const enhance = url.searchParams.get("enhance") === "true";

                // Validate inputs
                if (!/^[A-Z0-9]{2,20}$/.test(symbol)) {
                    return new Response(JSON.stringify({ error: "Invalid symbol" }), {
                        status: 400,
                        headers: { "Content-Type": "application/json" }
                    });
                }

                if (!["1m", "5m", "15m", "30m", "1h", "4h", "1d"].includes(timeframe)) {
                    return new Response(JSON.stringify({ error: "Invalid timeframe" }), {
                        status: 400,
                        headers: { "Content-Type": "application/json" }
                    });
                }

                // Get prediction with or without enhancement
                let prediction = await getPrediction(symbol, timeframe, strategy);
                
                // Apply data enhancement if requested
                if (enhance) {
                    const marketData = await fetchHistoricalData(symbol, timeframe);
                    const enhancedData = await enhanceMarketData(marketData);
                    prediction = enhancePrediction(prediction, enhancedData);
                }

                return new Response(JSON.stringify(prediction), {
                    headers: { "Content-Type": "application/json" }
                });
            }
            
            // Handle backtest requests
            if (url.pathname === "/api/backtest") {
                const symbol = url.searchParams.get("symbol")?.toUpperCase() || "BTCUSDT";
                const timeframe = url.searchParams.get("timeframe") || "1h";
                const strategyId = url.searchParams.get("strategy") || "trend-following";
                const limit = parseInt(url.searchParams.get("limit") || "1000", 10);
                
                // Validate inputs
                if (!/^[A-Z0-9]{2,20}$/.test(symbol)) {
                    return new Response(JSON.stringify({ error: "Invalid symbol" }), {
                        status: 400,
                        headers: { "Content-Type": "application/json" }
                    });
                }

                if (!["5m", "15m", "30m", "1h", "4h", "1d"].includes(timeframe)) {
                    return new Response(JSON.stringify({ error: "Invalid timeframe" }), {
                        status: 400,
                        headers: { "Content-Type": "application/json" }
                    });
                }
                
                // Get strategy
                const strategies = getAvailableStrategies();
                const strategy = strategies.find(s => s.id === strategyId);
                
                if (!strategy) {
                    return new Response(JSON.stringify({ error: "Invalid strategy" }), {
                        status: 400,
                        headers: { "Content-Type": "application/json" }
                    });
                }
                
                // Fetch historical data
                const data = await fetchHistoricalData(symbol, timeframe, limit);
                
                // Get the full strategy implementation
                const fullStrategy = await import('./prediction').then(mod => {
                    if (strategyId === 'trend-following') return mod.trendFollowingStrategy;
                    if (strategyId === 'mean-reversion') return mod.meanReversionStrategy;
                    if (strategyId === 'ml-enhanced') return mod.mlEnhancedStrategy;
                    return mod.trendFollowingStrategy; // Default
                });
                
                // Run backtest
                const result = backtest(fullStrategy, data);
                
                return new Response(JSON.stringify(result), {
                    headers: { "Content-Type": "application/json" }
                });
            }

            // 404 for everything else
            return new Response("Not Found", { status: 404 });

        } catch (error) {
            console.error("Server error:", error);
            return new Response(JSON.stringify({ error: "Internal server error" }), {
                status: 500,
                headers: { "Content-Type": "application/json" }
            });
        }
    },
});

console.log(`Quant Trading Server running at http://localhost:${server.port}`);
