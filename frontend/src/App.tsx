import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./store/useAuthStore";
import RegisterPage from "./pages/Register";
import LoginPage from "./pages/Login";
import { Button } from "./components/ui/button";
import GameCanvas from "./components/GameCanvas";
import { useState, useEffect } from "react";
import { io, Socket } from "socket.io-client";
import Chat from "./components/Chat";


function App() {
   const { user, isAuthenticated, logout } = useAuthStore();
   const [socket, setSocket] = useState<Socket | null>(null);
   const [currentRoom, setCurrentRoom] = useState("ogolny"); // Domyślny pokój
 
   useEffect(() => {
     if (isAuthenticated) {
       const newSocket = io("http://localhost:3000");
       setSocket(newSocket);
       
       // Automatycznie dołączamy do pokoju "ogolny" na start
       newSocket.emit('joinRoom', { roomId: "ogolny" });
 
       return () => { newSocket.disconnect(); };
     }
   }, [isAuthenticated]);
 
   // ... wewnątrz Route path="/dashboard" ...
   return (
     <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-white pb-10">
       {/* Możesz tu dodać prosty przełącznik pokojów */}
       <div className="flex gap-4 mb-4">
         <input 
           className="bg-slate-800 p-2 rounded" 
           placeholder="Nazwa pokoju" 
           onKeyDown={(e) => {
             if(e.key === 'Enter') {
               const target = e.target as HTMLInputElement;
               setCurrentRoom(target.value);
               socket?.emit('joinRoom', { roomId: target.value });
             }
           }}
         />
       </div>
 
       <div className="flex flex-row gap-8 items-start">
         {/* Przekazujemy socket i aktualny pokój do obu części gry */}
         <GameCanvas socket={socket} roomId={currentRoom} />
         <Chat socket={socket} username={user?.nickname || "Anonim"} roomId={currentRoom} />
       </div>
       
       <Button variant="destructive" className="mt-8" onClick={logout}>Wyloguj się</Button>
     </div>
   );
 }

export default App;
