import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Stripe from 'npm:stripe@17.7.0';

const PLAN_MESSAGE_LIMITS = {
  starter: 1000,
  pro: 10000,
  enterprise: 50000,
};
const PLAN_PRICES = {
  starter: 9.90,
  pro: 499,
  enterprise: 1499,
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) return Response.json({ error: 'STRIPE_SECRET_KEY not configured' }, { status: 500 });

    const stripe = new Stripe(stripeKey, { apiVersion: '2024-12-18.acacia' });

    const signature = req.headers.get('stripe-signature');
    if (!signature) return Response.json({ error: 'Missing signature' }, { status: 400 });

    const rawBody = await req.text();
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret) return Response.json({ error: 'STRIPE_WEBHOOK_SECRET not configured' }, { status: 500 });

    let event;
    try {
      event = await stripe.webhooks.constructEventAsync(rawBody, signature, webhookSecret);
    } catch (err) {
      return Response.json({ error: 'Invalid signature: ' + err.message }, { status: 400 });
    }

    // Process checkout completion
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const clientId = session.metadata?.client_id || session.client_reference_id;
      const plan = session.metadata?.plan;

      if (clientId && plan) {
        const cycleStart = new Date().toISOString().split('T')[0];
        const nextBilling = new Date();
        nextBilling.setMonth(nextBilling.getMonth() + 1);
        const nextBillingDate = nextBilling.toISOString().split('T')[0];

        await base44.asServiceRole.entities.Client.update(clientId, {
          plan,
          billing_status: 'current',
          message_limit: PLAN_MESSAGE_LIMITS[plan] || 1000,
          monthly_amount: PLAN_PRICES[plan] || 0,
          messages_used: 0,
          billing_cycle_start: cycleStart,
          next_billing_date: nextBillingDate,
        });

        try {
          await base44.asServiceRole.entities.ActivityLog.create({
            action_type: 'billing_change',
            description: `Suscripción ${plan} activada vía Stripe`,
            user_email: 'stripe@webhook',
            client_id: clientId,
            severity: 'info',
            metadata: { plan, session_id: session.id },
          });
        } catch { /* best-effort */ }
      }
    }

    // Process recurring payment success
    if (event.type === 'invoice.paid') {
      const invoice = event.data.object;
      const clientId = invoice.metadata?.client_id;
      const plan = invoice.metadata?.plan;

      if (clientId) {
        const nextBilling = new Date();
        nextBilling.setMonth(nextBilling.getMonth() + 1);

        await base44.asServiceRole.entities.Client.update(clientId, {
          billing_status: 'current',
          messages_used: 0,
          next_billing_date: nextBilling.toISOString().split('T')[0],
        });
      }
    }

    // Process subscription cancellation
    if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object;
      const clientId = sub.metadata?.client_id;

      if (clientId) {
        await base44.asServiceRole.entities.Client.update(clientId, {
          billing_status: 'canceled',
          status: 'paused',
        });
      }
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error('stripeWebhook error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});