import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';
import { getErrorMessage } from '../lib/api';
import { Input, Checkbox, Button } from '../components/ui';

export function Login() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login({ email, password });
      navigate('/chat', { replace: true });
    } catch (loginError) {
      setError(getErrorMessage(loginError));
    } finally {
      setLoading(false);
    }
  }

  function fillTestAccount(accountEmail: string) {
    setEmail(accountEmail);
    setPassword('123456');
    setError('');
  }

  return (
    <main className="login-page flex min-h-screen items-center justify-center overflow-x-hidden px-5 py-10 sm:px-8 lg:px-12">
      <div className="login-layout grid w-full max-w-[1280px] items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(430px,0.82fr)] xl:gap-16">
        <section className="login-intro mx-auto w-full max-w-[600px]">
          <ChatZLogo size="small" />
          <div className="login-intro-copy mt-9">
            <h1>
              <img
                src="/chatz-login-welcome.png"
                alt="Bem-vindo ao chatZ!"
                className="login-welcome-image"
              />
            </h1>
            <p className="mt-5 max-w-md text-base leading-7 text-indigo-100/85 sm:text-lg">
              Conecte-se, converse e transforme suas ideias em algo incrível.
            </p>
          </div>

          <div className="mt-8 grid max-w-[500px] grid-cols-3 gap-3">
            <FeatureCard icon={<BoltIcon />} title={<>Comunicação<br />instantânea</>} />
            <FeatureCard icon={<ShieldCheckIcon />} title={<>Segurança e<br />privacidade</>} />
            <FeatureCard icon={<TeamIcon />} title={<>Conecte-se<br />com facilidade</>} />
          </div>

          <div className="login-tagline mt-9 flex max-w-[500px] items-center gap-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-indigo-100/75 sm:text-xs">
            <span className="h-1 w-16 shrink-0 rounded-full bg-gradient-to-r from-blue-500 via-fuchsia-500 to-orange-400" />
            Mais conexões. Mais possibilidades.
          </div>
        </section>

        <section
          aria-labelledby="login-title"
          className="login-card mx-auto flex w-full max-w-[520px] items-center justify-center px-6 py-8 sm:px-10 sm:py-9 lg:px-11"
        >
          <div className="w-full max-w-[430px]">
            <div className="mb-6 text-center">
              <ChatZLogo size="compact" />
              <h2
                id="login-title"
                className="mt-4 font-display text-2xl font-extrabold tracking-tight text-white sm:text-[1.7rem]"
              >
                Faça login na sua conta
              </h2>
              <p className="mt-1.5 text-sm text-indigo-100/75">
                Entre para continuar sua jornada.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="login-form space-y-4">
              <Input
                label="E-mail"
                type="email"
                name="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoComplete="email"
                icon={<MailIcon />}
                className="login-input"
              />

              <Input
                label="Senha"
                type="password"
                name="password"
                placeholder="Digite sua senha"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                autoComplete="current-password"
                icon={<LockIcon />}
                className="login-input"
              />

              {error && (
                <div
                  role="alert"
                  className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200 animate-[shake_0.4s_ease-in-out]"
                >
                  {error}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <Checkbox
                  label="Lembrar de mim"
                  checked={remember}
                  onChange={(event) => setRemember(event.target.checked)}
                  className="login-checkbox"
                />
                <button
                  type="button"
                  className="login-link text-xs font-bold sm:text-[13px]"
                  onClick={() => alert('Em breve!')}
                >
                  Esqueceu sua senha?
                </button>
              </div>

              <Button
                type="submit"
                variant="gradient"
                size="lg"
                fullWidth
                loading={loading}
                iconRight={!loading ? <ArrowRightIcon /> : undefined}
                className="login-submit"
              >
                Entrar no chatZ
              </Button>
            </form>

            {import.meta.env.DEV && (
              <details className="login-test-shortcuts mt-5 rounded-2xl border border-violet-300/20 bg-white/[0.04] px-4 py-3">
                <summary className="cursor-pointer text-center text-xs font-semibold text-indigo-100/80">
                  Atalhos de teste
                </summary>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <TestButton label="Admin" onClick={() => fillTestAccount('admin@chatz.com')} />
                  <TestButton label="Ana · Suporte" onClick={() => fillTestAccount('ana@chatz.com')} />
                  <TestButton label="Bruno · Certificados" onClick={() => fillTestAccount('bruno@chatz.com')} />
                  <TestButton label="Carla · Comercial" onClick={() => fillTestAccount('carla@chatz.com')} />
                </div>
              </details>
            )}

            <div className="login-security-note mt-6 flex items-center justify-center gap-2 text-[11px] text-indigo-100/65">
              <ShieldIcon />
              <span>Seus dados estão seguros</span>
              <span aria-hidden="true">·</span>
              <Link to="#" className="transition-colors hover:text-white">
                Privacidade
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function FeatureCard({ icon, title }: { icon: ReactNode; title: ReactNode }) {
  return (
    <div className="login-feature-card min-h-[104px] rounded-2xl px-3 py-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/15 text-fuchsia-400">
        {icon}
      </span>
      <span className="mt-2 block text-[11px] font-medium leading-4 text-indigo-100/85 sm:text-xs">
        {title}
      </span>
    </div>
  );
}

/* ==========================
   LOGO (ícone + wordmark)
   Troque por <img src="/logo-chatz.png" /> se tiver o arquivo oficial.
   ========================== */
function ChatZLogo({ size }: { size: 'small' | 'compact' }) {
  const isSmall = size === 'small';
  return (
    <img
      src="/chatz-login-logo.png"
      alt="chatZ"
      className={`login-logo ${isSmall ? 'login-logo-intro' : 'login-logo-form'}`}
    />
  );
}

function TestButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-violet-300/25 bg-white/5 px-3 py-2 text-[11px] font-medium text-indigo-100 transition-colors hover:border-fuchsia-400/60 hover:bg-white/10"
    >
      {label}
    </button>
  );
}

function MailIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect width="18" height="11" x="3" y="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function ShieldCheckIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m13 2-3 8h8L8 22l3-9H4l9-11Z" />
    </svg>
  );
}

function TeamIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}