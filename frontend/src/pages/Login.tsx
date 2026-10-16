import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';
import { getErrorMessage } from '../lib/api';
import { Input, Checkbox, Button, LogoText } from '../components/ui';
import { ChatIllustration } from '../components/illustrations/ChatIllustration';

export function Login() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login({ email, password });
     navigate('/chat', { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  function preencher(email: string) {
    setEmail(email);
    setPassword('123456');
    setError('');
  }

  return (
    <div className="min-h-screen flex flex-col bg-chatz-bg relative overflow-hidden">
      {/* Blobs decorativos de fundo */}
      <div className="chatz-blob w-96 h-96 bg-chatz-primary/20 -top-20 -left-20" />
      <div className="chatz-blob w-[500px] h-[500px] bg-chatz-pink/10 -bottom-40 -right-40" />

      {/* Main */}
      <div className="flex-1 flex items-center justify-center p-6 relative z-10">
        <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">

          {/* ==========================
              LADO ESQUERDO — Branding
             ========================== */}
          <div className="hidden lg:flex flex-col gap-8 animate-fade-in-up">

            {/* Logo */}
            <div className="flex items-center gap-3">
              <img
                src="/logo.jpg"
                alt="chatZ"
                className="h-10 w-auto rounded-md"
              />
              <LogoText size="lg" />
            </div>

            {/* Headline */}
            <div className="space-y-4">
              <h1 className="text-5xl xl:text-6xl font-display font-extrabold leading-[1.1] tracking-tight">
                Seu atendimento,
                <br />
                em{' '}
                <span className="text-chatz-gradient">outro nível.</span>
              </h1>
              <p className="text-lg text-chatz-text-muted max-w-md leading-relaxed">
                Conecte seus canais, organize conversas e encante seus clientes em um só lugar.
              </p>
            </div>

            {/* Composição das imagens */}
            <div className="pt-4">
              <ChatIllustration />
            </div>
          </div>

          {/* ==========================
              LADO DIREITO — Form
             ========================== */}
          <div className="w-full max-w-md mx-auto lg:mx-0">
            {/* Logo (mobile) */}
            <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
              <img
                src="/logo.jpg"
                alt="chatZ"
                className="h-9 w-auto rounded-md"
              />
              <LogoText size="md" />
            </div>

            {/* Card */}
            <div className="bg-chatz-surface rounded-chatz-xl p-8 md:p-10 shadow-chatz-lg border border-chatz-border animate-fade-in">

              {/* Header */}
              <div className="mb-8">
                <h2 className="text-3xl font-display font-extrabold text-chatz-text mb-2 tracking-tight">
                  Boas-vindas de volta!
                </h2>
                <p className="text-chatz-text-muted">
                  Entre na sua conta para continuar.
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-5">

                {/* Email */}
                <Input
                  label="E-mail corporativo"
                  type="email"
                  name="email"
                  placeholder="voce@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  icon={<MailIcon />}
                />

                {/* Senha */}
                <Input
                  label="Senha"
                  type="password"
                  name="password"
                  placeholder="Digite sua senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  icon={<LockIcon />}
                />

                {/* Erro */}
                {error && (
                  <div className="bg-chatz-danger-light border border-chatz-danger-border text-chatz-danger text-sm rounded-chatz px-4 py-3 animate-[shake_0.4s_ease-in-out]">
                    {error}
                  </div>
                )}

                {/* Manter conectado + Esqueci senha */}
                <div className="flex items-center justify-between">
                  <Checkbox
                    label="Manter conectado"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                  />
                  <button
                    type="button"
                    className="text-sm font-medium text-chatz-primary hover:text-chatz-primary-hover transition-colors"
                    onClick={() => alert('Em breve!')}
                  >
                    Esqueci minha senha
                  </button>
                </div>

                {/* Botão */}
                <Button
                  type="submit"
                  variant="gradient"
                  size="lg"
                  fullWidth
                  loading={loading}
                  iconRight={!loading ? <ArrowRightIcon /> : undefined}
                >
                  Entrar na plataforma
                </Button>
              </form>

              {/* Rodapé do card */}
              <div className="mt-8 pt-6 border-t border-chatz-border text-center">
                <p className="text-sm text-chatz-text-muted">
                  Ainda não tem uma conta?{' '}
                  <button
                    onClick={() => alert('Entre em contato com o suporte para solicitar acesso')}
                    className="font-semibold text-chatz-primary hover:text-chatz-primary-hover transition-colors"
                  >
                    Solicite acesso
                  </button>
                </p>
              </div>
            </div>

            {/* Atalhos de teste (discretos) */}
            <div className="mt-6">
              <p className="text-xs text-chatz-text-subtle text-center mb-3 uppercase tracking-wider">
                🧪 Atalhos de teste
              </p>
              <div className="grid grid-cols-2 gap-2">
                <TestButton label="👑 Admin" onClick={() => preencher('admin@chatz.com')} />
                <TestButton label="🎧 Ana (Suporte)" onClick={() => preencher('ana@chatz.com')} />
                <TestButton label="🎧 Bruno (Certificados)" onClick={() => preencher('bruno@chatz.com')} />
                <TestButton label="🎧 Carla (Comercial)" onClick={() => preencher('carla@chatz.com')} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Rodapé */}
      <footer className="relative z-10 py-6 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-chatz-text-subtle">
          <p>© 2026 chatZ · Todos os direitos reservados</p>
          <div className="flex items-center gap-4">
            <Link to="#" className="hover:text-chatz-text-muted transition-colors">
              Privacidade
            </Link>
            <span>·</span>
            <Link to="#" className="hover:text-chatz-text-muted transition-colors">
              Termos
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ==========================
// SUB-COMPONENTES
// ==========================
function TestButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3 py-2 text-xs text-chatz-text-muted
                 bg-chatz-surface border border-chatz-border rounded-chatz
                 hover:border-chatz-primary hover:text-chatz-primary
                 transition-all"
    >
      {label}
    </button>
  );
}

// ==========================
// ÍCONES
// ==========================
function MailIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}