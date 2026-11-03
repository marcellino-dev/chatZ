import { useState, type FormEvent } from 'react';
import { api, getErrorMessage } from '../../lib/api';

interface Props {
  ticketId: string;
}

export function FollowUpForm({ ticketId }: Props) {
  const [scheduledAt, setScheduledAt] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!scheduledAt || saving) return;

    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await api.post('/follow-ups', {
        ticketId,
        scheduledAt: new Date(scheduledAt).toISOString(),
        note,
      });
      setScheduledAt('');
      setNote('');
      setSuccess('Follow-up agendado.');
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && <p role="alert" className="text-xs text-chatz-danger">{error}</p>}
      {success && <p role="status" className="text-xs text-chatz-success">{success}</p>}
      <label className="block text-xs text-chatz-text-muted">
        Data e horário
        <input
          type="datetime-local"
          required
          value={scheduledAt}
          onChange={(event) => setScheduledAt(event.target.value)}
          className="mt-1 w-full rounded-chatz border border-chatz-border bg-chatz-surface
                     px-3 py-2 text-sm text-chatz-text focus:border-chatz-primary"
        />
      </label>
      <label className="block text-xs text-chatz-text-muted">
        Observação (opcional)
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={1000}
          rows={2}
          placeholder="Ex.: retornar para confirmar o orçamento"
          className="mt-1 w-full resize-y rounded-chatz border border-chatz-border
                     bg-chatz-surface px-3 py-2 text-sm text-chatz-text
                     placeholder:text-chatz-text-subtle focus:border-chatz-primary"
        />
      </label>
      <button
        type="submit"
        disabled={!scheduledAt || saving}
        className="w-full rounded-chatz bg-chatz-primary px-3 py-2 text-sm font-medium
                   text-white transition-colors hover:bg-chatz-primary-hover
                   disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? 'Agendando...' : 'Agendar follow-up'}
      </button>
    </form>
  );
}
