import { useEffect, useState } from 'react';
import { api, getErrorMessage } from '../../lib/api';
import type { KnowledgeArticle } from '../../types';

export function KnowledgeBaseConsultation({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [articles, setArticles] = useState<KnowledgeArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      try {
        const { data } = await api.get<KnowledgeArticle[]>('/knowledge-base', {
          params: { q: query.trim() || undefined },
          signal: controller.signal,
        });
        setArticles(data);
        setError('');
      } catch (requestError) {
        if (!controller.signal.aborted) setError(getErrorMessage(requestError));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, query ? 250 : 0);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [query]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="knowledge-consultation-title"
        className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-chatz-xl
                   border border-chatz-border bg-chatz-surface p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id="knowledge-consultation-title" className="text-xl font-bold text-chatz-text">
              Base de conhecimento
            </h2>
            <p className="mt-1 text-sm text-chatz-text-muted">
              Consulta interna; este conteúdo não é enviado ao cliente.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar base de conhecimento"
            className="rounded-chatz px-2 py-1 text-xl text-chatz-text-muted hover:bg-chatz-surface-hover"
          >
            ×
          </button>
        </div>
        <label htmlFor="chat-knowledge-search" className="sr-only">
          Buscar artigos
        </label>
        <input
          id="chat-knowledge-search"
          type="search"
          autoFocus
          value={query}
          onChange={(event) => {
            setLoading(true);
            setQuery(event.target.value);
          }}
          placeholder="Buscar por título, categoria ou conteúdo..."
          className="mb-4 w-full rounded-chatz border border-chatz-border bg-chatz-surface-alt
                     px-4 py-3 text-sm text-chatz-text focus:border-chatz-primary"
        />
        {error && <p role="alert" className="mb-3 text-sm text-chatz-danger">{error}</p>}
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          {loading ? (
            <p className="py-8 text-center text-sm text-chatz-text-muted">
              Buscando artigos...
            </p>
          ) : articles.length === 0 ? (
            <p className="py-8 text-center text-sm text-chatz-text-muted">
              {query ? 'Nenhum artigo encontrado.' : 'Ainda não há artigos publicados.'}
            </p>
          ) : (
            articles.map((article) => (
              <details
                key={article.id}
                className="rounded-chatz border border-chatz-border bg-chatz-surface-alt p-4"
              >
                <summary className="cursor-pointer">
                  <span className="mr-2 rounded-full bg-chatz-primary-light px-2 py-1
                                   text-xs font-medium text-chatz-primary">
                    {article.category}
                  </span>
                  <span className="font-semibold text-chatz-text">{article.title}</span>
                </summary>
                <div className="mt-3 whitespace-pre-wrap border-t border-chatz-border
                                pt-3 text-sm leading-6 text-chatz-text">
                  {article.content}
                </div>
              </details>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
