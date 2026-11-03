import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, getErrorMessage } from '../lib/api';
import { IconBar } from '../components/chat/IconBar';
import { ProfileAvatar } from '../components/ProfileAvatar';
import { useAuthStore } from '../stores/auth';
import type { Contact, Sector, Tag, Ticket } from '../types';

const PAGE_SIZE = 10;

type SegmentFilter = 'all' | 'withCompany' | 'withoutCompany';
type InteractionPeriod = 'all' | '7' | '30' | '90';

// ==========================
// Helpers
// ==========================
function formatDate(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateTime(value: string | null | undefined, separator: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${formatDate(value)}${separator}${time}`;
}

function formatCount(value: number | null | undefined): string {
  return typeof value === 'number' ? value.toLocaleString('pt-BR') : '—';
}

const TAG_TONES = [
  'bg-violet-100 text-violet-700',
  'bg-sky-100 text-sky-700',
  'bg-emerald-100 text-emerald-700',
  'bg-orange-100 text-orange-700',
];

// Tag só tem `name`: a cor é derivada do nome para ficar sempre a mesma.
function getTagTone(name: string): string {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return TAG_TONES[hash % TAG_TONES.length];
}

function csvCell(value: string, guardFormulas = true): string {
  const safe = guardFormulas && /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const source = text.replace(/^\uFEFF/, '');
  let commas = 0;
  let semicolons = 0;
  let inHeaderQuote = false;
  for (let index = 0; index < source.length && source[index] !== '\n' && source[index] !== '\r'; index += 1) {
    if (source[index] === '"' && source[index + 1] === '"') {
      index += 1;
    } else if (source[index] === '"') {
      inHeaderQuote = !inHeaderQuote;
    } else if (!inHeaderQuote && source[index] === ',') {
      commas += 1;
    } else if (!inHeaderQuote && source[index] === ';') {
      semicolons += 1;
    }
  }
  const delimiter = semicolons > commas ? ';' : ',';

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        cell += character;
      }
    } else if (character === '"' && cell.length === 0) {
      quoted = true;
    } else if (character === delimiter) {
      row.push(cell);
      cell = '';
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && source[index + 1] === '\n') index += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += character;
    }
  }

  if (quoted) throw new Error('O arquivo CSV contém um campo entre aspas sem fechamento.');
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

function normalizeCsvHeader(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

function downloadContactsCsv(list: Contact[]) {
  const header = ['Nome', 'Telefone', 'Empresa', 'Etiquetas', 'Cadastro'];
  const rows = list.map((contact) => [
    csvCell(contact.name),
    csvCell(contact.phone, false),
    csvCell(contact.company ?? ''),
    csvCell((contact.tags ?? []).map((tag) => tag.name).join('; ')),
    csvCell(formatDate(contact.createdAt), false),
  ]);
  const csv = '\uFEFF' + [header.map((cell) => csvCell(cell)), ...rows].map((row) => row.join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `contatos-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

// Paginação no padrão da referência: 1 2 3 ··· 42
function getPageNumbers(current: number, total: number): Array<number | 'ellipsis'> {
  if (total <= 5) return Array.from({ length: total }, (_, index) => index + 1);
  if (current <= 3) return [1, 2, 3, 'ellipsis', total];
  if (current >= total - 2) return [1, 'ellipsis', total - 2, total - 1, total];
  return [1, 'ellipsis', current - 1, current, current + 1, 'ellipsis', total];
}

// ==========================
// Página
// ==========================
export function Contacts() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState('');
  const [segment, setSegment] = useState<SegmentFilter>('all');
  const [tagFilter, setTagFilter] = useState('all');
  const [period, setPeriod] = useState<InteractionPeriod>('all');
  const [periodCutoff, setPeriodCutoff] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<Contact | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [startingContact, setStartingContact] = useState<Contact | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState('');
  const importInputRef = useRef<HTMLInputElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [menuId, setMenuId] = useState<string | null>(null);
  const [monthStart] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  });
  const editContactId = searchParams.get('edit');

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await api.get<Contact[]>('/contacts', {
          params: search.trim() ? { q: search.trim() } : undefined,
          signal: controller.signal,
        });
        setContacts(data);
        setError('');
      } catch (requestError) {
        if (!controller.signal.aborted) setError(getErrorMessage(requestError));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [refreshKey, search]);

  useEffect(() => {
    if (!editContactId) return;
    let active = true;
    api
      .get<Contact>(`/contacts/${editContactId}`)
      .then(({ data }) => {
        if (!active) return;
        setEditing(data);
        setModalOpen(true);
      })
      .catch((requestError: unknown) => {
        if (active) setError(getErrorMessage(requestError));
      });

    return () => {
      active = false;
    };
  }, [editContactId]);

  // Fecha o menu "⋯" ao clicar em qualquer outro lugar.
  useEffect(() => {
    if (!menuId) return;
    const close = () => setMenuId(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [menuId]);

  const tagOptions = useMemo(() => {
    const map = new Map<string, Tag>();
    contacts.forEach((contact) => contact.tags?.forEach((tag) => map.set(tag.id, tag)));
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [contacts]);

  const filteredContacts = useMemo(() => {
    return contacts.filter((contact) => {
      if (segment === 'withCompany' && !contact.company) return false;
      if (segment === 'withoutCompany' && contact.company) return false;
      if (tagFilter !== 'all' && !contact.tags?.some((tag) => tag.id === tagFilter)) return false;
      if (periodCutoff !== null) {
        const lastInteraction = contact.lastInteractionAt
          ? new Date(contact.lastInteractionAt).getTime()
          : Number.NaN;
        if (!Number.isFinite(lastInteraction) || lastInteraction < periodCutoff) return false;
      }
      return true;
    });
  }, [contacts, segment, tagFilter, periodCutoff]);

  const hasConversationData = filteredContacts.some(
    (contact) => typeof contact.conversationsCount === 'number'
  );
  const newThisMonth = filteredContacts.filter(
    (contact) => new Date(contact.createdAt).getTime() >= monthStart
  ).length;
  const withConversations = hasConversationData
    ? filteredContacts.filter((contact) => (contact.conversationsCount ?? 0) > 0).length
    : null;
  const withoutService = hasConversationData
    ? filteredContacts.filter((contact) => (contact.conversationsCount ?? 0) === 0).length
    : null;

  const totalPages = Math.max(1, Math.ceil(filteredContacts.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visibleContacts = filteredContacts.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const firstItem = filteredContacts.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const lastItem = Math.min(currentPage * PAGE_SIZE, filteredContacts.length);

  const selectedContact = contacts.find((contact) => contact.id === selectedId) ?? null;
  const checkedContacts = contacts.filter((contact) => checkedIds.has(contact.id));
  const allVisibleChecked =
    visibleContacts.length > 0 && visibleContacts.every((contact) => checkedIds.has(contact.id));
  const hasActiveFilters =
    Boolean(search) || segment !== 'all' || tagFilter !== 'all' || period !== 'all';

  function resetPage() {
    setPage(1);
  }

  function toggleChecked(contactId: string) {
    setCheckedIds((current) => {
      const next = new Set(current);
      if (next.has(contactId)) next.delete(contactId);
      else next.add(contactId);
      return next;
    });
  }

  function toggleAllVisible() {
    setCheckedIds((current) => {
      const next = new Set(current);
      if (allVisibleChecked) visibleContacts.forEach((contact) => next.delete(contact.id));
      else visibleContacts.forEach((contact) => next.add(contact.id));
      return next;
    });
  }

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(contact: Contact) {
    setEditing(contact);
    setModalOpen(true);
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;

    setImporting(true);
    setImportResult('');
    setError('');
    try {
      const rows = parseCsv(await file.text());
      if (rows.length === 0) throw new Error('O arquivo CSV está vazio.');
      const headers = rows[0].map(normalizeCsvHeader);
      const nameIndex = headers.findIndex((header) => header === 'nome' || header === 'name');
      const phoneIndex = headers.findIndex(
        (header) => header === 'telefone' || header === 'phone'
      );
      const companyIndex = headers.findIndex(
        (header) => header === 'empresa' || header === 'company'
      );
      const tagsIndex = headers.findIndex(
        (header) => header === 'etiquetas' || header === 'tags'
      );
      if (nameIndex < 0 || phoneIndex < 0) {
        throw new Error('O CSV precisa ter as colunas Nome e Telefone.');
      }

      const contactRows = rows.slice(1);
      if (contactRows.length > 500) {
        throw new Error('Importe no máximo 500 contatos por arquivo.');
      }

      const tagsByName = new Map<string, Tag>();
      if (tagsIndex >= 0) {
        const { data: availableTags } = await api.get<Tag[]>('/tags');
        availableTags.forEach((tag) => tagsByName.set(normalizeCsvHeader(tag.name), tag));
      }

      let imported = 0;
      const failures: string[] = [];
      for (const [index, row] of contactRows.entries()) {
        const name = row[nameIndex]?.trim();
        const phone = row[phoneIndex]?.trim();
        const company = companyIndex >= 0 ? row[companyIndex]?.trim() : '';
        if (!name || !phone) {
          failures.push(`Linha ${index + 2}: nome e telefone são obrigatórios.`);
          continue;
        }

        try {
          const { data: contact } = await api.post<Contact>('/contacts', {
            name,
            phone,
            ...(company ? { company } : {}),
          });
          imported += 1;
          const tagNames = row[tagsIndex]
            ?.split(';')
            .map((tagName) => tagName.trim())
            .filter(Boolean) ?? [];
          for (const tagName of tagNames) {
            const tag = tagsByName.get(normalizeCsvHeader(tagName));
            if (!tag) {
              failures.push(`Linha ${index + 2}: etiqueta "${tagName}" não encontrada.`);
              continue;
            }
            try {
              await api.post(`/contacts/${contact.id}/tags/${tag.id}`);
            } catch (requestError) {
              failures.push(
                `Linha ${index + 2}: não foi possível aplicar "${tagName}": ${getErrorMessage(requestError)}`
              );
            }
          }
        } catch (requestError) {
          failures.push(`Linha ${index + 2}: ${getErrorMessage(requestError)}`);
        }
      }

      setImportResult(
        `${imported} contato(s) importado(s); ${failures.length} falha(s).` +
          (failures.length ? ` ${failures.slice(0, 3).join(' ')}` : '')
      );
      if (imported > 0) setRefreshKey((key) => key + 1);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setImporting(false);
    }
  }

  function handleSaved() {
    setModalOpen(false);
    setEditing(null);
    setSearch('');
    setRefreshKey((key) => key + 1);
    if (editContactId) setSearchParams({});
  }

  function closeContactModal() {
    setModalOpen(false);
    setEditing(null);
    if (editContactId) setSearchParams({});
  }

  async function handleDelete(contact: Contact) {
    if (!confirm(`Excluir o contato "${contact.name}"?`)) return;

    setDeletingId(contact.id);
    setError('');
    try {
      await api.delete(`/contacts/${contact.id}`);
      setContacts((current) => current.filter((item) => item.id !== contact.id));
      setCheckedIds((current) => {
        const next = new Set(current);
        next.delete(contact.id);
        return next;
      });
      if (selectedId === contact.id) setSelectedId(null);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex h-[100dvh] w-screen overflow-hidden bg-[#f7f8fd]">
      <IconBar />
      <main className="relative min-w-0 flex-1 overflow-y-auto">
        {/* Brilho decorativo do canto superior direito */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-28 -top-36 h-[22rem] w-[22rem] rounded-full bg-[radial-gradient(circle_at_40%_60%,rgba(251,146,60,0.35),rgba(244,114,182,0.28)_45%,transparent_70%)]"
        />

        <div className="relative mx-auto flex max-w-[1760px] items-start gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="min-w-0 flex-1">
            <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="mb-1 text-xs font-bold uppercase tracking-[0.22em] text-fuchsia-600">
                  Relacionamento
                </p>
                <h1 className="font-display text-4xl font-extrabold tracking-tight text-slate-900">
                  Contatos
                </h1>
                <p className="mt-1 max-w-2xl text-sm text-slate-500 sm:text-base">
                  Gerencie seus clientes e acompanhe o relacionamento em um só lugar.
                </p>
              </div>
              <button
                type="button"
                onClick={openCreate}
                className="flex h-12 items-center gap-2 rounded-2xl bg-gradient-to-r from-fuchsia-600 via-pink-500 to-orange-500 px-6 text-sm font-bold text-white shadow-md shadow-pink-200/60 transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                <Icon name="plus" className="h-5 w-5" />
                Novo contato
              </button>
            </header>

            <section aria-label="Resumo dos contatos" className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                icon={<Icon name="users" className="h-7 w-7" />}
                tone="violet"
                label="Total de contatos"
                value={loading ? '—' : formatCount(filteredContacts.length)}
              />
              <MetricCard
                icon={<Icon name="userPlus" className="h-7 w-7" />}
                tone="green"
                label="Novos este mês"
                value={loading ? '—' : formatCount(newThisMonth)}
              />
              <MetricCard
                icon={<Icon name="chat" className="h-7 w-7" />}
                tone="orange"
                label="Com conversas"
                value={loading ? '—' : formatCount(withConversations)}
              />
              <MetricCard
                icon={<Icon name="userX" className="h-7 w-7" />}
                tone="rose"
                label="Sem atendimento"
                value={loading ? '—' : formatCount(withoutService)}
              />
            </section>

            <section
              className="mb-5 flex flex-col gap-3 rounded-3xl bg-white/70 p-3 ring-1 ring-slate-200/50 xl:flex-row xl:items-center"
              aria-label="Filtros dos contatos"
            >
              <input
                ref={importInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleImport}
                className="hidden"
                aria-label="Selecionar arquivo CSV de contatos"
              />
              <label
                htmlFor="contact-search"
                className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 shadow-sm transition focus-within:border-violet-300 focus-within:ring-2 focus-within:ring-violet-100"
              >
                <Icon name="search" className="h-5 w-5 shrink-0 text-slate-500" />
                <input
                  id="contact-search"
                  type="search"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    resetPage();
                  }}
                  placeholder="Buscar por nome, telefone ou empresa..."
                  className="h-[46px] min-w-0 flex-1 border-0 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
                />
              </label>

              <div className="flex flex-wrap gap-2.5">
                <FilterSelect
                  icon={<Icon name="grid" />}
                  label="Segmento"
                  value={segment}
                  onChange={(value) => {
                    setSegment(value as SegmentFilter);
                    resetPage();
                  }}
                >
                  <option value="all">Todos os contatos</option>
                  <option value="withCompany">Com empresa</option>
                  <option value="withoutCompany">Sem empresa</option>
                </FilterSelect>
                <FilterSelect
                  icon={<Icon name="tag" />}
                  label="Etiquetas"
                  value={tagFilter}
                  onChange={(value) => {
                    setTagFilter(value);
                    resetPage();
                  }}
                >
                  <option value="all">Etiquetas</option>
                  {tagOptions.map((tag) => (
                    <option key={tag.id} value={tag.id}>{tag.name}</option>
                  ))}
                </FilterSelect>
                <FilterSelect
                  icon={<Icon name="calendar" />}
                  label="Última interação"
                  value={period}
                  onChange={(value) => {
                    const nextPeriod = value as InteractionPeriod;
                    setPeriod(nextPeriod);
                    setPeriodCutoff(
                      nextPeriod === 'all'
                        ? null
                        : Date.now() - Number(nextPeriod) * 24 * 60 * 60 * 1000
                    );
                    resetPage();
                  }}
                >
                  <option value="all">Última interação</option>
                  <option value="7">Últimos 7 dias</option>
                  <option value="30">Últimos 30 dias</option>
                  <option value="90">Últimos 90 dias</option>
                </FilterSelect>
                <button
                  type="button"
                  onClick={() => importInputRef.current?.click()}
                  disabled={importing}
                  title="Importar contatos de um arquivo CSV"
                  className="flex h-[50px] items-center gap-2 rounded-full border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-50"
                >
                  <Icon name="download" />
                  {importing ? 'Importando...' : 'Importar'}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    downloadContactsCsv(checkedContacts.length > 0 ? checkedContacts : filteredContacts)
                  }
                  disabled={loading || filteredContacts.length === 0}
                  title={checkedContacts.length > 0 ? 'Exportar contatos selecionados' : 'Exportar contatos filtrados'}
                  className="flex h-[50px] items-center gap-2 rounded-full border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Icon name="upload" />
                  Exportar
                </button>
              </div>
            </section>

            {importResult && (
              <p role="status" aria-live="polite" className="mb-4 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-800">
                {importResult}
              </p>
            )}

            {error && (
              <p role="alert" className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {error}
              </p>
            )}

            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[15px] text-slate-800" aria-live="polite">
                {loading ? (
                  'Carregando contatos...'
                ) : (
                  <>
                    <span className="font-extrabold">{formatCount(filteredContacts.length)}</span>{' '}
                    <span className="font-semibold">
                      {filteredContacts.length === 1 ? 'contato encontrado' : 'contatos encontrados'}
                    </span>
                  </>
                )}
              </p>
              {checkedContacts.length > 0 && (
                <p className="flex items-center gap-3 text-sm text-slate-600">
                  {checkedContacts.length} {checkedContacts.length === 1 ? 'selecionado' : 'selecionados'}
                  <button
                    type="button"
                    onClick={() => setCheckedIds(new Set())}
                    className="font-semibold text-violet-600 hover:text-violet-700"
                  >
                    Limpar seleção
                  </button>
                </p>
              )}
            </div>

            <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/60">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] border-collapse text-left">
                  <thead>
                    <tr className="bg-[#f6f6fc] text-sm font-semibold text-slate-700">
                      <th scope="col" className="w-12 py-3.5 pl-5">
                        <input
                          type="checkbox"
                          aria-label="Selecionar todos os contatos da página"
                          checked={allVisibleChecked}
                          onChange={toggleAllVisible}
                          className="h-[18px] w-[18px] cursor-pointer rounded border-slate-300 accent-violet-600"
                        />
                      </th>
                      <th scope="col" className="px-3 py-3.5">Contato</th>
                      <th scope="col" className="px-3 py-3.5">Telefone</th>
                      <th scope="col" className="px-3 py-3.5">Empresa</th>
                      <th scope="col" className="px-3 py-3.5">Etiquetas</th>
                      <th scope="col" className="px-3 py-3.5">Última interação</th>
                      <th scope="col" className="px-3 py-3.5">Conversas</th>
                      <th scope="col" className="px-5 py-3.5 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {!loading && !error && visibleContacts.map((contact) => (
                      <tr
                        key={contact.id}
                        onClick={() => setSelectedId(contact.id)}
                        className={`cursor-pointer transition-colors ${
                          selectedId === contact.id ? 'bg-violet-50/60' : 'hover:bg-violet-50/30'
                        }`}
                      >
                        <td className="py-3.5 pl-5" onClick={(event) => event.stopPropagation()}>
                          <input
                            type="checkbox"
                            aria-label={`Selecionar ${contact.name}`}
                            checked={checkedIds.has(contact.id)}
                            onChange={() => toggleChecked(contact.id)}
                            className="h-[18px] w-[18px] cursor-pointer rounded border-slate-300 accent-violet-600"
                          />
                        </td>
                        <td className="px-3 py-3.5">
                          <div className="flex min-w-[170px] items-center gap-3">
                            <ProfileAvatar name={contact.name} sizeClass="h-11 w-11" textClass="text-xs" />
                            <p className="truncate text-sm font-bold text-slate-900">{contact.name}</p>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3.5 text-sm text-slate-700">
                          <span className="inline-flex items-center gap-2">
                            <Icon name="phone" className="h-4 w-4 text-slate-500" />
                            {contact.phone}
                          </span>
                        </td>
                        <td className="px-3 py-3.5 text-sm text-slate-700">
                          <span className="block max-w-[170px] truncate">{contact.company || '—'}</span>
                        </td>
                        <td className="px-3 py-3.5">
                          <TagList tags={contact.tags} />
                        </td>
                        <td className="whitespace-nowrap px-3 py-3.5 text-sm text-slate-700">
                          {formatDateTime(contact.lastInteractionAt, ' • ')}
                        </td>
                        <td className="px-3 py-3.5 text-sm text-slate-700">
                          <span className="inline-flex items-center gap-2">
                            <Icon name="chat" className="h-4 w-4 text-slate-500" />
                            {formatCount(contact.conversationsCount)}
                          </span>
                        </td>
                        <td className="px-5 py-3.5" onClick={(event) => event.stopPropagation()}>
                          <div className="relative flex items-center justify-end gap-2">
                            <RowAction label={`Ver detalhes de ${contact.name}`} onClick={() => setSelectedId(contact.id)}>
                              <Icon name="eye" className="h-4 w-4" />
                            </RowAction>
                            <RowAction label={`Editar ${contact.name}`} onClick={() => openEdit(contact)}>
                              <Icon name="pencil" className="h-4 w-4" />
                            </RowAction>
                            <RowAction
                              label={`Mais ações para ${contact.name}`}
                              onClick={() => setMenuId((current) => (current === contact.id ? null : contact.id))}
                            >
                              <Icon name="dots" className="h-4 w-4" />
                            </RowAction>
                            {menuId === contact.id && (
                              <div
                                role="menu"
                                className="absolute right-0 top-full z-20 mt-2 w-48 overflow-hidden rounded-2xl bg-white py-1.5 text-left shadow-xl ring-1 ring-slate-200"
                              >
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => {
                                    setMenuId(null);
                                    setStartingContact(contact);
                                  }}
                                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-violet-50"
                                >
                                  <Icon name="chat" className="h-4 w-4" />
                                  Iniciar conversa
                                </button>
                                <button
                                  type="button"
                                  role="menuitem"
                                  disabled={deletingId === contact.id}
                                  onClick={() => {
                                    setMenuId(null);
                                    void handleDelete(contact);
                                  }}
                                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                                >
                                  <Icon name="trash" className="h-4 w-4" />
                                  {deletingId === contact.id ? 'Excluindo...' : 'Excluir'}
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!loading && !error && visibleContacts.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-5 py-14 text-center">
                          <p className="text-sm font-semibold text-slate-700">
                            {hasActiveFilters ? 'Nenhum contato encontrado' : 'Nenhum contato cadastrado'}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {hasActiveFilters
                              ? 'Tente ajustar a busca ou os filtros.'
                              : 'Cadastre o primeiro contato para iniciar conversas.'}
                          </p>
                          {!hasActiveFilters && (
                            <button
                              type="button"
                              onClick={openCreate}
                              className="mt-3 text-sm font-semibold text-violet-600 hover:text-violet-700"
                            >
                              Cadastrar o primeiro contato
                            </button>
                          )}
                        </td>
                      </tr>
                    )}
                    {loading && (
                      <tr>
                        <td colSpan={8} className="px-5 py-14 text-center text-sm text-slate-500">
                          Carregando contatos...
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <footer className="mt-5 flex flex-wrap items-center justify-between gap-3 pb-2">
              <nav className="flex items-center gap-2" aria-label="Paginação dos contatos">
                <button
                  type="button"
                  aria-label="Página anterior"
                  disabled={currentPage <= 1 || loading}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-40"
                >
                  <Icon name="chevronLeft" className="h-4 w-4" />
                </button>
                {getPageNumbers(currentPage, totalPages).map((pageNumber, index) =>
                  pageNumber === 'ellipsis' ? (
                    <span key={`ellipsis-${index}`} className="px-1.5 text-sm tracking-widest text-slate-400">···</span>
                  ) : (
                    <button
                      key={pageNumber}
                      type="button"
                      aria-current={currentPage === pageNumber ? 'page' : undefined}
                      onClick={() => setPage(pageNumber)}
                      className={`h-10 min-w-10 rounded-full px-2 text-sm font-semibold transition ${
                        currentPage === pageNumber
                          ? 'bg-violet-600 text-white shadow-md shadow-violet-300/60'
                          : 'border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50'
                      }`}
                    >
                      {pageNumber}
                    </button>
                  )
                )}
                <button
                  type="button"
                  aria-label="Próxima página"
                  disabled={currentPage >= totalPages || loading}
                  onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-40"
                >
                  <Icon name="chevronRight" className="h-4 w-4" />
                </button>
              </nav>
              <p className="text-xs text-slate-500" aria-live="polite">
                Mostrando {firstItem}–{lastItem} de {formatCount(filteredContacts.length)} contatos
              </p>
            </footer>
          </div>

          {selectedContact && (
            <div
              aria-hidden="true"
              className="fixed inset-0 z-30 bg-slate-900/30 xl:hidden"
              onClick={() => setSelectedId(null)}
            />
          )}
          <ContactPanel
            contact={selectedContact}
            onClose={() => setSelectedId(null)}
            onEdit={openEdit}
            onStart={setStartingContact}
            onHistory={() => navigate('/history')}
          />
        </div>

        {modalOpen && (
          <ContactModal
            key={editing?.id ?? 'new'}
            contact={editing}
            onClose={closeContactModal}
            onSaved={handleSaved}
          />
        )}
        {startingContact && (
          <StartConversationModal
            contact={startingContact}
            onClose={() => setStartingContact(null)}
            onStarted={(ticket) => {
              setStartingContact(null);
              navigate(`/chat/${ticket.id}`);
            }}
          />
        )}
      </main>
    </div>
  );
}

// ==========================
// Painel de detalhes
// ==========================
interface ContactPanelProps {
  contact: Contact | null;
  onClose: () => void;
  onEdit: (contact: Contact) => void;
  onStart: (contact: Contact) => void;
  onHistory: () => void;
}

function ContactPanel({ contact, onClose, onEdit, onStart, onHistory }: ContactPanelProps) {
  const desktop =
    'xl:sticky xl:top-8 xl:inset-y-auto xl:right-auto xl:bottom-auto xl:z-auto xl:block xl:max-h-[calc(100dvh-4rem)] xl:w-[320px] xl:shrink-0 xl:self-start xl:overflow-y-auto xl:rounded-3xl';

  if (!contact) {
    return (
      <aside
        aria-label="Detalhes do contato"
        className={`hidden bg-white p-8 text-center shadow-sm ring-1 ring-slate-200/60 ${desktop}`}
      >
        <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-violet-100 text-violet-600">
          <Icon name="users" className="h-7 w-7" />
        </span>
        <p className="text-sm font-semibold text-slate-700">Selecione um contato</p>
        <p className="mt-1 text-xs text-slate-500">Os detalhes e ações rápidas aparecem aqui.</p>
      </aside>
    );
  }

  const memberSince = new Date(contact.createdAt).getFullYear();

  return (
    <aside
      aria-label={`Detalhes de ${contact.name}`}
      className={`fixed inset-y-0 right-0 z-40 w-[min(340px,100vw)] overflow-y-auto bg-white shadow-2xl ring-1 ring-slate-200/60 ${desktop} xl:shadow-sm`}
    >
      <div className="relative bg-gradient-to-b from-violet-100/80 to-transparent px-5 pb-2 pt-5">
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar detalhes"
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-slate-600 transition hover:bg-white/70"
        >
          <Icon name="close" className="h-5 w-5" />
        </button>
        <div className="flex flex-col items-center pt-4 text-center">
          <ProfileAvatar name={contact.name} sizeClass="h-24 w-24" textClass="text-4xl" />
          <h2 className="mt-3 max-w-full truncate text-xl font-extrabold text-slate-900">{contact.name}</h2>
          {!Number.isNaN(memberSince) && (
            <p className="text-xs text-slate-500">Cliente desde {memberSince}</p>
          )}
        </div>
      </div>

      <div className="space-y-4 px-5 pb-5">
        <ul className="space-y-3 text-sm text-slate-700">
          <InfoRow icon={<Icon name="phone" className="h-[18px] w-[18px]" />}>{contact.phone}</InfoRow>
          {contact.email && (
            <InfoRow icon={<Icon name="mail" className="h-[18px] w-[18px]" />}>{contact.email}</InfoRow>
          )}
          {contact.company && (
            <InfoRow icon={<Icon name="building" className="h-[18px] w-[18px]" />}>{contact.company}</InfoRow>
          )}
        </ul>

        <hr className="border-slate-100" />

        <div>
          <h3 className="mb-2.5 flex items-center gap-2 text-sm font-bold text-slate-800">
            <Icon name="tag" className="h-[18px] w-[18px]" />
            Etiquetas
          </h3>
          {contact.tags && contact.tags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {contact.tags.map((tag) => (
                <TagPill key={tag.id} name={tag.name} />
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500">Nenhuma etiqueta.</p>
          )}
        </div>

        <hr className="border-slate-100" />

        <dl className="space-y-3 text-sm">
          <div className="flex items-start gap-3">
            <Icon name="calendar" className="mt-0.5 h-[18px] w-[18px] shrink-0 text-slate-700" />
            <div>
              <dt className="font-bold text-slate-800">Última interação</dt>
              <dd className="text-slate-600">{formatDateTime(contact.lastInteractionAt, ' às ')}</dd>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Icon name="chat" className="mt-0.5 h-[18px] w-[18px] shrink-0 text-slate-700" />
            <div>
              <dt className="font-bold text-slate-800">Total de conversas</dt>
              <dd className="text-slate-600">{formatCount(contact.conversationsCount)}</dd>
            </div>
          </div>
        </dl>

        <button
          type="button"
          onClick={() => onStart(contact)}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-fuchsia-600 via-pink-500 to-orange-500 text-sm font-bold text-white shadow-md shadow-pink-200/60 transition hover:-translate-y-0.5 hover:shadow-lg"
        >
          <Icon name="chat" className="h-[18px] w-[18px]" />
          Iniciar conversa
        </button>

        <div>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-800">
            <Icon name="bolt" className="h-4 w-4" />
            Ações rápidas
          </h3>
          <div className="space-y-2">
            <QuickAction icon={<Icon name="clock" className="h-4 w-4" />} onClick={onHistory}>
              Ver histórico
            </QuickAction>
            <QuickAction icon={<Icon name="pencil" className="h-4 w-4" />} onClick={() => onEdit(contact)}>
              Editar contato
            </QuickAction>
          </div>
        </div>
      </div>
    </aside>
  );
}

function InfoRow({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-center gap-3">
      <span className="shrink-0 text-slate-700">{icon}</span>
      <span className="min-w-0 break-words">{children}</span>
    </li>
  );
}

function QuickAction({
  icon,
  onClick,
  children,
}: {
  icon: ReactNode;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50/60 text-xs font-semibold text-slate-700 transition hover:border-violet-300 hover:bg-violet-50"
    >
      {icon}
      {children}
    </button>
  );
}

// ==========================
// Componentes de apresentação
// ==========================
function TagPill({ name }: { name: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold ${getTagTone(name)}`}
    >
      <span aria-hidden="true" className="h-2 w-2 rounded-full bg-current" />
      {name}
    </span>
  );
}

function TagList({ tags }: { tags?: Tag[] }) {
  if (!tags || tags.length === 0) return <span className="text-sm text-slate-400">—</span>;
  const [first, ...rest] = tags;
  return (
    <div className="flex items-center gap-1.5">
      <TagPill name={first.name} />
      {rest.length > 0 && (
        <span
          title={rest.map((tag) => tag.name).join(', ')}
          className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-slate-100 px-1.5 text-xs font-bold text-slate-600"
        >
          +{rest.length}
        </span>
      )}
    </div>
  );
}

function RowAction({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-violet-300 hover:bg-violet-50"
    >
      {children}
    </button>
  );
}

type Tone = 'violet' | 'green' | 'orange' | 'rose';

const TONES: Record<Tone, { circle: string; stroke: string }> = {
  violet: { circle: 'bg-violet-100 text-violet-600', stroke: '#a855f7' },
  green: { circle: 'bg-emerald-100 text-emerald-600', stroke: '#10b981' },
  orange: { circle: 'bg-orange-100 text-orange-500', stroke: '#f97316' },
  rose: { circle: 'bg-rose-100 text-rose-500', stroke: '#f43f5e' },
};

function MetricCard({
  icon,
  tone,
  label,
  value,
}: {
  icon: ReactNode;
  tone: Tone;
  label: string;
  value: string;
}) {
  return (
    <article className="relative flex min-h-[96px] items-center gap-4 overflow-hidden rounded-2xl bg-white px-5 py-4 shadow-sm ring-1 ring-slate-200/50">
      <div className={`relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${TONES[tone].circle}`}>
        {icon}
      </div>
      <div className="relative z-10 min-w-0">
        <p className="truncate text-sm font-medium text-slate-600">{label}</p>
        <p className="mt-0.5 text-3xl font-extrabold tracking-tight text-slate-900">{value}</p>
      </div>
      <MiniWave tone={tone} />
    </article>
  );
}

function MiniWave({ tone }: { tone: Tone }) {
  const color = TONES[tone].stroke;
  const gradientId = `contacts-wave-${tone}`;
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 160 56"
      preserveAspectRatio="none"
      className="pointer-events-none absolute bottom-0 right-0 hidden h-14 w-44 sm:block"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M0 46c14 0 14-12 28-12s12 8 26 8 16-20 30-20 14 10 28 10 18-24 32-24 10 8 16 8V56H0Z"
        fill={`url(#${gradientId})`}
      />
      <path
        d="M0 46c14 0 14-12 28-12s12 8 26 8 16-20 30-20 14 10 28 10 18-24 32-24 10 8 16 8"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function FilterSelect({
  icon,
  label,
  value,
  onChange,
  children,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="relative flex h-[50px] min-w-0 items-center gap-2 rounded-full border border-slate-200 bg-white pl-4 pr-9 shadow-sm transition focus-within:border-violet-300 sm:min-w-[140px]">
      <span className="sr-only">{label}</span>
      <span className="shrink-0 text-slate-800">{icon}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full min-w-0 cursor-pointer appearance-none bg-transparent text-sm font-bold text-slate-800 outline-none"
      >
        {children}
      </select>
      <span className="pointer-events-none absolute right-3.5 text-slate-700">
        <Icon name="chevronDown" className="h-3.5 w-3.5" />
      </span>
    </label>
  );
}

// ==========================
// Ícones
// ==========================
type IconName =
  | 'search' | 'phone' | 'mail' | 'building' | 'tag' | 'calendar' | 'chat' | 'bolt'
  | 'eye' | 'pencil' | 'dots' | 'plus' | 'close' | 'download' | 'upload'
  | 'chevronDown' | 'chevronLeft' | 'chevronRight' | 'clock' | 'users' | 'userPlus'
  | 'userX' | 'trash' | 'grid';

const ICON_PATHS: Record<IconName, ReactNode> = {
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
  phone: <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z" />,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
  building: <path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M16 9h2a2 2 0 0 1 2 2v10M2 21h20M8 7h4M8 11h4M8 15h4" />,
  tag: <><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8Z" /><circle cx="7" cy="7" r="1.2" /></>,
  calendar: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>,
  chat: <path d="M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-5.4A8 8 0 1 1 21 12Z" />,
  bolt: <path d="M13 2 4 14h7l-1 8 9-12h-7z" />,
  eye: <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
  pencil: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></>,
  dots: <><circle cx="5" cy="12" r="1.4" fill="currentColor" /><circle cx="12" cy="12" r="1.4" fill="currentColor" /><circle cx="19" cy="12" r="1.4" fill="currentColor" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  close: <path d="M18 6 6 18M6 6l12 12" />,
  download: <path d="M12 3v12m0 0-4-4m4 4 4-4M4 21h16" />,
  upload: <path d="M12 15V3m0 0L8 7m4-4 4 4M4 21h16" />,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  chevronLeft: <path d="m15 18-6-6 6-6" />,
  chevronRight: <path d="m9 18 6-6-6-6" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M22 21v-2a4 4 0 0 0-3-3.9" /><circle cx="9" cy="7" r="4" /><path d="M16 3.1a4 4 0 0 1 0 7.8" /></>,
  userPlus: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M19 8v6M22 11h-6" /></>,
  userX: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="m17 8 5 5M22 8l-5 5" /></>,
  trash: <path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15M10 11v6M14 11v6" />,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
};

function Icon({ name, className = 'h-[18px] w-[18px]' }: { name: IconName; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {ICON_PATHS[name]}
    </svg>
  );
}

// ==========================
// Modais (lógica original mantida)
// ==========================
interface StartConversationModalProps {
  contact: Contact;
  onClose: () => void;
  onStarted: (ticket: Ticket) => void;
}

function StartConversationModal({
  contact,
  onClose,
  onStarted,
}: StartConversationModalProps) {
  const user = useAuthStore((state) => state.user);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [sectorId, setSectorId] = useState(user?.sectorId ?? '');
  const [loadingSectors, setLoadingSectors] = useState(user?.role === 'ADMIN');
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user?.role !== 'ADMIN') return;

    api
      .get<Sector[]>('/sectors?active=true')
      .then(({ data }) => {
        setSectors(data);
        setSectorId((current) => current || data[0]?.id || '');
      })
      .catch((requestError: unknown) => setError(getErrorMessage(requestError)))
      .finally(() => setLoadingSectors(false));
  }, [user?.role]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setStarting(true);
    try {
      const { data } = await api.post<Ticket>(
        `/contacts/${contact.id}/start-conversation`,
        sectorId ? { sectorId } : {}
      );
      onStarted(data);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
      setStarting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center
                 bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="start-conversation-title"
        className="w-full max-w-md bg-chatz-surface border border-chatz-border
                   rounded-chatz-xl p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2
          id="start-conversation-title"
          className="text-xl font-bold text-chatz-text mb-2"
        >
          Iniciar conversa
        </h2>
        <p className="text-sm text-chatz-text-muted mb-5">
          Atendimento para <strong>{contact.name}</strong> · {contact.phone}
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          {user?.role === 'ADMIN' ? (
            <label className="block text-sm font-medium text-chatz-text">
              Setor de atendimento
              <select
                required
                value={sectorId}
                onChange={(event) => setSectorId(event.target.value)}
                disabled={loadingSectors || sectors.length === 0}
                className="mt-2 w-full px-4 py-3 bg-chatz-surface-alt
                           border border-chatz-border rounded-chatz
                           text-chatz-text focus:border-chatz-primary
                           disabled:opacity-50"
              >
                {sectors.length === 0 && <option value="">Sem setores ativos</option>}
                {sectors.map((sector) => (
                  <option key={sector.id} value={sector.id}>
                    {sector.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="text-sm text-chatz-text-muted">
              A conversa será iniciada no seu setor
              {user?.sector?.name ? `: ${user.sector.name}` : '.'}
            </p>
          )}

          {error && <p role="alert" className="text-sm text-chatz-danger">{error}</p>}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={starting}
              className="flex-1 py-3 bg-chatz-surface-alt border
                         border-chatz-border text-chatz-text
                         font-medium rounded-chatz"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={starting || loadingSectors}
              className="flex-1 py-3 bg-chatz-primary hover:bg-chatz-primary-hover
                         text-white font-semibold rounded-chatz
                         disabled:opacity-50"
            >
              {starting ? 'Iniciando...' : 'Abrir atendimento'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

interface ContactModalProps {
  contact: Contact | null;
  onClose: () => void;
  onSaved: () => void;
}

function ContactModal({ contact, onClose, onSaved }: ContactModalProps) {
  const [name, setName] = useState(contact?.name ?? '');
  const [phone, setPhone] = useState(contact?.phone ?? '');
  const [company, setCompany] = useState(contact?.company ?? '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSaving(true);

    try {
      const payload = { name, phone, company };
      if (contact) {
        await api.patch(`/contacts/${contact.id}`, payload);
      } else {
        await api.post('/contacts', payload);
      }
      await onSaved();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center
                 bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="contact-modal-title"
        className="w-full max-w-md bg-chatz-surface border border-chatz-border
                   rounded-chatz-xl p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 id="contact-modal-title" className="text-xl font-bold text-chatz-text">
            {contact ? 'Editar contato' : 'Novo contato'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="text-chatz-text-muted hover:text-chatz-text text-2xl"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm font-medium text-chatz-text">
            Nome
            <input
              required
              minLength={2}
              maxLength={100}
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-2 w-full px-4 py-3 bg-chatz-surface-alt
                         border border-chatz-border rounded-chatz
                         text-chatz-text focus:border-chatz-primary"
            />
          </label>

          <label className="block text-sm font-medium text-chatz-text">
            Telefone
            <input
              required
              type="tel"
              minLength={8}
              maxLength={25}
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="+55 (11) 99999-9999"
              className="mt-2 w-full px-4 py-3 bg-chatz-surface-alt
                         border border-chatz-border rounded-chatz
                         text-chatz-text focus:border-chatz-primary"
            />
          </label>

          <label className="block text-sm font-medium text-chatz-text">
            Empresa <span className="font-normal text-chatz-text-subtle">(opcional)</span>
            <input
              maxLength={120}
              value={company}
              onChange={(event) => setCompany(event.target.value)}
              className="mt-2 w-full px-4 py-3 bg-chatz-surface-alt
                         border border-chatz-border rounded-chatz
                         text-chatz-text focus:border-chatz-primary"
            />
          </label>

          {error && (
            <p role="alert" className="text-sm text-chatz-danger">{error}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
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
              {saving ? 'Salvando...' : 'Salvar contato'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}