# SharpEdge
Public-ready static MVP for live sports scoreboards and confidence-rated informational pick signals.

## Included
- NFL, NBA, MLB, NHL, and NCAAF live scoreboard feeds
- Market-aware heuristic signals when odds are present in the feed
- Saved picks stored locally on-device
- Responsive mobile UI
- Pro subscription UI ready for Stripe wiring
- Responsible wagering disclosure

## Supabase
Supabase client configuration is connected. Run `supabase-schema.sql` once in the Supabase SQL Editor to enable cross-device saved picks with Row Level Security. Authentication uses the publishable client key only.

## Production connection still required
Stripe checkout/webhooks still need to be connected before charging customers. Secret Stripe keys must remain server-side and must not be embedded in this public source.

## Stripe Pro checkout
Configured client values:
- Price ID: `price_1U8Fw4F0N4LztQxo7Z8JZWY9`
- Publishable test key is included client-side.

Before paid checkout works on Vercel, add `STRIPE_SECRET_KEY` as a protected environment variable in the Vercel project. Never expose it in client code or commit it to source control. The `/api/create-checkout-session` serverless function uses that environment variable to create Stripe Checkout subscription sessions.
