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
  players: any[]; // Lista graczy z App.tsx
  isHost: boolean; // Czy aktualny gracz jest hostem
}

export default function GameCanvas({ socket, roomId, players, isHost }: GameCanvasProps) {
   const [pixels, setPixels] = useState<Record<number, string>>({});
   const [currentColor, setCurrentColor] = useState("#ef4444");
   const isDrawing = useRef(false);

   useEffect(() => {
      if (!socket) return;
      socket.on("drawUpdate", (data: { index: number; color: string }) => {
         setPixels((prev) => ({ ...prev, [data.index]: data.color }));
      });
      socket.on("canvasInit", (state: Record<number, string>) => {
         setPixels(state || {});
      });
      socket.on("clearCanvas", () => {
         setPixels({});
      });

      return () => {
         socket.off("drawUpdate");
         socket.off("canvasInit");
         socket.off("clearCanvas");
      };
   }, [socket]);

   const drawPixel = useCallback((index: number, color: string) => {
      setPixels((prev) => {
         if (prev[index] === color) return prev;
         return { ...prev, [index]: color };
      });
      socket?.emit("draw", { index, color });
   }, [socket]);

   const handlePaint = (e: any) => {
      if (!isDrawing.current || !socket) return;
      const stage = e.target.getStage();
      const point = stage.getPointerPosition();
      if (!point) return;
      const gridX = Math.floor(point.x / PIXEL_SIZE);
      const gridY = Math.floor(point.y / PIXEL_SIZE);
      if (gridX >= 0 && gridX < GRID_WIDTH && gridY >= 0 && gridY < GRID_WIDTH) {
         const index = gridY * GRID_WIDTH + gridX;
         drawPixel(index, currentColor);
      }
   };

   const clearCanvas = () => {
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
                  <div key={p.id} className="flex items-center justify-between bg-slate-800/50 p-2 rounded-lg border border-slate-700">
                     <span className={`text-sm ${p.id === socket?.id ? "text-indigo-400 font-bold" : "text-slate-200"}`}>
                        {p.nickname}
                     </span>
                     {p.isHost && <span title="Właściciel pokoju">👑</span>}
                  </div>
               ))}
            </div>

            {isHost && (
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
            <div className="bg-slate-800 p-3 rounded-2xl shadow-2xl border border-slate-700">
               <Stage
                  width={CANVAS_SIZE}
                  height={CANVAS_SIZE}
                  className="bg-white cursor-crosshair rounded-lg overflow-hidden shadow-inner"
                  onMouseDown={(e) => { isDrawing.current = true; handlePaint(e); }}
                  onMouseMove={handlePaint}
                  onMouseUp={() => (isDrawing.current = false)}
                  onMouseLeave={() => (isDrawing.current = false)}
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

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center gap-6 shadow-xl">
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
         </div>
      </div>
   );
}