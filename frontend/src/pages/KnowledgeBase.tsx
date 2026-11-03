import { useEffect, useState, type FormEvent } from 'react';
import { IconBar } from '../components/chat/IconBar';
import { PageBackButton } from '../components/PageBackButton';
import { api, getErrorMessage } from '../lib/api';
import { useAuthStore } from '../stores/auth';
import type { KnowledgeArticle } from '../types';

export function KnowledgeBase() {
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === 'ADMIN';
  const [articles, setArticles] = useState<KnowledgeArticle[]>([]);
  const [search, setSearch] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<KnowledgeArticle | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      try {
        const { data } = await api.get<KnowledgeArticle[]>('/knowledge-base', {
          params: {
            q: search.trim() || undefined,
            includeArchived: isAdmin && includeArchived ? true : undefined,
          },
          signal: controller.signal,
        });
        setArticles(data);
        setError('');
      } catch (requestError) {
        if (!controller.signal.aborted) setError(getErrorMessage(requestError));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, search ? 250 : 0);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [includeArchived, isAdmin, search]);

  function openCreate() {
    setEditing(null);
    setEditorOpen(true);
  }

  function openEdit(article: KnowledgeArticle) {
    setEditing(article);
    setEditorOpen(true);
  }

  async function reloadArticles() {
    const { data } = await api.get<KnowledgeArticle[]>('/knowledge-base', {
      params: {
        q: search.trim() || undefined,
        includeArchived: isAdmin && includeArchived ? true : undefined,
      },
    });
    setArticles(data);
    setError('');
  }

  async function toggleActive(article: KnowledgeArticle) {
    try {
      await api.patch(`/knowledge-base/${article.id}`, {
        active: !article.active,
      });
      await reloadArticles();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-chatz-bg">
      <IconBar />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-6 py-8">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <PageBackButton />
              <div>
                <h1 className="text-2xl font-bold text-chatz-text">Base de conhecimento</h1>
                <p className="text-sm text-chatz-text-muted">
                  Consulte orientações e informações para os atendimentos.
                </p>
              </div>
            </div>
            {isAdmin && (
              <button
                type="button"
                onClick={openCreate}
                className="rounded-chatz bg-chatz-primary px-4 py-2.5 font-medium text-white
                           transition-colors hover:bg-chatz-primary-hover"
              >
                + Novo artigo
              </button>
            )}
          </div>

          <label htmlFor="knowledge-search" className="sr-only">
            Buscar na base de conhecimento
          </label>
          <input
            id="knowledge-search"
            type="search"
            value={search}
            onChange={(event) => {
              setLoading(true);
              setSearch(event.target.value);
            }}
            placeholder="Buscar por título, categoria ou conteúdo..."
            className="mb-5 w-full rounded-chatz border border-chatz-border bg-chatz-surface
                       px-4 py-3 text-sm text-chatz-text placeholder:text-chatz-text-subtle
                       focus:border-chatz-primary focus:ring-2 focus:ring-chatz-primary/20"
          />

          {isAdmin && (
            <label className="mb-5 flex items-center gap-2 text-sm text-chatz-text-muted">
              <input
                type="checkbox"
                checked={includeArchived}
                onChange={(event) => {
                  setLoading(true);
                  setIncludeArchived(event.target.checked);
                }}
                className="accent-chatz-primary"
              />
              Incluir artigos arquivados
            </label>
          )}

          {error && (
            <p
              role="alert"
              className="mb-5 rounded-chatz border border-chatz-danger-border
                         bg-chatz-danger-light p-4 text-sm text-chatz-danger"
            >
              {error}
            </p>
          )}

          {loading ? (
            <p className="py-16 text-center text-sm text-chatz-text-muted">
              Carregando artigos...
            </p>
          ) : articles.length === 0 ? (
            <div className="rounded-chatz-xl border border-dashed border-chatz-border
                            bg-chatz-surface p-12 text-center">
              <p className="text-chatz-text-muted">
                {search
                  ? 'Nenhum artigo encontrado para esta busca.'
                  : isAdmin
                    ? 'A base ainda não tem artigos.'
                    : 'Ainda não há artigos publicados para consulta.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {articles.map((article) => (
                <article
                  key={article.id}
                  className="rounded-chatz-xl border border-chatz-border bg-chatz-surface p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-chatz-primary-light px-2.5 py-1
                                         text-xs font-medium text-chatz-primary">
                          {article.category}
                        </span>
                        {!article.active && (
                          <span className="rounded-full bg-chatz-surface-hover px-2.5 py-1
                                           text-xs text-chatz-text-muted">
                            Arquivado
                          </span>
                        )}
                      </div>
                      <h2 className="font-semibold text-chatz-text">{article.title}</h2>
                    </div>
                    {isAdmin && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(article)}
                          className="rounded-chatz border border-chatz-border px-3 py-2
                                     text-sm text-chatz-text hover:bg-chatz-surface-hover"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => void toggleActive(article)}
                          className="rounded-chatz border border-chatz-border px-3 py-2
                                     text-sm text-chatz-text hover:bg-chatz-surface-hover"
                        >
                          {article.active ? 'Arquivar' : 'Publicar'}
                        </button>
                      </div>
                    )}
                  </div>
                  <details className="group mt-3">
                    <summary className="cursor-pointer text-sm font-medium text-chatz-primary
                                        hover:text-chatz-primary-hover">
                      Consultar artigo
                    </summary>
                    <div className="mt-3 whitespace-pre-wrap border-t border-chatz-border
                                    pt-4 text-sm leading-6 text-chatz-text">
                      {article.content}
                    </div>
                  </details>
                </article>
              ))}
            </div>
          )}
        </div>
      </main>

      {editorOpen && isAdmin && (
        <ArticleEditor
          article={editing}
          onClose={() => setEditorOpen(false)}
          onSaved={async () => {
            setEditorOpen(false);
            setEditing(null);
            setLoading(true);
            try {
              await reloadArticles();
            } catch (requestError) {
              setError(getErrorMessage(requestError));
            } finally {
              setLoading(false);
            }
          }}
        />
      )}
    </div>
  );
}

function ArticleEditor({
  article,
  onClose,
  onSaved,
}: {
  article: KnowledgeArticle | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [title, setTitle] = useState(article?.title ?? '');
  const [category, setCategory] = useState(article?.category ?? '');
  const [content, setContent] = useState(article?.content ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = { title, category, content };
      if (article) {
        await api.patch(`/knowledge-base/${article.id}`, payload);
      } else {
        await api.post('/knowledge-base', payload);
      }
      await onSaved();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="knowledge-article-title"
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-chatz-xl
                   border border-chatz-border bg-chatz-surface p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="knowledge-article-title" className="mb-5 text-xl font-bold text-chatz-text">
          {article ? 'Editar artigo' : 'Novo artigo'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm font-medium text-chatz-text">
            Título
            <input
              required
              minLength={2}
              maxLength={120}
              autoFocus
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="mt-2 w-full rounded-chatz border border-chatz-border bg-chatz-surface-alt
                         px-4 py-3 text-chatz-text focus:border-chatz-primary"
            />
          </label>
          <label className="block text-sm font-medium text-chatz-text">
            Categoria
            <input
              required
              minLength={2}
              maxLength={60}
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              placeholder="Ex.: Produtos, Financeiro, Procedimentos"
              className="mt-2 w-full rounded-chatz border border-chatz-border bg-chatz-surface-alt
                         px-4 py-3 text-chatz-text focus:border-chatz-primary"
            />
          </label>
          <label className="block text-sm font-medium text-chatz-text">
            Conteúdo
            <textarea
              required
              maxLength={20000}
              rows={12}
              value={content}
              onChange={(event) => setContent(event.target.value)}
              className="mt-2 w-full resize-y rounded-chatz border border-chatz-border
                         bg-chatz-surface-alt px-4 py-3 text-chatz-text
                         focus:border-chatz-primary"
            />
          </label>
          {error && <p role="alert" className="text-sm text-chatz-danger">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              disabled={saving}
              onClick={onClose}
              className="flex-1 rounded-chatz border border-chatz-border bg-chatz-surface-alt
                         py-3 font-medium text-chatz-text disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-chatz bg-chatz-primary py-3 font-semibold text-white
                         hover:bg-chatz-primary-hover disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Salvar artigo'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
