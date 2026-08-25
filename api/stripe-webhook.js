import crypto from "node:crypto";

const SUPABASE_URL = "https://uxpxewgopbwjxcmdjscu.supabase.co";

export const config = {
  api: {
    bodyParser: false,
  },
};

async function rawBody(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

function verifyStripeSignature(payload, header, secret) {
  if (!header || !secret) return false;

  const timestamp = header
    .split(",")
    .find((part) => part.startsWith("t="))
    ?.slice(2);

  const signatures = header
    .split(",")
    .filter((part) => part.startsWith("v1="))
    .map((part) => part.slice(3));

  if (!timestamp || !signatures.length) return false;

  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) {
    return false;
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${payload.toString("utf8")}`)
    .digest("hex");

  return signatures.some((signature) => {
    if (signature.length !== expected.length) return false;

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected)
    );
  });
}

async function saveSubscription(row, serviceKey) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/subscriptions?on_conflict=user_id`,
    {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(row),
    }
  );

  if (!response.ok) {
    throw new Error(await response.text());
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const supabaseSecret = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!webhookSecret || !supabaseSecret) {
    return res.status(503).send("Webhook server is not configured");
  }

  const body = await rawBody(req);

  if (
    !verifyStripeSignature(
      body,
      req.headers["stripe-signature"],
      webhookSecret
    )
  ) {
    return res.status(400).send("Invalid Stripe signature");
  }

  const event = JSON.parse(body.toString("utf8"));
  const object = event.data?.object || {};

  try {
    if (
      event.type === "checkout.session.completed" &&
      object.mode === "subscription" &&
      object.client_reference_id
    ) {
      await saveSubscription(
        {
          user_id: object.client_reference_id,
          stripe_customer_id:
            typeof object.customer === "string" ? object.customer : null,
          stripe_subscription_id:
            typeof object.subscription === "string"
              ? object.subscription
              : null,
          status: "active",
          updated_at: new Date().toISOString(),
        },
        supabaseSecret
      );
    }

    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const userId = object.metadata?.user_id;

      if (userId) {
        const status =
          event.type === "customer.subscription.deleted"
            ? "canceled"
            : object.status || "inactive";

        await saveSubscription(
          {
            user_id: userId,
            stripe_customer_id:
              typeof object.customer === "string" ? object.customer : null,
            stripe_subscription_id: object.id || null,
            status,
            current_period_end: object.current_period_end
              ? new Date(object.current_period_end * 1000).toISOString()
              : null,
            updated_at: new Date().toISOString(),
          },
          supabaseSecret
        );
      }
    }
  } catch (error) {
    console.error("SharpEdge webhook error:", error);
    return res.status(500).send("Webhook processing failed");
  }

  return res.status(200).json({ received: true });
}
