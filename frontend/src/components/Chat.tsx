import { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';

interface Message {
  user: string;
  text: string;
}

// Przyjmujemy socket, username i aktualny roomId jako propsy
export default function Chat({ socket, username, roomId }: { socket: Socket | null, username: string, roomId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!socket) return;
    
    // Słuchamy tylko wiadomości z naszego pokoju
    socket.on('messageUpdate', (msg: Message) => {
      setMessages(prev => [...prev, msg]);
    });
    
    return () => { socket.off('messageUpdate'); };
  }, [socket]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && socket && roomId) {
      // WYSYŁAMY: do kogo, co i w jakim pokoju
      socket.emit('message', { user: username, text: input, roomId: roomId });
      setInput('');
    }
  };

  return (
    <div className="w-80 h-[450px] bg-slate-900 border border-slate-800 rounded-2xl flex flex-col shadow-xl overflow-hidden mt-2">
      <div className="p-4 bg-slate-800 border-b border-slate-700">
        <h3 className="font-bold text-white tracking-wider text-sm uppercase">Czat pokoju: {roomId}</h3>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.map((m, i) => (
          <div key={i} className="text-sm">
            <span className="font-bold text-indigo-400">{m.user}: </span>
            <span className="text-slate-200">{m.text}</span>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>
      <form onSubmit={sendMessage} className="p-3 bg-slate-800 flex gap-2 border-t border-slate-700">
        <input 
          className="bg-slate-900 border border-slate-700 text-white rounded-md px-3 py-2 text-xs flex-1 outline-none focus:border-indigo-500"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Zgadnij hasło..."
        />
        <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 px-3 py-2 rounded-md text-xs font-bold text-white transition-colors">
          OK
        </button>
      </form>
    </div>
  );
}