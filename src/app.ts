import { serve } from "bun";
import { file } from "bun";
import { getPrediction, getAvailableStrategies } from "./prediction";

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
                const strategy = url.searchParams.get("strategy") as "trend-following" | "mean-reversion" || "trend-following";

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

                const prediction = await getPrediction(symbol, timeframe, strategy);

                return new Response(JSON.stringify(prediction), {
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
