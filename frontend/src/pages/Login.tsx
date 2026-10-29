import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';
import { getErrorMessage } from '../lib/api';
import { Input, Checkbox, Button, LogoFull } from '../components/ui';

const introImage = '/chatz_imagens_ptbr/fundo-tela-inicial.png';

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
    <main className="login-page min-h-screen lg:grid lg:min-h-screen lg:grid-cols-[1.08fr_0.92fr]">
      <section className="login-brand relative isolate flex min-h-[560px] flex-col overflow-hidden bg-[#f8f6f5] px-6 py-7 sm:min-h-[640px] sm:px-10 lg:min-h-screen lg:px-[8%] lg:py-10">
        <img
          src={introImage}
          alt="Atendimento chatZ reunindo conversas e canais em uma única tela"
          className="login-brand-image pointer-events-none absolute inset-x-0 bottom-0 translate-y-1 z-0 h-[230px] w-full object-contain object-bottom sm:h-[270px] lg:h-[57vh]"
        />

        <header className="relative z-20">
          <LogoFull size="md" />
        </header>

        <div className="relative z-20 mt-12 max-w-xl sm:mt-14 lg:mt-8">
          <h1 className="mt-0 font-display text-4xl font-extrabold leading-[1.08] tracking-tight text-slate-950 sm:text-5xl xl:text-[3.6rem]">
            Todos os seus canais,
            <br />
            <span className="text-chatz-gradient">em um só lugar.</span>
          </h1>
          <p className="mt-4 max-w-md text-sm leading-6 text-slate-600 sm:text-base">
            Conecte seus canais, organize conversas e encante seus clientes.
            Mais agilidade, controle e resultados para o seu atendimento.
          </p>

          <div className="mt-4 hidden gap-6 text-slate-700 sm:flex">
            <Feature icon={<BoltIcon />} title="Mais agilidade" />
            <Feature icon={<ShieldIcon />} title="Organização total" />
            <Feature icon={<HeartIcon />} title="Clientes satisfeitos" />
          </div>
        </div>

        <footer className="relative z-20 mt-auto hidden translate-y-3 items-center justify-between pt-8 text-[11px] text-slate-500 lg:flex">
          <span>© 2026 chatZ · Todos os direitos reservados</span>
          <span className="flex items-center gap-2">
            Atendimento <span className="text-slate-300">·</span> Organização{' '}
            <span className="text-slate-300">·</span> Resultados
          </span>
        </footer>
      </section>

      <section className="login-panel relative flex min-h-[650px] items-center justify-center overflow-hidden px-5 py-10 sm:px-8 lg:min-h-screen lg:px-10">
        <div className="login-panel-glow pointer-events-none absolute -right-36 -top-32 h-96 w-96 rounded-full" />
        <div className="login-panel-ring pointer-events-none absolute right-[8%] top-[12%] hidden h-64 w-64 rounded-full lg:block" />

        <div className="relative z-10 w-full max-w-[460px] animate-fade-in">
          <div className="rounded-[26px] border border-slate-700/70 bg-slate-900/65 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-9">
            <div className="flex items-center gap-2.5">
              <img
                src="/logo.jpg"
                alt="chatZ"
                className="h-8 w-8 rounded-md object-cover"
              />
              <span className="font-display text-2xl font-extrabold tracking-tight">
                <span className="text-white">chat</span>
                <span className="text-chatz-gradient">Z</span>
              </span>
            </div>

            <div className="mb-7 mt-8">
              <h2 className="font-display text-3xl font-extrabold tracking-tight text-white sm:text-[2rem]">
                Boas-vindas de volta!
              </h2>
              <p className="mt-2 text-sm text-slate-400">
                Entre na sua conta para continuar.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <Input
                label="E-mail corporativo"
                type="email"
                name="email"
                placeholder="voce@empresa.com"
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
                  className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-300 animate-[shake_0.4s_ease-in-out]"
                >
                  {error}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <Checkbox
                  label="Manter conectado"
                  checked={remember}
                  onChange={(event) => setRemember(event.target.checked)}
                  className="login-checkbox"
                />
                <button
                  type="button"
                  className="text-xs font-medium text-slate-400 transition-colors hover:text-pink-300"
                  onClick={() => alert('Em breve!')}
                >
                  Esqueci minha senha
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
                Entrar na plataforma
              </Button>
            </form>

            <div className="mt-7 flex items-center gap-4 text-[10px] uppercase tracking-[0.18em] text-slate-500">
              <span className="h-px flex-1 bg-slate-700" />
              ou
              <span className="h-px flex-1 bg-slate-700" />
            </div>

            <p className="mt-5 text-center text-xs text-slate-400">
              Ainda não tem uma conta?{' '}
              <button
                type="button"
                onClick={() =>
                  alert('Entre em contato com o suporte para solicitar acesso')
                }
                className="font-semibold text-orange-400 transition-colors hover:text-orange-300"
              >
                Solicite acesso
              </button>
            </p>

            <div className="login-test-shortcuts mt-7 border-t border-slate-700/70 pt-5">
              <p className="mb-3 text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Atalhos de teste
              </p>
              <div className="grid grid-cols-2 gap-2">
                <TestButton label="Admin" onClick={() => fillTestAccount('admin@chatz.com')} />
                <TestButton label="Ana · Suporte" onClick={() => fillTestAccount('ana@chatz.com')} />
                <TestButton label="Bruno · Certificados" onClick={() => fillTestAccount('bruno@chatz.com')} />
                <TestButton label="Carla · Comercial" onClick={() => fillTestAccount('carla@chatz.com')} />
              </div>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-center gap-2 text-[11px] text-slate-500">
            <ShieldIcon />
            Seus dados estão seguros
            <span className="text-slate-700">·</span>
            <Link to="#" className="transition-colors hover:text-slate-300">
              Privacidade
            </Link>
            <span className="text-slate-700">·</span>
            <Link to="#" className="transition-colors hover:text-slate-300">
              Termos
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

function Feature({
  icon,
  title,
}: {
  icon: ReactNode;
  title: string;
}) {
  return (
    <div className="flex max-w-[118px] items-start gap-2">
      <span className="mt-0.5 text-slate-800">{icon}</span>
      <span className="text-[11px] font-semibold leading-4">{title}</span>
    </div>
  );
}

function TestButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-slate-700/80 bg-slate-800/50 px-3 py-2 text-[11px] font-medium text-slate-300 transition-all hover:border-pink-500/50 hover:bg-slate-800 hover:text-white"
    >
      {label}
    </button>
  );
}

function MailIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect width="18" height="11" x="3" y="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m13 2-3 8h8L8 22l3-9H4l9-11Z" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" />
    </svg>
  );
}
