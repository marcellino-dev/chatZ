import { useState, useEffect, useRef } from 'react';

// ==========================
// CATEGORIAS DE EMOJIS
// ==========================
const EMOJI_CATEGORIES: Record<string, string[]> = {
  '😀 Smileys': [
    '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂',
    '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩',
    '😘', '😗', '😚', '😙', '😋', '😛', '😜', '🤪',
    '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨',
    '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '😮',
    '😯', '😲', '😳', '🥺', '😢', '😭', '😱', '😖',
    '😣', '😞', '😓', '😩', '😫', '🥱', '😤', '😡',
    '😠', '🤬', '😈', '👿', '💀', '☠️', '💩', '🤡',
    '👻', '👽', '🤖', '🎃',
  ],
  '❤️ Amor': [
    '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍',
    '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖',
    '💘', '💝', '💟', '😍', '🥰', '😘', '💋', '💌',
    '🌹', '🌷', '🌺', '🌸', '💐',
  ],
  '👋 Gestos': [
    '👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙',
    '👈', '👉', '👆', '👇', '☝️', '✋', '🤚', '🖐️',
    '🖖', '👋', '🤝', '🙏', '💪', '👏', '🙌', '👐',
    '🤲', '🤜', '🤛', '✊', '👊', '🫶',
  ],
  '🎉 Celebração': [
    '🎉', '🎊', '🎈', '🎁', '🎀', '🎂', '🍰', '🥳',
    '🎆', '🎇', '✨', '⭐', '🌟', '💫', '🔥', '💥',
    '🎯', '🎪', '🏆', '🥇', '🥈', '🥉', '👑', '💎',
  ],
  '🍕 Comida': [
    '🍕', '🍔', '🍟', '🌭', '🍿', '🧂', '🥓', '🥚',
    '🍳', '🧇', '🥞', '🍞', '🥐', '🥨', '🥯', '🍩',
    '🍪', '🎂', '🍰', '🧁', '🥧', '🍫', '🍬', '🍭',
    '🍮', '🍯', '☕', '🍵', '🧃', '🥤', '🍺', '🍻',
    '🍷', '🍸', '🍹', '🍾',
  ],
  '🐶 Animais': [
    '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼',
    '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🙈',
    '🙉', '🙊', '🐔', '🐧', '🐦', '🐤', '🦆', '🦅',
    '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛',
    '🦋', '🐌', '🐞', '🐢',
  ],
  '⚽ Esportes': [
    '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉',
    '🥏', '🎱', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏',
    '🥅', '⛳', '🏹', '🎣', '🥊', '🥋', '🎽', '🛹',
  ],
  '🌍 Objetos': [
    '📱', '💻', '⌨️', '🖥️', '🖨️', '🖱️', '🖲️', '🎮',
    '🎧', '🎤', '🎬', '📷', '📸', '📹', '📼', '💡',
    '🔦', '📚', '📖', '📝', '✏️', '✒️', '🖊️', '📢',
    '📣', '🔔', '🔕', '📞', '☎️', '📟',
  ],
  '🚗 Transporte': [
    '🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑',
    '🚒', '🚐', '🚚', '🚛', '🚜', '🏍️', '🛵', '🚲',
    '✈️', '🚀', '🚁', '⛵', '🚢', '🚂', '🚄', '🚅',
  ],
  '💡 Símbolos': [
    '✅', '❌', '⚠️', '❗', '❓', '❕', '❔', '💯',
    '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⚫', '⚪',
    '🔶', '🔷', '🔸', '🔹', '🔺', '🔻', '💠', '🔘',
    '▶️', '⏸️', '⏹️', '⏭️', '⏮️', '🔀', '🔁', '🔂',
  ],
};

// ==========================
// PALAVRAS-CHAVE PRA BUSCA
// ==========================
const EMOJI_KEYWORDS: Record<string, string[]> = {
  '❤️': ['amor', 'coração', 'love', 'heart', 'vermelho'],
  '💔': ['coração partido', 'amor', 'triste', 'broken', 'heart'],
  '😀': ['sorriso', 'feliz', 'smile', 'happy'],
  '😂': ['risada', 'chorar de rir', 'laugh', 'joy'],
  '🥰': ['amor', 'coração', 'love', 'smiling'],
  '😍': ['amor', 'apaixonado', 'love', 'heart eyes'],
  '😢': ['triste', 'chorar', 'sad', 'cry'],
  '😭': ['chorar', 'triste', 'sob', 'cry'],
  '😡': ['raiva', 'bravo', 'angry', 'mad'],
  '👍': ['joinha', 'ok', 'curtir', 'like', 'thumbs up'],
  '👎': ['não', 'joinha pra baixo', 'dislike', 'thumbs down'],
  '🙏': ['obrigado', 'por favor', 'rezar', 'pray', 'thanks'],
  '👏': ['palmas', 'aplausos', 'clap', 'applause'],
  '🎉': ['festa', 'comemorar', 'party', 'celebrate'],
  '🔥': ['fogo', 'quente', 'fire', 'hot'],
  '💯': ['cem', 'perfeito', 'hundred', 'perfect'],
  '✅': ['check', 'certo', 'ok', 'correct'],
  '❌': ['x', 'errado', 'no', 'wrong'],
  '⚠️': ['atenção', 'aviso', 'warning', 'alert'],
  '⭐': ['estrela', 'favorito', 'star'],
  '🚀': ['foguete', 'rápido', 'rocket', 'fast'],
  '💡': ['ideia', 'lâmpada', 'idea', 'light'],
  '🎯': ['alvo', 'meta', 'target', 'bullseye'],
  '⚡': ['raio', 'energia', 'lightning', 'energy'],
  '💪': ['força', 'músculo', 'strong', 'muscle'],
  '🤝': ['aperto de mão', 'acordo', 'handshake', 'deal'],
};

// ==========================
// COMPONENTE
// ==========================
interface Props {
  onEmojiClick: (emoji: string) => void;
  onClose: () => void;
}

export function SimpleEmojiPicker({ onEmojiClick, onClose }: Props) {
  const [activeCategory, setActiveCategory] = useState<string>('😀 Smileys');
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Fecha ao ESC
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // ==========================
  // BUSCA
  // ==========================
  const searchResults = search.trim()
    ? getSearchResults(search.toLowerCase().trim())
    : [];

  function getSearchResults(query: string): string[] {
    const allEmojis = new Set<string>();
    Object.values(EMOJI_CATEGORIES).forEach((emojis) => {
      emojis.forEach((e) => allEmojis.add(e));
    });

    const results: string[] = [];
    allEmojis.forEach((emoji) => {
      const keywords = EMOJI_KEYWORDS[emoji] || [];
      const matchesKeyword = keywords.some((k) => k.includes(query));
      const matchesEmoji = emoji.includes(query);

      if (matchesKeyword || matchesEmoji) {
        results.push(emoji);
      }
    });

    return results;
  }

  return (
    <div
      ref={containerRef}
      className="bg-chatz-surface border border-chatz-border rounded-chatz-md shadow-chatz-lg
                 w-[340px] max-h-[420px] flex flex-col overflow-hidden"
    >
      {/* Busca */}
      <div className="p-2 border-b border-chatz-border">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar emoji (ex: amor, fogo, ok)..."
          className="w-full px-3 py-1.5 text-sm bg-chatz-surface-alt border border-chatz-border rounded-chatz
                     text-chatz-text placeholder:text-chatz-text-subtle
                     focus:border-chatz-primary focus:ring-2 focus:ring-chatz-primary/20 transition-all"
          autoFocus
        />
      </div>

      {/* Categorias (só se não tá buscando) */}
      {!search.trim() && (
        <div className="flex gap-1 px-2 py-1.5 border-b border-chatz-border overflow-x-auto shrink-0">
          {Object.keys(EMOJI_CATEGORIES).map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-2 py-1 text-xs rounded-chatz whitespace-nowrap transition-all ${
                activeCategory === cat
                  ? 'bg-chatz-primary text-white'
                  : 'text-chatz-text-muted hover:bg-chatz-surface-hover'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-2">
        {search.trim() ? (
          searchResults.length === 0 ? (
            <p className="text-center text-chatz-text-muted text-xs py-8">
              Nenhum emoji encontrado
            </p>
          ) : (
            <div className="grid grid-cols-8 gap-0.5">
              {searchResults.map((emoji, i) => (
                <button
                  key={`${emoji}-${i}`}
                  onClick={() => onEmojiClick(emoji)}
                  className="w-9 h-9 rounded hover:bg-chatz-surface-hover flex items-center justify-center
                             text-xl transition-all active:scale-95"
                  title={emoji}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )
        ) : (
          <div className="grid grid-cols-8 gap-0.5">
            {EMOJI_CATEGORIES[activeCategory].map((emoji, i) => (
              <button
                key={`${emoji}-${i}`}
                onClick={() => onEmojiClick(emoji)}
                className="w-9 h-9 rounded hover:bg-chatz-surface-hover flex items-center justify-center
                           text-xl transition-all active:scale-95"
                title={emoji}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-2 py-1.5 border-t border-chatz-border text-[10px] text-chatz-text-subtle text-center">
        {search.trim()
          ? `${searchResults.length} resultado${searchResults.length !== 1 ? 's' : ''}`
          : `${EMOJI_CATEGORIES[activeCategory].length} emojis nesta categoria`}
      </div>
    </div>
  );
}