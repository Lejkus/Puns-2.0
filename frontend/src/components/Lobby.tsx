import { useState, useEffect } from "react";

interface Room {
  id: string;
  name: string;
  password?: string; // Przechowujemy informację, czy pokój ma hasło
}

export default function Lobby({ onJoinRoom }: { onJoinRoom: (roomId: string, password?: string) => void }) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [newName, setNewName] = useState("");
  const [newPass, setNewPass] = useState("");
  
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [joinPass, setJoinPass] = useState("");

  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = () => {
    fetch("http://localhost:3000/rooms")
      .then(res => res.json())
      .then(setRooms);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("http://localhost:3000/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, password: newPass }),
    });

    if (res.ok) {
      onJoinRoom(newName, newPass);
    } else {
      const error = await res.json();
      alert(error.message || "Błąd tworzenia pokoju");
    }
  };

  return (
    <div className="flex flex-col gap-8 bg-slate-900 p-8 rounded-2xl border border-slate-800 shadow-xl max-w-2xl w-full text-white">
      
      {/* SEKCJA 1: TWORZENIE */}
      <section className="border-b border-slate-800 pb-6">
        <h2 className="text-xl font-bold mb-4">Stwórz nowy pokój</h2>
        <form onSubmit={handleCreate} className="flex flex-wrap gap-3">
          <input
            placeholder="Nazwa pokoju"
            className="flex-1 px-4 py-2 bg-slate-950 border border-slate-700 rounded"
            value={newName} onChange={e => setNewName(e.target.value)}
          />
          <input
            placeholder="Hasło (opcjonalnie)"
            type="password"
            className="px-4 py-2 bg-slate-950 border border-slate-700 rounded"
            value={newPass} onChange={e => setNewPass(e.target.value)}
          />
          <button className="bg-green-600 px-6 py-2 rounded font-bold hover:bg-green-500">Stwórz</button>
        </form>
      </section>

      {/* SEKCJA 2: LISTA I DOŁĄCZANIE */}
      <section>
        <h2 className="text-xl font-bold mb-4">Dostępne pokoje</h2>
        <div className="grid gap-3">
          {rooms.map(room => (
            <div key={room.id} className="p-4 bg-slate-800 rounded-lg flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <span className="font-bold">{room.name} {room.password ? "🔒" : "🔓"}</span>
                <button 
                  onClick={() => setSelectedRoom(room)}
                  className="bg-indigo-600 px-4 py-1 rounded text-sm"
                >
                  Wybierz
                </button>
              </div>

              {/* POKAZUJE SIĘ TYLKO DLA WYBRANEGO POKOJU */}
              {selectedRoom?.id === room.id && (
                <div className="flex gap-2 mt-2 p-3 bg-slate-900 rounded">
                  {room.password && (
                    <input
                      type="password"
                      placeholder="Wpisz hasło..."
                      className="flex-1 px-3 py-1 bg-black border border-slate-700 rounded text-sm"
                      value={joinPass} onChange={e => setJoinPass(e.target.value)}
                    />
                  )}
                  <button 
                    onClick={() => onJoinRoom(room.name, joinPass)}
                    className="bg-indigo-500 px-4 py-1 rounded text-sm font-bold"
                  >
                    Dołącz teraz
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}