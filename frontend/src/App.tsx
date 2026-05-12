import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./store/useAuthStore";
import RegisterPage from "./pages/Register";
import LoginPage from "./pages/Login";
import { Button } from "./components/ui/button";
import GameCanvas from "./components/GameCanvas";
import Chat from "./components/Chat";
import Lobby from "./components/Lobby"; // NOWY IMPORT!
import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";

function App() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [currentRoom, setCurrentRoom] = useState<string | null>(null);


   useEffect(() => {
      if (isAuthenticated) {
         const newSocket = io("http://localhost:3000");

         // --- NOWE: Słuchamy co serwer ma do powiedzenia o dołączaniu ---
         newSocket.on("joinSuccess", (data: { roomId: string }) => {
            console.log("Sukces! Serwer pozwolił wejść do:", data.roomId);
            setCurrentRoom(data.roomId); // Dopiero teraz przełączamy widok!
         });

         newSocket.on("error_message", (msg: string) => {
            alert(msg); // Wyświetli np. "Nieprawidłowe hasło!"
            setCurrentRoom(null); // Zostajemy w Lobby
         });

         setSocket(newSocket);

         return () => {
            newSocket.off("joinSuccess");
            newSocket.off("error_message");
            newSocket.disconnect();
         };
      }
   }, [isAuthenticated]);

// Funkcja odpalana, gdy gracz kliknie w Lobby
const handleJoinRoom = (roomId: string, password?: string) => {
  if (!socket) return;
  
  // Wysyłamy prośbę, ale NIE ustawiamy jeszcze setCurrentRoom.
  // Czekamy na event "joinSuccess" z useEffecta powyżej.
  socket.emit("joinRoom", { roomId, password });
};

const handleLeaveRoom = () => {
  // Opcjonalnie: poinformuj serwer, że wychodzisz
  // socket?.emit("leaveRoom", { roomId: currentRoom });
  setCurrentRoom(null);
};

   return (
      <BrowserRouter>
         <Routes>
            <Route
               path="/login"
               element={
                  !isAuthenticated ? (
                     <LoginPage />
                  ) : (
                     <Navigate to="/dashboard" />
                  )
               }
            />
            <Route
               path="/register"
               element={
                  !isAuthenticated ? (
                     <RegisterPage />
                  ) : (
                     <Navigate to="/dashboard" />
                  )
               }
            />

            <Route
               path="/dashboard"
               element={
                  isAuthenticated ? (
                     <div className="flex flex-col items-center min-h-screen bg-slate-950 text-white pb-10">
                        {/* Pasek nawigacji na samej górze */}
                        <div className="flex items-center justify-between w-full max-w-5xl px-8 mt-6 mb-8 border-b border-slate-800 pb-4">
                           <h1 className="text-3xl font-bold">
                              Pikselowe Kalambury 🎮
                           </h1>
                           <div className="flex items-center gap-4">
                              <p className="text-slate-400">
                                 Grasz jako:{" "}
                                 <span className="text-white font-bold">
                                    {user?.nickname}
                                 </span>
                              </p>
                              <Button variant="destructive" onClick={logout}>
                                 Wyloguj
                              </Button>
                           </div>
                        </div>

                        {/* LOGIKA WYŚWIETLANIA */}
                        {!currentRoom ? (
                           // JEŚLI NIE MA POKOJU -> POKAŻ LOBBY
                           <Lobby onJoinRoom={handleJoinRoom} />
                        ) : (
                           // JEŚLI JEST POKÓJ -> POKAŻ GRĘ I CZAT
                           <div className="flex flex-col items-center w-full max-w-5xl">
                              <div className="w-full flex justify-between items-center mb-6 px-4">
                                 <h2 className="text-xl font-bold text-indigo-400">
                                    Pokój: {currentRoom}
                                 </h2>
                                 <Button
                                    variant="outline"
                                    onClick={handleLeaveRoom}
                                 >
                                    ⬅ Wróć do Lobby
                                 </Button>
                              </div>

                              <div className="flex flex-col lg:flex-row gap-8 items-start justify-center w-full">
                                 <GameCanvas
                                    socket={socket}
                                    roomId={currentRoom}
                                 />
                                 <Chat
                                    socket={socket}
                                    username={user?.nickname || "Anonim"}
                                    roomId={currentRoom}
                                 />
                              </div>
                           </div>
                        )}
                     </div>
                  ) : (
                     <Navigate to="/login" />
                  )
               }
            />
            <Route
               path="*"
               element={
                  <Navigate to={isAuthenticated ? "/dashboard" : "/login"} />
               }
            />
         </Routes>
      </BrowserRouter>
   );
}

export default App;
