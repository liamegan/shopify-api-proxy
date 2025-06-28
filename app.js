const express = require("express");
const cors = require("cors");
require("dotenv").config(); // npm install dotenv to load .env file variables

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for your React app's origin
app.use(
  cors({
    origin: "http://localhost:3000",
  })
);

app.use(express.json());

app.all(/\/shopify-api-proxy\/(.*)/, async (req, res) => {
  try {
    const shopifyStoreUrl = process.env.SHOPIFY_STORE_URL;
    const shopifyApiKey = process.env.SHOPIFY_API_KEY;
    const shopifyApiPassword = process.env.SHOPIFY_API_PASSWORD;

    if (!shopifyStoreUrl || !shopifyApiKey || !shopifyApiPassword) {
      return res.status(500).json({
        error:
          "Shopify API credentials not configured on the proxy server. Please check your server's .env file.",
      });
    }

    const apiPath = req.params[0];

    const cleanStoreUrl = shopifyStoreUrl
      .replace(/^(https?:\/\/)?/, "")
      .replace(/\/$/, "");

    const queryParams = new URLSearchParams(req.query).toString();
    const fullShopifyUrl = `https://${cleanStoreUrl}/${apiPath}${
      queryParams ? `?${queryParams}` : ""
    }`;

    const encodedCredentials = Buffer.from(
      `${shopifyApiKey}:${shopifyApiPassword}`
    ).toString("base64");

    console.log(`Proxying ${req.method} request to Shopify: ${fullShopifyUrl}`);

    // Make the request to Shopify using fetch
    const shopifyRes = await fetch(fullShopifyUrl, {
      method: req.method, // Forward the original HTTP method
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${encodedCredentials}`,
        // 'X-Shopify-Hmac-Sha256': req.headers['x-shopify-hmac-sha256'], ??
      },
      body:
        req.method !== "GET" && req.method !== "HEAD"
          ? JSON.stringify(req.body)
          : undefined,
    });

    // Check for Shopify error status
    if (!shopifyRes.ok) {
      let errorMessage = `Shopify API responded with status: ${shopifyRes.status}`;
      try {
        const errorData = await shopifyRes.json();
        errorMessage += ` - Details: ${JSON.stringify(errorData)}`;
      } catch (jsonParseError) {
        const errorText = await shopifyRes.text();
        errorMessage += ` - Body: ${errorText}`;
      }
      console.error("Shopify API Error:", errorMessage);
      return res.status(shopifyRes.status).json({ error: errorMessage });
    }

    // Parse Shopify's response and send it back to the client
    const data = await shopifyRes.json();
    res.status(shopifyRes.status).json(data);
  } catch (error) {
    console.error("Proxy server internal error:", error);
    res.status(500).json({ error: `Proxy server failed: ${error.message}` });
  }
});

// Start the proxy server
app.listen(PORT, () => {
  console.log(`Shopify API Proxy server running on http://localhost:${PORT}`);
  console.log(
    "Ensure your React app is configured to make requests to this proxy URL (e.g., http://localhost:5000/shopify-api-proxy/admin/api/2024-07/shop.json)."
  );
});
