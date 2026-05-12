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
}

export default function GameCanvas({ socket, roomId }: GameCanvasProps) {
   const [pixels, setPixels] = useState<Record<number, string>>({});
   const [currentColor, setCurrentColor] = useState("#ef4444");
   const isDrawing = useRef(false);

   // --- SYNCHRONIZACJA ---

   useEffect(() => {
      if (!socket) return;

      // Kiedy ktoś inny rysuje
      socket.on("drawUpdate", (data: { index: number; color: string }) => {
         setPixels((prev) => ({ ...prev, [data.index]: data.color }));
      });

      // Kiedy wchodzimy do pokoju i pobieramy stan początkowy
      socket.on("canvasInit", (state: Record<number, string>) => {
         setPixels(state || {});
      });

      // Kiedy ktoś wyczyści planszę
      socket.on("clearCanvas", () => {
         setPixels({});
      });

      return () => {
         socket.off("drawUpdate");
         socket.off("canvasInit");
         socket.off("clearCanvas");
      };
   }, [socket]);

   // --- LOGIKA RYSOWANIA ---

   const drawPixel = useCallback((index: number, color: string) => {
      setPixels((prev) => {
         // Nie aktualizuj, jeśli kolor jest ten sam (optymalizacja)
         if (prev[index] === color) return prev;
         return { ...prev, [index]: color };
      });

      // Wysyłamy tylko to, co niezbędne. Serwer sam wie, jaki to roomId.
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
      socket?.emit("clear"); // Krótki sygnał do serwera
   };

   return (
      <div className="flex flex-col items-center gap-6">
         {/* STATUS POKOJU */}
         <div className="flex items-center gap-3 bg-slate-900 px-4 py-2 rounded-full border border-slate-800">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-medium text-slate-400 uppercase tracking-widest">
               Live: {roomId}
            </span>
         </div>

         {/* PŁÓTNO */}
         <div className="bg-slate-800 p-3 rounded-2xl shadow-2xl border border-slate-700">
            <Stage
               width={CANVAS_SIZE}
               height={CANVAS_SIZE}
               className="bg-white cursor-crosshair rounded-lg overflow-hidden shadow-inner"
               onMouseDown={(e) => {
                  isDrawing.current = true;
                  handlePaint(e);
               }}
               onMouseMove={handlePaint}
               onMouseUp={() => (isDrawing.current = false)}
               onMouseLeave={() => (isDrawing.current = false)}
            >
               <Layer>
                  {Object.entries(pixels).map(([indexStr, color]) => {
                     const index = parseInt(indexStr);
                     const x = (index % GRID_WIDTH) * PIXEL_SIZE;
                     const y = Math.floor(index / GRID_WIDTH) * PIXEL_SIZE;

                     return (
                        <Rect
                           key={index}
                           x={x}
                           y={y}
                           width={PIXEL_SIZE}
                           height={PIXEL_SIZE}
                           fill={color}
                           listening={false} // Bardzo ważne dla wydajności!
                        />
                     );
                  })}
               </Layer>
            </Stage>
         </div>

         {/* TOOLBAR */}
         <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center gap-6 shadow-xl">
            <div className="flex gap-2">
               {COLORS.map((color) => (
                  <button
                     key={color.value}
                     onClick={() => setCurrentColor(color.value)}
                     className={`w-9 h-9 rounded-xl border-2 transition-all flex items-center justify-center ${
                        currentColor === color.value
                           ? "border-indigo-500 scale-110 shadow-[0_0_15px_rgba(79,70,229,0.4)]"
                           : "border-transparent hover:border-slate-700"
                     }`}
                     style={{
                        backgroundColor: color.value,
                        boxShadow: currentColor === color.value ? `0 0 10px ${color.value}44` : 'none'
                     }}
                  >
                     {color.name === "Eraser" && <span className="text-lg">🧼</span>}
                  </button>
               ))}
            </div>

            <div className="w-[1px] h-8 bg-slate-800" />

            <button
               onClick={clearCanvas}
               className="group flex items-center gap-2 px-4 py-2 text-sm font-bold text-slate-400 hover:text-red-400 transition-colors"
            >
               <span className="text-lg group-hover:rotate-12 transition-transform">🗑️</span>
               WYCZYŚĆ
            </button>
         </div>
      </div>
   );
}