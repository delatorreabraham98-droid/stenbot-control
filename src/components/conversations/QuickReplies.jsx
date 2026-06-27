import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Zap, Plus, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

const DEFAULT_TEMPLATES = [
  { id: 'default-1', title: 'Saludo', body: 'Hola, bienvenido/a. ¿En qué te puedo ayudar?' },
  { id: 'default-2', title: 'En seguida', body: 'Un momento, en seguida te atiendo.' },
  { id: 'default-3', title: 'Cierre', body: 'Fue un placer atenderte. ¡Que tengas un excelente día! 😊' },
];

export default function QuickReplies({ clientId, clientEmail, onSelect }) {
  const [templates, setTemplates] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    base44.entities.Template.filter({ client_id: clientId, active: true })
      .then(items => setTemplates(items))
      .catch(() => setTemplates([]));
  }, [clientId]);

  const allTemplates = templates.length > 0 ? templates : DEFAULT_TEMPLATES;

  const save = async () => {
    if (!newTitle.trim() || !newBody.trim()) return;
    setSaving(true);
    try {
      const created = await base44.entities.Template.create({
        client_id: clientId,
        client_email: clientEmail,
        title: newTitle.trim(),
        body: newBody.trim(),
        active: true,
      });
      setTemplates(prev => [...prev, created]);
      setNewTitle('');
      setNewBody('');
      setShowForm(false);
      toast.success('Plantilla guardada');
    } catch {
      toast.error('Error al guardar plantilla');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (id.startsWith('default-')) return;
    await base44.entities.Template.update(id, { active: false });
    setTemplates(prev => prev.filter(t => t.id !== id));
  };

  return (
    <div className="border-t border-border px-4 py-2 bg-muted/30">
      <div className="flex items-center gap-2 mb-2">
        <Zap className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs font-medium text-muted-foreground">Respuestas rápidas</span>
        <button
          onClick={() => setShowForm(f => !f)}
          className="ml-auto text-xs text-primary hover:underline flex items-center gap-1"
        >
          <Plus className="w-3 h-3" /> Nueva
        </button>
      </div>

      {showForm && (
        <div className="mb-2 space-y-1.5 p-2 bg-card rounded-lg border border-border">
          <Input
            className="h-7 text-xs"
            placeholder="Nombre corto (ej: Saludo)"
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
          />
          <Textarea
            className="text-xs min-h-[60px] resize-none"
            placeholder="Texto del mensaje..."
            value={newBody}
            onChange={e => setNewBody(e.target.value)}
          />
          <div className="flex gap-1.5">
            <Button size="sm" className="h-6 text-xs gap-1" onClick={save} disabled={saving}>
              <Check className="w-3 h-3" /> Guardar
            </Button>
            <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setShowForm(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {allTemplates.map(t => (
          <div key={t.id} className="flex items-center gap-0.5 group">
            <button
              onClick={() => onSelect(t.body)}
              className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-medium"
            >
              {t.title}
            </button>
            {!t.id.startsWith('default-') && (
              <button
                onClick={() => remove(t.id)}
                className="w-4 h-4 rounded-full bg-muted text-muted-foreground hover:bg-destructive hover:text-white transition-colors hidden group-hover:flex items-center justify-center"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}