import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Globe, Upload, Plus, X, Loader2, FileText } from 'lucide-react';
import { toast } from 'sonner';

export default function ContextImporter({ onContextExtracted }) {
  const [url, setUrl] = useState('');
  const [loadingUrl, setLoadingUrl] = useState(false);
  const [loadingFile, setLoadingFile] = useState(false);
  const [extractedItems, setExtractedItems] = useState([]);

  const extractFromUrl = async () => {
    if (!url.trim()) return;
    setLoadingUrl(true);
    try {
      const res = await base44.functions.invoke('extractContextFromUrl', { url: url.trim() });
      const text = res.data?.context;
      if (text) {
        const item = { type: 'url', source: url.trim(), text };
        const updated = [...extractedItems, item];
        setExtractedItems(updated);
        onContextExtracted(updated.map(i => i.text).join('\n\n'));
        setUrl('');
        toast.success('Contexto extraído del sitio web');
      } else {
        toast.error('No se pudo extraer contexto de la URL');
      }
    } catch (e) {
      toast.error('Error al extraer URL: ' + (e.message || 'Intenta de nuevo'));
    } finally {
      setLoadingUrl(false);
    }
  };

  const extractFromFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoadingFile(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url,
        json_schema: {
          type: 'object',
          properties: {
            content: { type: 'string', description: 'Todo el contenido textual del archivo' }
          }
        }
      });
      const text = result?.output?.content;
      if (text) {
        const item = { type: 'file', source: file.name, text };
        const updated = [...extractedItems, item];
        setExtractedItems(updated);
        onContextExtracted(updated.map(i => i.text).join('\n\n'));
        toast.success(`Contexto extraído de "${file.name}"`);
      } else {
        toast.error('No se pudo extraer contenido del archivo');
      }
    } catch (e) {
      toast.error('Error al procesar archivo: ' + (e.message || 'Intenta de nuevo'));
    } finally {
      setLoadingFile(false);
      e.target.value = '';
    }
  };

  const removeItem = (index) => {
    const updated = extractedItems.filter((_, i) => i !== index);
    setExtractedItems(updated);
    onContextExtracted(updated.map(i => i.text).join('\n\n'));
  };

  return (
    <div className="space-y-3 p-4 border border-border rounded-xl bg-muted/30">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Importar contexto automáticamente</p>

      {/* URL */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            className="pl-9 text-sm h-9"
            placeholder="https://tusitio.com o red social..."
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && extractFromUrl()}
          />
        </div>
        <Button size="sm" variant="outline" onClick={extractFromUrl} disabled={loadingUrl || !url.trim()} className="h-9 gap-1.5">
          {loadingUrl ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          {loadingUrl ? 'Extrayendo...' : 'Extraer'}
        </Button>
      </div>

      {/* File Upload */}
      <div className="flex items-center gap-2">
        <label className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border border-dashed border-border cursor-pointer hover:bg-muted transition-colors text-sm text-muted-foreground ${loadingFile ? 'opacity-50 pointer-events-none' : ''}`}>
          {loadingFile ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          {loadingFile ? 'Procesando archivo...' : 'Subir archivo (PDF, Word, TXT)'}
          <input type="file" accept=".pdf,.doc,.docx,.txt" className="hidden" onChange={extractFromFile} />
        </label>
      </div>

      {/* Extracted Items */}
      {extractedItems.length > 0 && (
        <div className="space-y-1.5">
          {extractedItems.map((item, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-card rounded-lg border border-border">
              {item.type === 'url' ? <Globe className="w-3.5 h-3.5 text-primary flex-shrink-0" /> : <FileText className="w-3.5 h-3.5 text-primary flex-shrink-0" />}
              <span className="text-xs text-foreground truncate flex-1">{item.source}</span>
              <button onClick={() => removeItem(i)} className="text-muted-foreground hover:text-destructive transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}