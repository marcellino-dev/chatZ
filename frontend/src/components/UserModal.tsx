import { useState, useEffect, FormEvent } from 'react';
import { useUsersStore } from '../stores/users';
import { useSectorsStore } from '../stores/sectors';
import { getErrorMessage } from '../lib/api';
import type { User } from '../types';

interface Props {
  isOpen: boolean;
  user?: User | null;
  onClose: () => void;
}

export function UserModal({ isOpen, user, onClose }: Props) {
  const { createUser, updateUser } = useUsersStore();
  const { sectors, fetchSectors } = useSectorsStore();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'ADMIN' | 'AGENT'>('AGENT');
  const [sectorId, setSectorId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isEdit = !!user;

  useEffect(() => {
    if (isOpen && sectors.length === 0) {
      fetchSectors(true);
    }
  }, [isOpen, sectors.length, fetchSectors]);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email ?? '');
      setPassword('');
      setRole(user.role === 'ADMIN' ? 'ADMIN' : 'AGENT');
      setSectorId(user.sectorId ?? '');
    } else {
      setName('');
      setEmail('');
      setPassword('');
      setRole('AGENT');
      setSectorId('');
    }
    setError('');
  }, [user, isOpen]);

  if (!isOpen) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isEdit && user) {
        const updateData: any = { name, email, role, active: true };

        if (password) updateData.password = password;
        if (role === 'AGENT' && sectorId) updateData.sectorId = sectorId;
        if (role === 'ADMIN') updateData.sectorId = null;

        await updateUser(user.id, updateData);
      } else {
        await createUser({
          name,
          email,
          password,
          role,
          sectorId: role === 'AGENT' ? sectorId : undefined,
        });
      }
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-chatz-card border border-chatz-border rounded-2xl w-full max-w-md p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-chatz-text">
            {isEdit ? 'Editar usuário' : 'Novo usuário'}
          </h2>
          <button
            onClick={onClose}
            className="text-chatz-muted hover:text-chatz-text text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-chatz-muted mb-2">
              Nome
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 bg-chatz-bg border border-chatz-border rounded-lg
                         text-chatz-text placeholder-chatz-muted
                         focus:border-chatz-primary transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-chatz-muted mb-2">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-chatz-bg border border-chatz-border rounded-lg
                         text-chatz-text placeholder-chatz-muted
                         focus:border-chatz-primary transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-chatz-muted mb-2">
              Senha {isEdit && '(deixe vazio para não alterar)'}
            </label>
            <input
              type="password"
              required={!isEdit}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isEdit ? '••••••' : ''}
              className="w-full px-4 py-3 bg-chatz-bg border border-chatz-border rounded-lg
                         text-chatz-text placeholder-chatz-muted
                         focus:border-chatz-primary transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-chatz-muted mb-2">
              Papel
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'ADMIN' | 'AGENT')}
              className="w-full px-4 py-3 bg-chatz-bg border border-chatz-border rounded-lg
                         text-chatz-text focus:border-chatz-primary transition-all"
            >
              <option value="AGENT">🎧 Atendente</option>
              <option value="ADMIN">👑 Administrador</option>
            </select>
          </div>

          {role === 'AGENT' && (
            <div>
              <label className="block text-sm font-medium text-chatz-muted mb-2">
                Setor
              </label>
              <select
                value={sectorId}
                onChange={(e) => setSectorId(e.target.value)}
                required
                className="w-full px-4 py-3 bg-chatz-bg border border-chatz-border rounded-lg
                           text-chatz-text focus:border-chatz-primary transition-all"
              >
                <option value="">Selecione um setor</option>
                {sectors
                  .filter((s) => s.active)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </select>
            </div>
          )}

          {error && (
            <div className="bg-chatz-danger/10 border border-chatz-danger/30 text-chatz-danger
                            text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-chatz-bg hover:bg-chatz-card-hover
                         border border-chatz-border text-chatz-text font-medium
                         rounded-lg transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 bg-chatz-primary hover:bg-chatz-primary-hover
                         text-white font-semibold rounded-lg transition-all
                         disabled:opacity-50"
            >
              {loading ? 'Salvando...' : isEdit ? 'Salvar' : 'Criar usuário'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}