import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { api, getErrorMessage } from '../lib/api';
import { IconBar } from '../components/chat/IconBar';
import { PageBackButton } from '../components/PageBackButton';
import type { QuickReply } from '../types';

type QuickReplyItem = QuickReply;

type SortKey = 'recent' | 'az';

const GENERAL = 'Geral';

/* ======================================================================
 * Categorias: cores e ícones
 * ==================================================================== */

interface CategoryStyle {
  bar: string;
  badge: string;
  iconBox: string;
}

const PALETTE: CategoryStyle[] = [
  { bar: 'bg-fuchsia-600', badge: 'bg-purple-100 text-purple-700', iconBox: 'bg-purple-100 text-purple-700' },
  { bar: 'bg-orange-500', badge: 'bg-orange-100 text-orange-700', iconBox: 'bg-orange-100 text-orange-700' },
  { bar: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700', iconBox: 'bg-emerald-100 text-emerald-700' },
  { bar: 'bg-blue-500', badge: 'bg-blue-100 text-blue-700', iconBox: 'bg-blue-100 text-blue-700' },
  { bar: 'bg-rose-500', badge: 'bg-rose-100 text-rose-700', iconBox: 'bg-rose-100 text-rose-700' },
];

const NEUTRAL: CategoryStyle = {
  bar: 'bg-slate-400',
  badge: 'bg-slate-100 text-slate-600',
  iconBox: 'bg-slate-100 text-slate-600',
};

const KNOWN_CATEGORIES: Record<string, number> = {
  saudacao: 0,
  orcamentos: 1,
  suporte: 2,
  'pos-venda': 3,
};

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function categoryOf(reply: QuickReplyItem) {
  return reply.category?.trim() || GENERAL;
}

function styleFor(category: string): CategoryStyle {
  if (category === GENERAL) return NEUTRAL;
  const key = normalize(category);
  const known = KNOWN_CATEGORIES[key];
  if (known !== undefined) return PALETTE[known];
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

function iconFor(category: string): ReactNode {
  switch (normalize(category)) {
    case 'saudacao':
      return <CoffeeIcon />;
    case 'orcamentos':
      return <DocIcon />;
    case 'suporte':
      return <HeadsetIcon />;
    case 'pos-venda':
      return <GiftIcon />;
    default:
      return <TagIcon />;
  }
}

/* ======================================================================
 * Página
 * ==================================================================== */

export function QuickReplies() {
  const [replies, setReplies] = useState<QuickReplyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<QuickReplyItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sort, setSort] = useState<SortKey>('recent');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function loadReplies() {
    setLoading(true);
    try {
      const { data } = await api.get<QuickReplyItem[]>('/quick-replies');
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
      .get<QuickReplyItem[]>('/quick-replies')
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

  function openEdit(reply: QuickReplyItem) {
    setEditing(reply);
    setModalOpen(true);
  }

  async function handleSaved() {
    setModalOpen(false);
    setEditing(null);
    await loadReplies();
  }

  async function handleDelete(reply: QuickReplyItem) {
    if (!confirm(`Excluir a resposta pronta "${reply.title}"?`)) return;
    try {
      await api.delete(`/quick-replies/${reply.id}`);
      setReplies((current) => current.filter((item) => item.id !== reply.id));
      setError('');
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  }

  async function handleCopy(reply: QuickReplyItem) {
    try {
      await navigator.clipboard.writeText(reply.content);
      setCopiedId(reply.id);
      window.setTimeout(() => setCopiedId((current) => (current === reply.id ? null : current)), 1800);
    } catch {
      setError('Não foi possível copiar. Selecione o texto e copie manualmente.');
    }
  }

  const categories = useMemo(
    () => Array.from(new Set(replies.map(categoryOf))).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [replies]
  );

  const filtered = useMemo(() => {
    const query = normalize(search);
    const list = replies.filter((reply) => {
      if (query && !normalize(reply.title).includes(query) && !normalize(reply.content).includes(query)) {
        return false;
      }
      if (categoryFilter !== 'all' && categoryOf(reply) !== categoryFilter) return false;
      return true;
    });

    return [...list].sort((a, b) => {
      if (sort === 'az') return a.title.localeCompare(b.title, 'pt-BR');
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [replies, search, categoryFilter, sort]);

  const groups = useMemo(() => {
    const map = new Map<string, QuickReplyItem[]>();
    for (const reply of filtered) {
      const key = categoryOf(reply);
      map.set(key, [...(map.get(key) ?? []), reply]);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const selected = filtered.find((reply) => reply.id === selectedId) ?? filtered[0] ?? null;

  const namedCategories = categories.filter((name) => name !== GENERAL).length;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-chatz-bg">
      <IconBar />

      <main className="relative flex-1 overflow-y-auto">
        {/* Blob decorativo do canto superior direito */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-32 h-80 w-[28rem] rounded-full
                     bg-gradient-to-br from-orange-200/70 via-pink-200/60 to-fuchsia-200/30 blur-2xl"
        />

        <div className="relative mx-auto max-w-[1400px] px-4 py-6 sm:px-8">
          {/* Header */}
          <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <PageBackButton />
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-fuchsia-600">Respostas rápidas</p>
                <h1 className="font-display text-3xl font-extrabold text-chatz-text">Respostas prontas</h1>
                <p className="mt-1 text-sm text-chatz-text-muted">
                  Padronize mensagens e agilize seus atendimentos.
                </p>
              </div>
            </div>
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-orange-500 px-5 py-3
                         text-sm font-semibold text-white shadow-[0_8px_20px_rgba(217,70,239,0.3)] transition hover:brightness-110"
            >
              <PlusIcon />
              Nova resposta
            </button>
          </header>

          {/* Métricas */}
          <section className="mb-5 grid gap-4 sm:grid-cols-2">
            <StatCard
              icon={<ChatIcon />}
              iconClass="bg-purple-100 text-purple-600"
              label="Total de respostas"
              value={String(replies.length)}
            />
            <StatCard
              icon={<FolderIcon />}
              iconClass="bg-orange-100 text-orange-500"
              label="Categorias"
              value={String(namedCategories)}
            />
          </section>

          {/* Busca e filtros */}
          <section className="mb-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto]">
            <label className="relative block">
              <span className="sr-only">Buscar respostas</span>
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                <SearchIcon />
              </span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por título ou conteúdo..."
                className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-4 text-sm text-chatz-text
                           shadow-sm outline-none transition focus:border-fuchsia-500 focus:ring-2 focus:ring-fuchsia-500/20"
              />
            </label>

            <FilterSelect label="Categoria" icon={<GridIcon />} value={categoryFilter} onChange={setCategoryFilter}>
              <option value="all">Todas as categorias</option>
              {categories.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </FilterSelect>

            <FilterSelect label="Ordenar" icon={<SortIcon />} value={sort} onChange={(value) => setSort(value as SortKey)}>
              <option value="recent">Ordenar por: Mais recentes</option>
              <option value="az">Ordenar por: A–Z</option>
            </FilterSelect>
          </section>

          {error && (
            <div
              role="alert"
              className="mb-5 rounded-chatz border border-chatz-danger-border bg-chatz-danger-light px-4 py-3 text-chatz-danger"
            >
              {error}
            </div>
          )}

          {/* Lista + painel de visualização */}
          {loading ? (
            <p className="py-16 text-center text-chatz-text-muted">Carregando respostas...</p>
          ) : replies.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-chatz-border bg-chatz-surface py-16 text-center">
              <p className="mb-3 text-chatz-text-muted">Ainda não há respostas prontas.</p>
              <button onClick={openCreate} className="text-sm font-medium text-fuchsia-600 hover:text-fuchsia-700">
                Criar a primeira resposta
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-chatz-border bg-chatz-surface py-16 text-center">
              <p className="text-chatz-text-muted">Nenhuma resposta encontrada com esses filtros.</p>
            </div>
          ) : (
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px] xl:items-start">
              <div className="space-y-4">
                {groups.map(([category, items]) => {
                  const style = styleFor(category);
                  return (
                    <section
                      key={category}
                      className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm"
                    >
                      <header className="flex items-center gap-3 px-4 py-3">
                        <span className={`h-6 w-1 rounded-full ${style.bar}`} />
                        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${style.iconBox}`}>
                          {iconFor(category)}
                        </span>
                        <h2 className="flex-1 font-bold text-chatz-text">{category}</h2>
                        <span className="text-xs text-chatz-text-muted">
                          {items.length} {items.length === 1 ? 'resposta' : 'respostas'}
                        </span>
                      </header>

                      <ul className="px-2 pb-2">
                        {items.map((reply) => (
                          <ReplyRow
                            key={reply.id}
                            reply={reply}
                            category={category}
                            selected={selected?.id === reply.id}
                            copied={copiedId === reply.id}
                            onSelect={() => setSelectedId(reply.id)}
                            onEdit={() => openEdit(reply)}
                            onCopy={() => void handleCopy(reply)}
                            onDelete={() => void handleDelete(reply)}
                          />
                        ))}
                      </ul>
                    </section>
                  );
                })}
              </div>

              {selected && (
                <PreviewPanel
                  reply={selected}
                  copied={copiedId === selected.id}
                  onCopy={() => void handleCopy(selected)}
                  onEdit={() => openEdit(selected)}
                />
              )}
            </div>
          )}

          {/* Dica fixa no rodapé */}
          <div
            className="mt-6 flex items-center gap-4 rounded-2xl bg-gradient-to-r from-purple-100 via-fuchsia-100 to-orange-100
                       px-5 py-4 text-sm text-slate-700 shadow-sm"
          >
            <span className="text-slate-700">
              <KeyboardIcon />
            </span>
            <p>
              <strong className="text-slate-900">Dica:</strong> digite{' '}
              <kbd className="mx-0.5 rounded-md border border-fuchsia-200 bg-white px-1.5 py-0.5 font-mono text-xs font-bold text-fuchsia-700">
                /
              </kbd>{' '}
              em uma conversa para inserir uma resposta rápida.
            </p>
          </div>
        </div>
      </main>

      {modalOpen && (
        <QuickReplyModal
          key={editing?.id ?? 'new'}
          reply={editing}
          categories={categories.filter((name) => name !== GENERAL)}
          onClose={() => setModalOpen(false)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}

/* ======================================================================
 * Peças da página
 * ==================================================================== */

function StatCard({
  icon,
  iconClass,
  label,
  value,
}: {
  icon: ReactNode;
  iconClass: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${iconClass}`}>{icon}</span>
      <div className="min-w-0">
        <p className="truncate text-sm text-chatz-text">{label}</p>
        <p className="text-3xl font-extrabold leading-tight text-chatz-text">{value}</p>
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  icon,
  value,
  onChange,
  children,
}: {
  label: string;
  icon: ReactNode;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="relative block">
      <span className="sr-only">{label}</span>
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fuchsia-600">{icon}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full cursor-pointer appearance-none rounded-2xl border border-slate-200 bg-white pl-11 pr-10
                   text-sm font-semibold text-chatz-text shadow-sm outline-none transition
                   focus:border-fuchsia-500 focus:ring-2 focus:ring-fuchsia-500/20"
      >
        {children}
      </select>
      <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500">
        <ChevronDownIcon />
      </span>
    </label>
  );
}

function ReplyRow({
  reply,
  category,
  selected,
  copied,
  onSelect,
  onEdit,
  onCopy,
  onDelete,
}: {
  reply: QuickReplyItem;
  category: string;
  selected: boolean;
  copied: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onCopy: () => void;
  onDelete: () => void;
}) {
  const style = styleFor(category);
  return (
    <li>
      <div
        role="button"
        tabIndex={0}
        onClick={onSelect}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onSelect();
          }
        }}
        className={`grid cursor-pointer items-center gap-3 rounded-xl px-3 py-3 transition sm:grid-cols-[11rem_minmax(0,1fr)_auto]
                    ${selected ? 'bg-fuchsia-50/60 ring-2 ring-inset ring-fuchsia-400' : 'hover:bg-slate-50'}
                    `}
      >
        <div className="min-w-0">
          <p className="truncate font-bold text-chatz-text">{reply.title}</p>
        </div>

        <p className="line-clamp-2 min-w-0 whitespace-pre-wrap break-words text-sm text-chatz-text">{reply.content}</p>

        <div className="flex items-center justify-between gap-3 sm:justify-end">
          <span className={`hidden rounded-full px-3 py-1 text-xs font-semibold md:inline-block ${style.badge}`}>
            {category}
          </span>
          <div className="flex items-center gap-2">
            <RowAction label="Editar" onClick={onEdit}>
              <PencilIcon />
            </RowAction>
            <RowAction label={copied ? 'Copiado!' : 'Copiar'} onClick={onCopy}>
              {copied ? <CheckIcon size={18} /> : <CopyIcon />}
            </RowAction>
            <RowAction label="Excluir" onClick={onDelete} danger>
              <TrashIcon />
            </RowAction>
          </div>
        </div>
      </div>
    </li>
  );
}

function RowAction({
  label,
  onClick,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className={`flex h-9 w-9 items-center justify-center rounded-full transition ${
        danger
          ? 'bg-rose-50 text-rose-500 hover:bg-rose-100'
          : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      {children}
    </button>
  );
}

function PreviewPanel({
  reply,
  copied,
  onCopy,
  onEdit,
}: {
  reply: QuickReplyItem;
  copied: boolean;
  onCopy: () => void;
  onEdit: () => void;
}) {
  const category = categoryOf(reply);
  const style = styleFor(category);

  return (
    <aside className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm xl:sticky xl:top-4">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-chatz-text">Visualização da resposta</h2>
      </div>

      <div className="mb-5 flex items-center gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-600 to-fuchsia-600 text-white shadow-md">
          <ChatIcon />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-xl font-extrabold text-chatz-text">{reply.title}</p>
            <span className={`rounded-full px-3 py-0.5 text-xs font-semibold ${style.badge}`}>{category}</span>
          </div>
        </div>
      </div>

      <h3 className="mb-2 text-sm font-bold text-chatz-text">Mensagem</h3>
      <div className="mb-5 min-h-[7rem] whitespace-pre-wrap break-words rounded-xl border border-slate-200 bg-white p-4 text-sm text-chatz-text">
        {reply.content}
      </div>

      <h3 className="mb-2 text-sm font-bold text-chatz-text">Ações rápidas</h3>
      <div className="mb-5 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3
                     text-sm font-semibold text-chatz-text shadow-sm transition hover:bg-slate-50"
        >
          {copied ? <CheckIcon size={18} /> : <CopyIcon />}
          {copied ? 'Copiado!' : 'Copiar resposta'}
        </button>
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-orange-500
                     px-3 py-3 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(217,70,239,0.25)] transition hover:brightness-110"
        >
          <PencilIcon />
          Editar resposta
        </button>
      </div>

      <div className="flex items-start gap-3 rounded-2xl bg-gradient-to-r from-orange-50 to-fuchsia-50 p-4">
        <span className="mt-0.5 text-amber-500">
          <BulbIcon />
        </span>
        <div className="flex-1">
          <p className="font-bold text-chatz-text">Dica de atalho</p>
          <p className="text-sm text-chatz-text-muted">Digite / no chat para ver todas as suas respostas rápidas.</p>
        </div>
        <kbd className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-2 border-fuchsia-300 bg-white font-mono text-sm font-bold text-fuchsia-700">
          /
        </kbd>
      </div>
    </aside>
  );
}

/* ======================================================================
 * Modal
 * ==================================================================== */

interface QuickReplyModalProps {
  reply: QuickReplyItem | null;
  categories: string[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}

function QuickReplyModal({ reply, categories, onClose, onSaved }: QuickReplyModalProps) {
  const [title, setTitle] = useState(reply?.title ?? '');
  const [content, setContent] = useState(reply?.content ?? '');
  const [category, setCategory] = useState(reply?.category ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const trimmedCategory = category.trim();
      const payload = {
        title,
        content,
        category: trimmedCategory || null,
      };

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-reply-modal-title"
        className="w-full max-w-xl rounded-2xl border border-chatz-border bg-chatz-surface p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="quick-reply-modal-title" className="mb-5 text-xl font-bold text-chatz-text">
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
              className="mt-2 w-full rounded-xl border border-chatz-border bg-chatz-surface-alt px-4 py-3 text-chatz-text
                         outline-none focus:border-fuchsia-500 focus:ring-2 focus:ring-fuchsia-500/20"
            />
          </label>

          <label className="block text-sm font-medium text-chatz-text">
            Categoria <span className="font-normal text-chatz-text-muted">(opcional)</span>
            <input
              list="quick-reply-categories"
              maxLength={40}
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              placeholder="Ex.: Saudação, Orçamentos, Suporte"
              className="mt-2 w-full rounded-xl border border-chatz-border bg-chatz-surface-alt px-4 py-3 text-chatz-text
                         outline-none focus:border-fuchsia-500 focus:ring-2 focus:ring-fuchsia-500/20"
            />
            <datalist id="quick-reply-categories">
              {categories.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
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
              className="mt-2 w-full resize-y rounded-xl border border-chatz-border bg-chatz-surface-alt px-4 py-3 text-chatz-text
                         outline-none focus:border-fuchsia-500 focus:ring-2 focus:ring-fuchsia-500/20"
            />
          </label>

          {error && (
            <p role="alert" className="text-sm text-chatz-danger">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              disabled={saving}
              onClick={onClose}
              className="flex-1 rounded-xl border border-chatz-border bg-chatz-surface-alt py-3 font-medium text-chatz-text"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-xl bg-gradient-to-r from-fuchsia-600 to-orange-500 py-3 font-semibold text-white
                         transition hover:brightness-110 disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Salvar resposta'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

/* ======================================================================
 * Ícones
 * ==================================================================== */

function Svg({ children, size = 20, fill = 'none' }: { children: ReactNode; size?: number; fill?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function SearchIcon() {
  return (<Svg><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></Svg>);
}
function GridIcon() {
  return (<Svg><rect width="7" height="7" x="3" y="3" rx="1" /><rect width="7" height="7" x="14" y="3" rx="1" /><rect width="7" height="7" x="14" y="14" rx="1" /><rect width="7" height="7" x="3" y="14" rx="1" /></Svg>);
}
function TagIcon() {
  return (<Svg><path d="M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4Z" /><circle cx="7.5" cy="7.5" r=".5" fill="currentColor" /></Svg>);
}
function SortIcon() {
  return (<Svg><path d="M4 6h16M7 12h10M10 18h4" /></Svg>);
}
function ChevronDownIcon() {
  return (<Svg size={18}><path d="m6 9 6 6 6-6" /></Svg>);
}
function PlusIcon() {
  return (<Svg><path d="M12 5v14M5 12h14" /></Svg>);
}
function PencilIcon() {
  return (<Svg size={18}><path d="M17 3a2.8 2.8 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></Svg>);
}
function CopyIcon() {
  return (<Svg size={18}><rect width="13" height="13" x="9" y="9" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></Svg>);
}
function TrashIcon() {
  return (<Svg size={18}><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" /></Svg>);
}
function ChatIcon() {
  return (<Svg size={26}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></Svg>);
}
function FolderIcon() {
  return (<Svg size={26} fill="currentColor"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.7-.9L9.6 3.9A2 2 0 0 0 7.9 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" /></Svg>);
}
function CheckIcon({ size = 26 }: { size?: number }) {
  return (<Svg size={size}><path d="m5 12 5 5 9-10" /></Svg>);
}
function BulbIcon() {
  return (<Svg size={22}><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5M9 18h6M10 22h4" /></Svg>);
}
function KeyboardIcon() {
  return (<Svg size={26}><rect width="20" height="16" x="2" y="4" rx="2" /><path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10" /></Svg>);
}
function CoffeeIcon() {
  return (<Svg size={18}><path d="M10 2v2M14 2v2M6 2v2M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1" /></Svg>);
}
function DocIcon() {
  return (<Svg size={18}><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4M10 9H8M16 13H8M16 17H8" /></Svg>);
}
function HeadsetIcon() {
  return (<Svg size={18}><path d="M3 14v-2a9 9 0 0 1 18 0v2" /><path d="M21 16a2 2 0 0 1-2 2h-1v-6h1a2 2 0 0 1 2 2ZM3 16a2 2 0 0 0 2 2h1v-6H5a2 2 0 0 0-2 2Z" /></Svg>);
}
function GiftIcon() {
  return (<Svg size={18}><rect width="18" height="4" x="3" y="8" rx="1" /><path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5" /></Svg>);
}