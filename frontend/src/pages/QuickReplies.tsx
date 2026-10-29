import { useEffect, useState, type FormEvent } from 'react';
import { api, getErrorMessage } from '../lib/api';
import { IconBar } from '../components/chat/IconBar';
import { PageBackButton } from '../components/PageBackButton';
import type { QuickReply } from '../types';

export function QuickReplies() {
  const [replies, setReplies] = useState<QuickReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<QuickReply | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  async function loadReplies() {
    setLoading(true);
    try {
      const { data } = await api.get<QuickReply[]>('/quick-replies');
      setReplies(data);
      setError('');
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    api
      .get<QuickReply[]>('/quick-replies')
      .then(({ data }) => {
        if (active) {
          setReplies(data);
          setError('');
        }
      })
      .catch((requestError: unknown) => {
        if (active) setError(getErrorMessage(requestError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(reply: QuickReply) {
    setEditing(reply);
    setModalOpen(true);
  }

  async function handleSaved() {
    setModalOpen(false);
    setEditing(null);
    await loadReplies();
  }

  async function handleDelete(reply: QuickReply) {
    if (!confirm(`Excluir a resposta pronta "${reply.title}"?`)) return;
    try {
      await api.delete(`/quick-replies/${reply.id}`);
      setReplies((current) => current.filter((item) => item.id !== reply.id));
      setError('');
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  }

  return (
    <div className="h-screen w-screen flex bg-chatz-bg overflow-hidden">
      <IconBar />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <PageBackButton />
              <div>
              <h1 className="text-2xl font-bold text-chatz-text">
                Respostas prontas
              </h1>
              <p className="text-chatz-text-muted text-sm">
                Compartilhe respostas com a equipe e use-as digitando / no chat.
              </p>
              </div>
            </div>
            <button
              onClick={openCreate}
              className="px-5 py-2.5 bg-chatz-primary hover:bg-chatz-primary-hover
                         text-white font-medium rounded-lg transition-all"
            >
              + Nova resposta
            </button>
          </div>

          <div className="bg-chatz-primary-light border border-chatz-primary-border
                          rounded-chatz p-4 mb-5 text-sm text-chatz-text">
            Dica: comece a digitar <kbd className="px-1.5 py-0.5 bg-white
              border border-chatz-border rounded font-mono">/</kbd> na conversa,
            escolha uma resposta e personalize o texto antes de enviar.
          </div>

          {error && (
            <div role="alert" className="bg-chatz-danger-light
              border border-chatz-danger-border text-chatz-danger
              rounded-chatz px-4 py-3 mb-5">
              {error}
            </div>
          )}

          {loading ? (
            <p className="text-center py-16 text-chatz-text-muted">
              Carregando respostas...
            </p>
          ) : replies.length === 0 ? (
            <div className="text-center py-16 bg-chatz-surface border
                            border-dashed border-chatz-border rounded-chatz-xl">
              <p className="text-chatz-text-muted mb-3">
                Ainda não há respostas prontas.
              </p>
              <button
                onClick={openCreate}
                className="text-chatz-primary hover:text-chatz-primary-hover
                           text-sm font-medium"
              >
                Criar a primeira resposta
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {replies.map((reply) => (
                <article
                  key={reply.id}
                  className="bg-chatz-surface border border-chatz-border
                             rounded-chatz-xl p-5"
                >
                  <div className="flex flex-wrap justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <h2 className="font-semibold text-chatz-text mb-2">
                        {reply.title}
                      </h2>
                      <p className="text-sm text-chatz-text-muted whitespace-pre-wrap
                                    break-words line-clamp-4">
                        {reply.content}
                      </p>
                    </div>
                    <div className="flex gap-2 self-start">
                      <button
                        onClick={() => openEdit(reply)}
                        className="px-3 py-2 border border-chatz-border
                                   text-chatz-text text-sm rounded-chatz
                                   hover:bg-chatz-surface-hover transition-all"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDelete(reply)}
                        className="px-3 py-2 border border-chatz-danger-border
                                   text-chatz-danger text-sm rounded-chatz
                                   hover:bg-chatz-danger-light transition-all"
                      >
                        Excluir
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </main>

      {modalOpen && (
        <QuickReplyModal
          key={editing?.id ?? 'new'}
          reply={editing}
          onClose={() => setModalOpen(false)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}

interface QuickReplyModalProps {
  reply: QuickReply | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

function QuickReplyModal({ reply, onClose, onSaved }: QuickReplyModalProps) {
  const [title, setTitle] = useState(reply?.title ?? '');
  const [content, setContent] = useState(reply?.content ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = { title, content };
      if (reply) {
        await api.patch(`/quick-replies/${reply.id}`, payload);
      } else {
        await api.post('/quick-replies', payload);
      }
      await onSaved();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center
                    bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-reply-modal-title"
        className="w-full max-w-xl bg-chatz-surface border border-chatz-border
                   rounded-chatz-xl p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="quick-reply-modal-title" className="text-xl font-bold
                                                    text-chatz-text mb-5">
          {reply ? 'Editar resposta pronta' : 'Nova resposta pronta'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm font-medium text-chatz-text">
            Título para encontrar no chat
            <input
              required
              minLength={2}
              maxLength={80}
              autoFocus
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ex.: Saudação inicial"
              className="mt-2 w-full px-4 py-3 bg-chatz-surface-alt border
                         border-chatz-border rounded-chatz text-chatz-text
                         focus:border-chatz-primary"
            />
          </label>
          <label className="block text-sm font-medium text-chatz-text">
            Mensagem
            <textarea
              required
              maxLength={4000}
              rows={6}
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="Olá! Como podemos ajudar?"
              className="mt-2 w-full px-4 py-3 bg-chatz-surface-alt border
                         border-chatz-border rounded-chatz text-chatz-text
                         focus:border-chatz-primary resize-y"
            />
          </label>
          {error && <p role="alert" className="text-sm text-chatz-danger">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              disabled={saving}
              onClick={onClose}
              className="flex-1 py-3 bg-chatz-surface-alt border
                         border-chatz-border text-chatz-text
                         font-medium rounded-chatz"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-3 bg-chatz-primary hover:bg-chatz-primary-hover
                         text-white font-semibold rounded-chatz
                         disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Salvar resposta'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
