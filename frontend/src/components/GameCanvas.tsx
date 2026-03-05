import { useEffect, useState, useRef } from "react";
import { Stage, Layer, Rect } from "react-konva";
import { io, Socket } from "socket.io-client";

// Ustawienia naszego Pixel Engine
const CANVAS_SIZE = 400; // Rozmiar płótna 400x400
const PIXEL_SIZE = 10; // Rozmiar jednego "piksela"
const GRID_WIDTH = CANVAS_SIZE / PIXEL_SIZE; // Mamy siatkę 40x40 pikseli

const COLORS = [
   { name: "Red", value: "#ef4444" },
   { name: "Orange", value: "#f97316" },
   { name: "Yellow", value: "#eab308" },
   { name: "Green", value: "#22c55e" },
   { name: "Blue", value: "#3b82f6" },
   { name: "Purple", value: "#a855f7" },
   { name: "Black", value: "#000000" },
   { name: "Eraser", value: "#ffffff" }, // Gumka to po prostu biały kolor
];

export default function GameCanvas() {
   const [socket, setSocket] = useState<Socket | null>(null);

   // Trzymamy pokolorowane piksele jako obiekt: { "indeks": "kolor" }
   // To o wiele szybsze niż przeszukiwanie tablicy!
   const [pixels, setPixels] = useState<Record<number, string>>({});

   const isDrawing = useRef(false);
   const [currentColor, setCurrentColor] = useState("#ef4444");

   const clearCanvas = () => {
      setPixels({});
      socket?.emit("clear"); // Poinformuj serwer
   };

   const [role, setRole] = useState<"painter" | "guesser">("guesser");
   const [word, setWord] = useState<string | null>(null);

   useEffect(() => {
      if (!socket) return;

      socket.on(
         "roleAssign",
         (data: { role: "painter" | "guesser"; word: string | null }) => {
            setRole(data.role);
            setWord(data.word);
         }
      );

      return () => {
         socket.off("roleAssign");
      };
   }, [socket]);

   useEffect(() => {
      // 1. Setup Socket.io - Łączymy się z serwerem
      const newSocket = io("http://localhost:3000");
      setSocket(newSocket);

      newSocket.on("connect", () => {
         console.log("🔌 Socket podłączony! ID:", newSocket.id);
      });

      // 2. Odbieranie pikseli od innych graczy
      newSocket.on("drawUpdate", (data: { index: number; color: string }) => {
         setPixels((prev) => ({ ...prev, [data.index]: data.color }));
      });

      // NASŁUCHIWANIE NA CZYSZCZENIE
      newSocket.on("clearCanvas", () => {
         console.log("🧼 Serwer nakazał wyczyścić płótno!");
         setPixels({}); // To czyści tablicę u każdego gracza
      });

      return () => {
         newSocket.off("clearCanvas"); // Ważne: wyłączamy nasłuch przy wychodzeniu
         newSocket.disconnect();
      };
   }, []);

   // 3. Mechanika Drag-to-Paint
   const handlePaint = (e: any) => {
      if (!isDrawing.current || !socket) return;

      // Pobieramy dokładną pozycję myszki z biblioteki Konva
      const stage = e.target.getStage();
      const point = stage.getPointerPosition();
      if (!point) return;

      // Obliczamy w którym "kwadraciku" (grid) jesteśmy
      const gridX = Math.floor(point.x / PIXEL_SIZE);
      const gridY = Math.floor(point.y / PIXEL_SIZE);

      // Zabezpieczenie przed wyjściem za ramy
      if (gridX < 0 || gridX >= GRID_WIDTH || gridY < 0 || gridY >= GRID_WIDTH)
         return;

      // TWOJA MECHANIKA: Przeliczanie pozycji na jeden indeks w tablicy
      const index = gridY * GRID_WIDTH + gridX;

      // Optymalizacja: jeśli piksel jest już w tym kolorze, ignoruj (oszczędza transfer)
      if (pixels[index] === currentColor) return;

      // Aktualizujemy płótno u siebie
      setPixels((prev) => ({ ...prev, [index]: currentColor }));

      // Wysyłamy informację na serwer
      socket.emit("draw", { index, color: currentColor });
   };

   return (
      <div className="flex flex-col items-center gap-6 mt-8">
         {/* 1. PŁÓTNO (Twoje bez zmian, dodałem tylko delikatny cień - shadow) */}
         <div className="bg-slate-800 p-2 rounded-xl shadow-[0_0_50px_-12px_rgba(79,70,229,0.3)] border border-slate-700">
            <Stage
               width={CANVAS_SIZE}
               height={CANVAS_SIZE}
               className="bg-white cursor-crosshair rounded-lg overflow-hidden"
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
                           listening={false}
                        />
                     );
                  })}
               </Layer>
            </Stage>
         </div>

         {/* 2. NOWOŚĆ: TOOLBAR (Paleta kolorów i przycisk czyszczenia) */}
         <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center gap-6 shadow-xl">
            {/* Przyciski z kolorami */}
            <div className="flex gap-2">
               {COLORS.map((color) => (
                  <button
                     key={color.value}
                     onClick={() => setCurrentColor(color.value)}
                     className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 flex items-center justify-center ${
                        currentColor === color.value
                           ? "border-indigo-500 scale-125"
                           : "border-transparent"
                     }`}
                     style={{
                        backgroundColor:
                           color.value === "#ffffff" ? "#f1f5f9" : color.value,
                     }}
                     title={color.name}
                  >
                     {/* Ikonka dla gumki */}
                     {color.name === "Eraser" && (
                        <span className="text-sm">🧼</span>
                     )}
                  </button>
               ))}
            </div>

            {/* Pionowa linia oddzielająca */}
            <div className="w-[1px] h-8 bg-slate-700" />

            {/* Przycisk Wyczyść */}
            <button
               onClick={clearCanvas}
               className="px-4 py-2 text-sm font-medium text-white bg-slate-800 border border-slate-700 rounded-md hover:bg-red-900/40 hover:text-red-400 hover:border-red-800 transition-all"
            >
               Wyczyść
            </button>
         </div>

         {/* 3. Podpis aktualnego koloru */}
         <div className="flex items-center gap-2 text-sm text-slate-500">
            Wybrany kolor:{" "}
            <span className="text-slate-300 font-mono uppercase">
               {COLORS.find((c) => c.value === currentColor)?.name}
            </span>
         </div>
      </div>
   );
}
