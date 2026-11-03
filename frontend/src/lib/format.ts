/** Formata telefones BR no estilo da referência: "55 47 89929-9801". */
export function formatPhone(raw?: string | null): string {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    const ddd = digits.slice(2, 4);
    const number = digits.slice(4);
    const split = number.length - 4;
    return `55 ${ddd} ${number.slice(0, split)}-${number.slice(split)}`;
  }
  return raw;
}

/** Link tel: para o botão "Ligar". */
export function phoneHref(raw?: string | null): string | undefined {
  const digits = (raw ?? '').replace(/\D/g, '');
  return digits ? `tel:+${digits}` : undefined;
}