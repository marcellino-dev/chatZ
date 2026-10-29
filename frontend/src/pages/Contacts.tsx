import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, getErrorMessage } from '../lib/api';
import { IconBar } from '../components/chat/IconBar';
import { PageBackButton } from '../components/PageBackButton';
import { useAuthStore } from '../stores/auth';
import type { Contact, Sector, Ticket } from '../types';

export function Contacts() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<Contact | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [startingContact, setStartingContact] = useState<Contact | null>(null);
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

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(contact: Contact) {
    setEditing(contact);
    setModalOpen(true);
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
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="h-screen w-screen flex bg-chatz-bg overflow-hidden">
      <IconBar />
      <main className="flex-1 overflow-y-auto">
      <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <PageBackButton />
          <div>
          <h1 className="text-2xl font-bold text-chatz-text">Contatos</h1>
          <p className="text-chatz-text-muted text-sm">
            Cadastro centralizado dos contatos de clientes
          </p>
          </div>
        </div>
        <button
          onClick={openCreate}
          className="px-5 py-2.5 bg-chatz-primary hover:bg-chatz-primary-hover
                     text-white font-medium rounded-lg transition-all"
        >
          + Novo contato
        </button>
      </div>

      <div className="mb-5">
        <label htmlFor="contact-search" className="sr-only">
          Buscar contato
        </label>
        <input
          id="contact-search"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por nome, telefone ou empresa..."
          className="w-full px-4 py-3 bg-chatz-surface border border-chatz-border
                     rounded-chatz text-sm text-chatz-text
                     placeholder:text-chatz-text-subtle
                     focus:border-chatz-primary focus:ring-2
                     focus:ring-chatz-primary/20"
        />
      </div>

      {error && (
        <div className="bg-chatz-danger-light border border-chatz-danger-border
                        text-chatz-danger rounded-chatz px-4 py-3 mb-5">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-chatz-text-muted">
          Carregando contatos...
        </div>
      ) : error ? null : contacts.length === 0 ? (
        <div className="text-center py-16 bg-chatz-surface border border-dashed
                        border-chatz-border rounded-chatz-xl">
          <p className="text-chatz-text-muted mb-2">
            {search ? 'Nenhum contato encontrado.' : 'Nenhum contato cadastrado.'}
          </p>
          {!search && (
            <button
              onClick={openCreate}
              className="text-chatz-primary hover:text-chatz-primary-hover
                         text-sm font-medium"
            >
              Cadastrar o primeiro contato
            </button>
          )}
        </div>
      ) : (
        <div className="bg-chatz-surface border border-chatz-border
                        rounded-chatz-xl overflow-hidden">
          <div className="divide-y divide-chatz-border">
            {contacts.map((contact) => (
              <article
                key={contact.id}
                className="flex flex-wrap items-center justify-between gap-4
                           px-5 py-4"
              >
                <div className="min-w-0">
                  <h2 className="font-semibold text-chatz-text">{contact.name}</h2>
                  <p className="text-sm text-chatz-text-muted">{contact.phone}</p>
                  {contact.company && (
                    <p className="text-xs text-chatz-text-subtle mt-1">
                      {contact.company}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => openEdit(contact)}
                  className="px-3 py-2 border border-chatz-border
                             text-chatz-text text-sm rounded-chatz
                             hover:bg-chatz-surface-hover transition-all"
                >
                  Editar
                </button>
                <button
                  onClick={() => setStartingContact(contact)}
                  className="px-3 py-2 bg-chatz-primary text-white text-sm
                             rounded-chatz hover:bg-chatz-primary-hover
                             transition-all"
                >
                  Iniciar conversa
                </button>
                <button
                  onClick={() => handleDelete(contact)}
                  disabled={deletingId === contact.id}
                  className="px-3 py-2 border border-chatz-danger-border
                             text-chatz-danger text-sm rounded-chatz
                             hover:bg-chatz-danger-light transition-all
                             disabled:opacity-50"
                >
                  {deletingId === contact.id ? 'Excluindo...' : 'Excluir'}
                </button>
              </article>
            ))}
          </div>
        </div>
      )}

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
      </div>
      </main>
    </div>
  );
}

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
