import { serve } from "bun";
import { predictPrice } from "./prediction";
import { TimeInterval } from "./types";
import { file } from "bun";

const server = serve({
    port: 1505,
    async fetch(req) {
        const url = new URL(req.url);
        
        // Serve static HTML
        if (url.pathname === "/" || url.pathname === "/index.html") {
            return new Response(file("public/index.html"));
        }

        // Handle API requests
        if (url.pathname.startsWith("/predict/")) {
            const [, , symbol, intervalStr] = url.pathname.split("/");
            
            if (!symbol || !intervalStr || !Object.values(TimeInterval).includes(intervalStr as TimeInterval)) {
                return new Response(
                    JSON.stringify({ error: "Invalid interval or symbol" }), 
                    { 
                        status: 400,
                        headers: { 
                            "Content-Type": "application/json",
                            "Cache-Control": "no-cache"
                        }
                    }
                );
            }

            try {
                const predictions = await predictPrice(symbol, intervalStr as TimeInterval);
                
                if (!predictions || predictions.length === 0) {
                    throw new Error("No prediction data available");
                }

                const chartData = {
                    timestamps: predictions.map(p => p.timestamp),
                    prices: {
                        actual: predictions.map(p => ({
                            x: p.timestamp,
                            y: Number(p.actual.toFixed(8))
                        })).filter(p => p.y !== 0),
                        predicted: predictions.map(p => ({
                            x: p.timestamp,
                            y: Number(p.predicted.toFixed(8)),
                            recommendation: p.recommendation
                        })),
                        sma: predictions.map(p => ({
                            x: p.timestamp,
                            y: Number(p.indicators.sma.toFixed(8))
                        })),
                        ema: predictions.map(p => ({
                            x: p.timestamp,
                            y: Number(p.indicators.ema.toFixed(8))
                        }))
                    },
                    indicators: {
                        rsi: predictions.map(p => ({
                            x: p.timestamp,
                            y: Number(p.indicators.rsi.toFixed(2))
                        })),
                        macd: predictions.map(p => ({
                            x: p.timestamp,
                            macd: Number(p.indicators.macd.macd.toFixed(8)),
                            signal: Number(p.indicators.macd.signal.toFixed(8)),
                            histogram: Number(p.indicators.macd.histogram.toFixed(8))
                        }))
                    },
                    lastIndicators: predictions[predictions.length - 1].indicators,
                    lastRecommendation: predictions[predictions.length - 1].recommendation
                };

                return new Response(JSON.stringify(chartData), {
                    headers: { 
                        "Content-Type": "application/json",
                        "Cache-Control": "no-cache"
                    }
                });
            } catch (error: any) {
                return new Response(
                    JSON.stringify({ 
                        error: error.message || "Failed to process request"
                    }), 
                    {
                        status: 500,
                        headers: { "Content-Type": "application/json" }
                    }
                );
            }
        }

        return new Response("Not Found", { status: 404 });
    },
});

console.log(`Server running at http://localhost:${server.port}`);
