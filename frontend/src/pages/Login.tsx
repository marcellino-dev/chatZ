import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';
import { getErrorMessage } from '../lib/api';

export function Login() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login({ email, password });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  function preencher(email: string) {
    setEmail(email);
    setPassword('123456');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-chatz-bg p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-chatz-primary mb-1">
            chatZ 🚀
          </h1>
          <p className="text-chatz-muted text-sm">
            Sistema de atendimento em tempo real
          </p>
        </div>

        {/* Card de login */}
        <div className="bg-chatz-card border border-chatz-border rounded-2xl p-8 shadow-2xl">
          <h2 className="text-xl font-semibold text-chatz-text mb-6">
            Entrar
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-chatz-muted mb-2"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full px-4 py-3 bg-chatz-bg border border-chatz-border rounded-lg
                           text-chatz-text placeholder-chatz-muted
                           focus:border-chatz-primary focus:ring-2 focus:ring-chatz-primary/20
                           transition-all"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-chatz-muted mb-2"
              >
                Senha
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
                className="w-full px-4 py-3 bg-chatz-bg border border-chatz-border rounded-lg
                           text-chatz-text placeholder-chatz-muted
                           focus:border-chatz-primary focus:ring-2 focus:ring-chatz-primary/20
                           transition-all"
              />
            </div>

            {error && (
              <div className="bg-chatz-danger/10 border border-chatz-danger/30 text-chatz-danger
                              text-sm rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-chatz-primary hover:bg-chatz-primary-hover
                         text-white font-semibold rounded-lg transition-all
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>

        {/* Atalhos de teste */}
        <div className="mt-6 bg-chatz-card/50 border border-chatz-border rounded-xl p-4">
          <p className="text-xs text-chatz-muted mb-3 text-center">
            🧪 Atalhos de teste (senha: 123456)
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              onClick={() => preencher('admin@chatz.com')}
              className="px-3 py-2 bg-chatz-bg hover:bg-chatz-card-hover
                         border border-chatz-border rounded-lg text-chatz-text
                         transition-all"
            >
              👑 Admin
            </button>
            <button
              onClick={() => preencher('ana@chatz.com')}
              className="px-3 py-2 bg-chatz-bg hover:bg-chatz-card-hover
                         border border-chatz-border rounded-lg text-chatz-text
                         transition-all"
            >
              🎧 Atendente
            </button>
            <button
              onClick={() => preencher('carlos@chatz.com')}
              className="px-3 py-2 bg-chatz-bg hover:bg-chatz-card-hover
                         border border-chatz-border rounded-lg text-chatz-text
                         transition-all"
            >
              👤 Cliente
            </button>
            <button
              onClick={() => preencher('bruno@chatz.com')}
              className="px-3 py-2 bg-chatz-bg hover:bg-chatz-card-hover
                         border border-chatz-border rounded-lg text-chatz-text
                         transition-all"
            >
              🎧 Atendente 2
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}