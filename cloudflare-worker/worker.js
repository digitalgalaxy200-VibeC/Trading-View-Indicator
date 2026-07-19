/**
 * Cloudflare Worker: HTTP to WebSocket Bridge for Deriv API
 * 
 * Why this is necessary:
 * Deriv provides market data exclusively via WebSockets (wss://ws.binaryws.com/websockets/v3).
 * Google Apps Script (UrlFetchApp) can only make HTTP requests and does not support WebSockets.
 * This script accepts an HTTP request from Google Apps Script, opens a WebSocket to Deriv,
 * retrieves the requested historical candles, and returns them as an HTTP JSON response.
 */

export default {
  async fetch(request, env, ctx) {
    // Only accept POST requests
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed. Use POST.', { status: 405 });
    }

    try {
      // Parse the JSON request body
      // Example expected body: { "ticks_history": "R_100", "style": "candles", "granularity": 60, "count": 100 }
      const requestData = await request.json();
      
      // We must add an app_id. Deriv requires an app_id for API calls.
      // 1089 is a commonly used generic app_id for testing, but you can create your own in Deriv API dashboard.
      requestData.app_id = 1089;

      // Connect to the Deriv WebSocket
      const wsUrl = 'wss://ws.binaryws.com/websockets/v3?app_id=1089';
      
      // Use the WebSockets API inside the Cloudflare Worker
      const response = await fetch(wsUrl, {
        headers: { Upgrade: 'websocket' }
      });
      
      const ws = response.webSocket;
      
      if (!ws) {
        return new Response('Failed to upgrade to WebSocket', { status: 502 });
      }
      
      ws.accept();

      // Return a Promise that resolves when we get a response from Deriv
      const result = await new Promise((resolve, reject) => {
        // Set a timeout of 5 seconds
        const timeout = setTimeout(() => {
          ws.close();
          reject(new Error("Timeout waiting for Deriv API"));
        }, 5000);

        ws.addEventListener('message', event => {
          clearTimeout(timeout);
          try {
            const data = JSON.parse(event.data);
            resolve(data);
          } catch (e) {
            reject(e);
          } finally {
            ws.close();
          }
        });

        ws.addEventListener('error', event => {
          clearTimeout(timeout);
          reject(new Error("WebSocket Error"));
          ws.close();
        });

        // Send the request to Deriv
        ws.send(JSON.stringify(requestData));
      });

      // Return the Deriv response as HTTP JSON
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};
