const admin = require("firebase-admin");

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") : undefined,
      }),
    });
  } catch (error) {
    console.error("Firebase admin initialization error", error.stack);
  }
}

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Basic security: require a secret key in the header to prevent unauthorized access
  const authHeader = req.headers.authorization;
  const SECRET_KEY = process.env.WEBHOOK_SECRET_KEY || "fallback_dev_secret_key";
  
  if (!authHeader || authHeader !== `Bearer ${SECRET_KEY}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { tokens, title, body, data, channelId } = req.body;

  if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
    return res.status(400).json({ error: "Missing or invalid tokens array" });
  }

  try {
    const message = {
      notification: {
        title: title || "New Notification",
        body: body || "",
      },
      data: data || {},
      tokens: tokens,
      android: {
        priority: "high",
        notification: {
          channelId: channelId || "ak_nexus_high_importance", // Defaults to high importance channel
          sound: channelId === "ak_partner_jobs_v2" ? "partner_alert" : "default",
          priority: "max",
          defaultSound: channelId !== "ak_partner_jobs_v2",
          defaultVibrateTimings: true,
        }
      },
      apns: {
        payload: {
          aps: {
            sound: channelId === "ak_partner_jobs_v2" ? "partner_alert.wav" : "default",
          }
        }
      }
    };

    const response = await admin.messaging().sendMulticast(message);
    
    return res.status(200).json({
      success: true,
      successCount: response.successCount,
      failureCount: response.failureCount,
      responses: response.responses,
    });
  } catch (error) {
    console.error("Error sending message:", error);
    return res.status(500).json({ error: "Failed to send notification", details: error.message });
  }
}

