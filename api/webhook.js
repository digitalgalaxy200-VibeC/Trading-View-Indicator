export default function handler(req, res) {
  const startTime = Date.now();

  // 1 & 2. Create endpoint and accept only POST requests
  if (req.method !== 'POST') {
    const processingTime = Date.now() - startTime;
    console.error(`Rejected ${req.method} request. Only POST is allowed. (${processingTime}ms)`);
    return res.status(405).json({ error: 'Method Not Allowed', message: 'Only POST requests are accepted.' });
  }

  try {
    // 3 & 4. Parse and validate JSON payload
    // Vercel parses JSON automatically, but we ensure it's a valid object
    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    if (!payload || typeof payload !== 'object' || Object.keys(payload).length === 0) {
      throw new Error("Payload is empty or not a valid JSON object.");
    }

    // Extract headers and IP (Vercel provides x-forwarded-for or x-real-ip)
    const ip = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.socket?.remoteAddress || 'Unknown';
    const userAgent = req.headers['user-agent'] || 'Unknown';
    
    const processingTime = Date.now() - startTime;

    // 5. Log the complete payload to the console
    console.log("========================================");
    console.log("🔔 TradingView Webhook Received");
    console.log(`Timestamp:       ${new Date().toISOString()}`);
    console.log(`Source IP:       ${ip}`);
    console.log(`Request Method:  ${req.method}`);
    console.log(`User-Agent:      ${userAgent}`);
    console.log(`Processing Time: ${processingTime}ms`);
    console.log("Payload:");
    console.log(JSON.stringify(payload, null, 2));
    console.log("========================================");

    // 6. Return HTTP 200 immediately after successful validation
    return res.status(200).json({ 
      status: 'success', 
      message: 'Webhook received and logged successfully.' 
    });

  } catch (error) {
    // 7. Handle invalid JSON gracefully with an appropriate HTTP error
    const processingTime = Date.now() - startTime;
    console.error("❌ Failed to process webhook payload:");
    console.error(`Error:           ${error.message}`);
    console.error(`Processing Time: ${processingTime}ms`);
    
    return res.status(400).json({ 
      error: 'Bad Request', 
      message: 'Invalid JSON payload.' 
    });
  }
}
