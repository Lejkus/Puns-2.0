import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./store/useAuthStore";
import RegisterPage from "./pages/Register";
import LoginPage from "./pages/Login";
import { Button } from "./components/ui/button";
import GameCanvas from "./components/GameCanvas";
import Chat from "./components/Chat";
import Lobby from "./components/Lobby";
import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";

function App() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [currentRoom, setCurrentRoom] = useState<string | null>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [isHost, setIsHost] = useState(false);

  // ZMIENNE STANU GRY (Timer, Słowo itp.)
  const [isGameStarted, setIsGameStarted] = useState(false);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [drawerName, setDrawerName] = useState<string>("");
  const [word, setWord] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    if (isAuthenticated && user?.id) {
      const newSocket = io("http://localhost:3000", {
        auth: { userId: user.id }
      });

      newSocket.on("force_logout", (data: { reason: string }) => {
        alert(data.reason);
        logout();
        window.location.href = "/login";
      });

      newSocket.on("joinSuccess", (data: { roomId: string; isHost: boolean }) => {
        setCurrentRoom(data.roomId);
        setIsHost(data.isHost);
        setIsGameStarted(false);
        setWord(null);
      });

      newSocket.on("error_message", (msg: string) => {
        alert(msg);
        setCurrentRoom(null);
      });

      setSocket(newSocket);

      return () => {
        newSocket.disconnect();
      };
    } else {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?.id]);

  useEffect(() => {
    if (socket) {
      socket.on("playersUpdate", (updatedPlayers: any[]) => {
        setPlayers(updatedPlayers);
        const me = updatedPlayers.find((p) => p.id === socket.id);
        if (me) setIsHost(me.isHost);
      });

      socket.on("gameStarted", () => {
        setIsGameStarted(true);
      });

      socket.on("turnStarted", (data: { drawerId: string, drawerName: string, timeLeft: number }) => {
        setDrawerId(data.drawerId);
        setDrawerName(data.drawerName);
        setTimeLeft(data.timeLeft);
        setWord(null); 
      });

      socket.on("yourWord", (data: { word: string }) => {
        setWord(data.word);
      });

      socket.on("timerUpdate", (data: { timeLeft: number }) => {
        setTimeLeft(data.timeLeft);
      });
    }
  }, [socket]);

  const handleJoinRoom = (roomId: string, password?: string) => {
    if (!user) return;
    socket?.emit("joinRoom", { roomId, password, nickname: user.nickname });
  };

  const handleLeaveRoom = () => {
    // 🔥 WYSYŁAMY INFO DO SERWERA, ŻE WYCHODZIMY! (Koniec z "duchami")
    if (currentRoom) {
      socket?.emit("leaveRoom", { roomId: currentRoom });
    }
    setCurrentRoom(null);
    setIsGameStarted(false);
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={!isAuthenticated ? <LoginPage /> : <Navigate to="/dashboard" />} />
        <Route path="/register" element={!isAuthenticated ? <RegisterPage /> : <Navigate to="/dashboard" />} />

        <Route path="/dashboard" element={isAuthenticated ? (
          <div className="flex flex-col items-center min-h-screen bg-slate-950 text-white pb-10">
            
            {/* 🔥 TWÓJ ZGUBIONY NAVBAR JEST TUTAJ! */}
            <div className="flex items-center justify-between w-full max-w-5xl px-8 mt-6 mb-8 border-b border-slate-800 pb-4">
              <h1 className="text-3xl font-bold">Pikselowe Kalambury 🎮</h1>
              <div className="flex items-center gap-4">
                <p className="text-slate-400">
                  Grasz jako: <span className="text-white font-bold">{user?.nickname}</span>
                </p>
                <Button variant="destructive" onClick={logout}>Wyloguj</Button>
              </div>
            </div>

            {!currentRoom ? (
              <Lobby onJoinRoom={handleJoinRoom} />
            ) : (
              <div className="flex flex-col items-center w-full max-w-5xl">
                
                {/* Górny panel z nazwą pokoju i przyciskiem wyjścia */}
                <div className="w-full flex justify-between items-center mb-6 px-4">
                  <h2 className="text-xl font-bold text-indigo-400">Pokój: {currentRoom}</h2>
                  <Button variant="outline" onClick={handleLeaveRoom}>⬅ Wróć do Lobby</Button>
                </div>

                {/* 🔥 MECHANIKA GRY - POKAZUJE SIĘ JAK HOST KLIKNIE START */}
                {isGameStarted && (
                  <div className="w-full bg-slate-900 border border-slate-800 rounded-xl p-4 mb-6 flex justify-between items-center shadow-lg">
                    <div className="text-xl font-bold text-slate-300">
                      Rysuje: <span className="text-indigo-400">{drawerName || "Czekamy..."}</span>
                    </div>
                    
                    <div className="text-3xl font-black text-white">
                      ⏱ {timeLeft}s
                    </div>

                    <div className="text-xl font-bold text-slate-300">
                      Hasło: <span className="text-emerald-400 tracking-widest font-mono">
                        {word ? word : "_ _ _ _ _"}
                      </span>
                    </div>
                  </div>
                )}

                {/* Główny obszar gry (Płótno + Czat) */}
                <div className="flex flex-col lg:flex-row gap-8 items-start justify-center w-full">
                  <GameCanvas
                    socket={socket}
                    roomId={currentRoom}
                    players={players}
                    isHost={isHost}
                    isGameStarted={isGameStarted}
                    drawerId={drawerId}
                  />
                  <Chat
                    socket={socket}
                    username={user?.nickname || "Anonim"}
                    roomId={currentRoom}
                    // Opcjonalnie: Zablokuj czat dla rysownika, żeby nie mógł podpowiadać
                    disabled={isGameStarted && socket?.id === drawerId}
                  />
                </div>
              </div>
            )}
          </div>
        ) : <Navigate to="/login" />} />
        <Route path="*" element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;