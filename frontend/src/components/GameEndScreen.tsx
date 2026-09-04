interface PlayerResult {
  id: string;
  nickname: string;
  score: number;
}

const MEDALS = ['🥇', '🥈', '🥉'];

export default function GameEndScreen({
  players,
  onBackToLobby,
}: {
  players: PlayerResult[];
  onBackToLobby: () => void;
}) {
  return (
    <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl animate-in fade-in zoom-in-95">
      <h2 className="text-2xl font-black text-center mb-1">Koniec gry! 🎉</h2>
      <p className="text-center text-slate-400 text-sm mb-6">Oto ostateczne wyniki</p>

      <div className="space-y-2 mb-8">
        {players.map((p, i) => (
          <div
            key={p.id}
            className={`flex items-center justify-between px-4 py-3 rounded-xl border ${
              i === 0
                ? 'bg-indigo-950/50 border-indigo-500'
                : 'bg-slate-800/50 border-slate-700'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="w-6 text-center font-bold text-slate-400">
                {MEDALS[i] || i + 1}
              </span>
              <span className="font-semibold text-white">{p.nickname}</span>
            </div>
            <span className="font-bold text-emerald-400">{p.score} pkt</span>
          </div>
        ))}
      </div>

      <button
        onClick={onBackToLobby}
        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 rounded-xl shadow-lg shadow-indigo-900/20 transition-all active:scale-95"
      >
        Wróć do Lobby
      </button>
    </div>
  );
}
