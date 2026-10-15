export function ChatIllustration() {
  return (
    <div className="relative w-full max-w-[520px] mx-auto">
      {/* Container com aspect ratio fixo */}
      <div className="relative w-full aspect-[4/3]">

        {/* ==========================
            COLUNA DE CANAIS (esquerda)
            ========================== */}
        <div className="absolute top-[20%] left-0 z-20">
          <img
            src="/chatz_imagens_ptbr/barra-canais.png"
            alt=""
            className="w-[88px] md:w-[96px]"
          />
        </div>

        {/* ==========================
            LISTA DE CONVERSAS (topo direita)
            ========================== */}
        <div className="absolute top-[10%] left-[22%] z-10">
          <img
            src="/chatz_imagens_ptbr/lista-conversas.png"
            alt=""
            className="w-[220px] md:w-[240px]"
          />
        </div>

        {/* ==========================
            JANELA DE ATENDIMENTO (baixo direita)
            ========================== */}
        <div className="absolute top-[35%] left-[45%] z-30">
          <img
            src="/chatz_imagens_ptbr/janela-atendimento.png"
            alt=""
            className="w-[260px] md:w-[280px]"
          />
        </div>

        {/* ==========================
            ÍCONES FLUTUANTES DECORATIVOS
            ========================== */}
        <FloatingIcon
          className="absolute top-[8%] left-[35%]"
          bg="bg-green-500"
          delay="0s"
        >
          <WhatsAppIcon />
        </FloatingIcon>

        <FloatingIcon
          className="absolute top-[6%] left-[52%]"
          bg="bg-gradient-to-br from-pink-500 to-purple-500"
          delay="0.5s"
        >
          <InstagramIcon />
        </FloatingIcon>

        <FloatingIcon
          className="absolute top-[18%] left-[68%]"
          bg="bg-blue-600"
          delay="1s"
        >
          <FacebookIcon />
        </FloatingIcon>

        <FloatingIcon
          className="absolute top-[30%] left-[80%]"
          bg="bg-purple-500"
          delay="1.5s"
        >
          <EmailIcon />
        </FloatingIcon>

        <FloatingIcon
          className="absolute top-[55%] left-[8%]"
          bg="bg-slate-700"
          delay="2s"
        >
          <SiteIcon />
        </FloatingIcon>

        {/* ==========================
            LINHAS TRACEJADAS DECORATIVAS
            ========================== */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 520 390"
          fill="none"
          preserveAspectRatio="none"
        >
          <path
            d="M 200 60 Q 240 90 260 100"
            stroke="#BFDBFE"
            strokeWidth="1.5"
            strokeDasharray="4 4"
            opacity="0.6"
          />
          <path
            d="M 290 55 Q 310 70 340 80"
            stroke="#DDD6FE"
            strokeWidth="1.5"
            strokeDasharray="4 4"
            opacity="0.6"
          />
          <path
            d="M 380 90 Q 420 110 440 120"
            stroke="#BFDBFE"
            strokeWidth="1.5"
            strokeDasharray="4 4"
            opacity="0.6"
          />
          <path
            d="M 60 240 Q 100 220 150 200"
            stroke="#E5E7EB"
            strokeWidth="1.5"
            strokeDasharray="4 4"
            opacity="0.8"
          />
        </svg>
      </div>
    </div>
  );
}

// ==========================
// ÍCONE FLUTUANTE
// ==========================
function FloatingIcon({
  className,
  bg,
  delay,
  children,
}: {
  className: string;
  bg: string;
  delay: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`${className} ${bg} rounded-full w-9 h-9 md:w-10 md:h-10
                  flex items-center justify-center shadow-lg
                  animate-[float_3s_ease-in-out_infinite]`}
      style={{ animationDelay: delay }}
    >
      <div className="text-white">{children}</div>
    </div>
  );
}

// ==========================
// ÍCONES SVG INLINE
// ==========================
function WhatsAppIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function EmailIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function SiteIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </svg>
  );
}