import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { workflow_id, trigger_data } = await req.json();
    const workflow = await base44.entities.Workflow.get(workflow_id);
    if (!workflow) return Response.json({ error: 'Workflow not found' }, { status: 404 });
    if (!workflow.active) return Response.json({ success: true, message: 'Workflow inactive' });

    const results = [];
    for (const action of workflow.actions || []) {
      try {
        const result = await executeAction(base44, action, trigger_data, workflow);
        results.push({ action: action.type, success: true, result });
      } catch (err) {
        results.push({ action: action.type, success: false, error: err.message });
      }
    }

    return Response.json({ success: true, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function executeAction(base44, action, trigger_data, workflow) {
  const { type, config } = action;

  switch (type) {
    case 'send_email':
      return await base44.integrations.Core.SendEmail({
        to: config.email || trigger_data.customer_email,
        subject: config.subject || 'Mensaje automático',
        body: interpolateTemplate(config.body, trigger_data)
      });

    case 'send_whatsapp':
      return await base44.functions.invoke('sendWhatsAppMessage', {
        conversation_id: trigger_data.conversation_id,
        message_text: interpolateTemplate(config.message, trigger_data)
      });

    case 'update_lead':
      if (trigger_data.lead_id) {
        return await base44.asServiceRole.entities.Lead.update(trigger_data.lead_id, config.data || {});
      }
      break;

    case 'create_task':
      // Placeholder for future Task entity
      return { message: 'Task creation not yet implemented' };
  }
}

function interpolateTemplate(template, data) {
  if (!template) return '';
  let result = template;
  Object.entries(data).forEach(([key, value]) => {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value || '');
  });
  return result;
}