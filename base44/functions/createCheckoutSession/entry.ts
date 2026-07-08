import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Stripe from 'npm:stripe@17.7.0';

const PRICE_MAP = {
  starter: 'price_1TqkbH7zhhzDS4fdwwkrFpKw',
  pro: 'price_1TqkbH7zhhzDS4fdmkjbevVI',
  enterprise: 'price_1TqkbH7zhhzDS4fdYdKZixXF',
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const payload = body.data || body.args || body.params || body;
    const { plan, client_id } = payload;

    if (!plan || !PRICE_MAP[plan]) {
      return Response.json({ error: 'Invalid plan. Use: starter, pro, or enterprise' }, { status: 400 });
    }

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) return Response.json({ error: 'STRIPE_SECRET_KEY not configured' }, { status: 500 });

    const stripe = new Stripe(stripeKey, { apiVersion: '2024-12-18.acacia' });

    // Get client info for metadata and email
    let client = null;
    if (client_id) {
      try {
        client = await base44.asServiceRole.entities.Client.get(client_id);
      } catch { /* optional */ }
    }

    const origin = req.headers.get('origin') || req.headers.get('referer')?.replace(/\/$/, '') || 'https://stenbot.com';

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: PRICE_MAP[plan], quantity: 1 }],
      success_url: `${origin}/billing?status=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/billing?status=cancelled`,
      client_reference_id: client_id || undefined,
      customer_email: client?.email || undefined,
      metadata: {
        base44_app_id: Deno.env.get('BASE44_APP_ID'),
        client_id: client_id || '',
        plan,
      },
    });

    return Response.json({ url: session.url, session_id: session.id });
  } catch (error) {
    console.error('createCheckoutSession error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});