import { predictPrice } from "./predict";
import { RateLimiter } from "limiter";

// Rate limiter: 30 requests per minute
const limiter = new RateLimiter({ tokensPerInterval: 30, interval: "minute" });

Bun.serve({
  development: true,
  port: process.env.PORT ? parseInt(process.env.PORT) : 1505,
  async fetch(req) {
    try {
      // Add CORS headers
      const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      };

      // Handle OPTIONS request for CORS
      if (req.method === 'OPTIONS') {
        return new Response(null, { headers });
      }

      // Check rate limit
      const hasToken = limiter.tryRemoveTokens(1);
      if (!hasToken) {
        return new Response(
          JSON.stringify({
            error: "Rate limit exceeded. Please try again later.",
          }),
          {
            status: 429,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      const url = new URL(req.url);

      // Serve static HTML
      if (url.pathname === "/") {
        return new Response(Bun.file("./public/index.html"));
      }

      // Add health check endpoint
      if (url.pathname === '/health') {
        return new Response(JSON.stringify({ status: 'ok' }), {
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }

      // Add validation for symbol
      if (url.pathname === "/api/predict") {
        const symbol =
          url.searchParams.get("symbol")?.toUpperCase() || "BTCUSDT";
        const interval = url.searchParams.get("interval") || "1h";

        // Validate symbol format
        if (!/^[A-Z]{2,10}USDT$/.test(symbol)) {
          throw new Error("Invalid trading pair format");
        }

        // Validate interval
        const validIntervals = ["1m", "5m", "15m", "30m", "1h", "4h", "1d"];
        if (!validIntervals.includes(interval)) {
          throw new Error("Invalid interval");
        }

        const prediction = await predictPrice(symbol, interval);
        return new Response(JSON.stringify(prediction), {
          headers: {
            ...headers,
            "Content-Type": "application/json",
            "Cache-Control": "no-cache",
          },
        });
      }

      return new Response("Not Found", { status: 404 });
    } catch (error: any) {
      console.error("Server error:", error);
      return new Response(
        JSON.stringify({
          error: error.message,
          timestamp: new Date().toISOString(),
        }),
        {
          status: error.status || 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  },
});

console.log(`Listening on http://localhost:${process.env.PORT || 1505}`);