import { useEffect, useState, useRef, useCallback } from "react";
import { Stage, Layer, Rect } from "react-konva";
import { Socket } from "socket.io-client";

const CANVAS_SIZE = 400;
const PIXEL_SIZE = 10;
const GRID_WIDTH = CANVAS_SIZE / PIXEL_SIZE;

const COLORS = [
   { name: "Red", value: "#ef4444" },
   { name: "Orange", value: "#f97316" },
   { name: "Yellow", value: "#eab308" },
   { name: "Green", value: "#22c55e" },
   { name: "Blue", value: "#3b82f6" },
   { name: "Purple", value: "#a855f7" },
   { name: "Black", value: "#000000" },
   { name: "Eraser", value: "#ffffff" },
];

interface GameCanvasProps {
  socket: Socket | null;
  roomId: string;
  players: any[];
  isHost: boolean;
  isGameStarted: boolean;
  drawerId: string | null;
}

export default function GameCanvas({ 
  socket, 
  roomId, 
  players, 
  isHost, 
  isGameStarted, 
  drawerId 
}: GameCanvasProps) {
   const [pixels, setPixels] = useState<Record<number, string>>({});
   const [currentColor, setCurrentColor] = useState("#ef4444");
   const isDrawing = useRef(false);
   // Ostatni namalowany punkt (w kratkach), żeby móc dorysować linię do nowego - inaczej szybki ruch myszką zostawia dziury
   const lastPoint = useRef<{ x: number; y: number } | null>(null);

   // Kolejkujemy WSZYSTKIE piksele narysowane między flushami - throttlujemy częstotliwość wysyłki, ale nie tracimy żadnego piksela
   const DRAW_EMIT_THROTTLE_MS = 40;
   const drawQueue = useRef<{ index: number; color: string }[]>([]);
   const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

   // 🔥 KLUCZOWA LOGIKA: Czy ja teraz rysuję?
   const canDraw = isGameStarted && socket?.id === drawerId;

   useEffect(() => {
      if (!socket) return;
      socket.on("drawUpdate", (data: { index: number; color: string }[]) => {
         setPixels((prev) => {
            const next = { ...prev };
            for (const { index, color } of data) next[index] = color;
            return next;
         });
      });
      socket.on("canvasInit", (state: Record<number, string>) => {
         setPixels(state || {});
      });
      socket.on("clearCanvas", () => {
         setPixels({});
      });

      // Prosimy o aktualny stan płótna dopiero TERAZ, gdy na pewno słuchamy już "canvasInit"
      socket.emit("requestCanvasState", { roomId });

      return () => {
         socket.off("drawUpdate");
         socket.off("canvasInit");
         socket.off("clearCanvas");
      };
   }, [socket, roomId]);

   useEffect(() => {
      return () => {
         if (flushTimer.current) clearTimeout(flushTimer.current);
      };
   }, []);

   const emitDraw = useCallback((index: number, color: string) => {
      drawQueue.current.push({ index, color });
      if (!flushTimer.current) {
         flushTimer.current = setTimeout(() => {
            flushTimer.current = null;
            if (drawQueue.current.length > 0) {
               socket?.emit("draw", drawQueue.current);
               drawQueue.current = [];
            }
         }, DRAW_EMIT_THROTTLE_MS);
      }
   }, [socket]);

   const drawPixel = useCallback((index: number, color: string) => {
      setPixels((prev) => {
         if (prev[index] === color) return prev;
         return { ...prev, [index]: color };
      });
      // Wysyłamy tylko jeśli mamy uprawnienia
      if (canDraw) {
         emitDraw(index, color);
      }
   }, [emitDraw, canDraw]);

   // Rysuje linię (algorytm Bresenhama) między dwoma punktami siatki, żeby szybki ruch myszką nie zostawiał dziur
   const paintLine = useCallback((from: { x: number; y: number } | null, to: { x: number; y: number }) => {
      const inBounds = (x: number, y: number) => x >= 0 && x < GRID_WIDTH && y >= 0 && y < GRID_WIDTH;
      const paintCell = (x: number, y: number) => {
         if (!inBounds(x, y)) return;
         drawPixel(y * GRID_WIDTH + x, currentColor);
      };

      if (!from) {
         paintCell(to.x, to.y);
         return;
      }

      let x0 = from.x, y0 = from.y;
      const x1 = to.x, y1 = to.y;
      const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
      const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
      let err = dx + dy;

      while (true) {
         paintCell(x0, y0);
         if (x0 === x1 && y0 === y1) break;
         const e2 = 2 * err;
         if (e2 >= dy) { err += dy; x0 += sx; }
         if (e2 <= dx) { err += dx; y0 += sy; }
      }
   }, [drawPixel, currentColor]);

   const handlePaint = (e: any) => {
      // ⛔ BLOKADA: Nie rysujesz, jeśli nie masz uprawnień!
      if (!isDrawing.current || !socket || !canDraw) return;

      const stage = e.target.getStage();
      const point = stage.getPointerPosition();
      if (!point) return;
      const gridX = Math.floor(point.x / PIXEL_SIZE);
      const gridY = Math.floor(point.y / PIXEL_SIZE);
      if (gridX >= 0 && gridX < GRID_WIDTH && gridY >= 0 && gridY < GRID_WIDTH) {
         paintLine(lastPoint.current, { x: gridX, y: gridY });
         lastPoint.current = { x: gridX, y: gridY };
      }
   };

   const clearCanvas = () => {
      if (!canDraw) return; // Zabezpieczenie przed 'hakerami'
      setPixels({});
      socket?.emit("clear");
   };

   return (
      <div className="flex flex-col lg:flex-row gap-8 items-start">
         {/* LEWA KOLUMNA: LISTA GRACZY */}
         <div className="w-64 bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-tighter mb-4">Gracze w pokoju</h3>
            <div className="space-y-2">
               {players.map((p) => (
                  <div key={p.id} className="flex flex-col bg-slate-800/50 p-2 rounded-lg border border-slate-700">
                     <div className="flex items-center justify-between">
                        <span className={`text-sm ${p.id === socket?.id ? "text-indigo-400 font-bold" : "text-slate-200"}`}>
                           {p.nickname}
                           {/* Ikonka dla rysownika */}
                           {p.id === drawerId && <span className="ml-2" title="Rysuje">🖌️</span>}
                        </span>
                        {p.isHost && <span title="Właściciel pokoju">👑</span>}
                     </div>
                     {/* Punkty gracza */}
                     <span className="text-xs font-bold text-emerald-400 mt-1">Punkty: {p.score || 0}</span>
                  </div>
               ))}
            </div>

            {/* Przycisk START pojawia się tylko, gdy gra jeszcze nie trwa */}
            {isHost && !isGameStarted && (
               <button 
                  onClick={() => socket?.emit('startGame', { roomId })}
                  className="w-full mt-6 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 rounded-xl shadow-lg shadow-indigo-900/20 transition-all active:scale-95"
               >
                  Zacznij Grę
               </button>
            )}
         </div>

         {/* PRAWA KOLUMNA: PŁÓTNO I NARZĘDZIA */}
         <div className="flex flex-col items-center gap-6">
            {/* Zmieniamy styl ramki w zależności od tego czy rysujemy */}
            <div className={`p-3 rounded-2xl shadow-2xl border transition-colors ${
               canDraw ? "bg-indigo-900/50 border-indigo-500" : "bg-slate-800 border-slate-700"
            }`}>
               <Stage
                  width={CANVAS_SIZE}
                  height={CANVAS_SIZE}
                  // Zmiana kursora gdy nie można rysować
                  className={`bg-white rounded-lg overflow-hidden shadow-inner ${
                     canDraw ? "cursor-crosshair" : "cursor-not-allowed opacity-90"
                  }`}
                  onMouseDown={(e) => { isDrawing.current = true; lastPoint.current = null; handlePaint(e); }}
                  onMouseMove={handlePaint}
                  onMouseUp={() => { isDrawing.current = false; lastPoint.current = null; }}
                  onMouseLeave={() => { isDrawing.current = false; lastPoint.current = null; }}
               >
                  <Layer>
                     {Object.entries(pixels).map(([indexStr, color]) => {
                        const index = parseInt(indexStr);
                        const x = (index % GRID_WIDTH) * PIXEL_SIZE;
                        const y = Math.floor(index / GRID_WIDTH) * PIXEL_SIZE;
                        return <Rect key={index} x={x} y={y} width={PIXEL_SIZE} height={PIXEL_SIZE} fill={color} listening={false} />;
                     })}
                  </Layer>
               </Stage>
            </div>

            {/* Pasek narzędzi jest widoczny TYLKO dla rysownika */}
            {canDraw ? (
               <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center gap-6 shadow-xl animate-in slide-in-from-bottom-2">
                  <div className="flex gap-2">
                     {COLORS.map((color) => (
                        <button
                           key={color.value}
                           onClick={() => setCurrentColor(color.value)}
                           className={`w-9 h-9 rounded-xl border-2 transition-all ${
                              currentColor === color.value ? "border-indigo-500 scale-110 shadow-lg" : "border-transparent"
                           }`}
                           style={{ backgroundColor: color.value }}
                        />
                     ))}
                  </div>
                  <div className="w-[1px] h-8 bg-slate-800" />
                  <button onClick={clearCanvas} className="text-slate-400 hover:text-red-400 font-bold text-sm transition-colors">
                     WYCZYŚĆ
                  </button>
               </div>
            ) : (
               <div className="h-[68px] flex items-center justify-center text-slate-500 text-sm font-semibold">
                  {isGameStarted ? "Tylko rysownik ma dostęp do pędzli" : "Czekamy na start gry..."}
               </div>
            )}
         </div>
      </div>
   );
}