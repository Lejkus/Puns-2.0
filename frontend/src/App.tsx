import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./store/useAuthStore";
import RegisterPage from "./pages/Register";
import LoginPage from "./pages/Login";
import { Button } from "./components/ui/button";
import GameCanvas from "./components/GameCanvas";

function App() {
   const { user, isAuthenticated, logout } = useAuthStore();

   return (
      <BrowserRouter>
         <Routes>
            {/* Publiczne trasy */}
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

            {/* Chroniona trasa (dostępna tylko po zalogowaniu) */}
            <Route
               path="/dashboard"
               element={
                  isAuthenticated ? (
                     <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-white pb-10">
                        <h1 className="text-3xl font-bold mt-10">
                           Lobby Gry 🎮
                        </h1>
                        <p className="text-slate-400">
                           Grasz jako: {user?.nickname}
                        </p>

                        {/* NASZE PŁÓTNO */}
                        <GameCanvas />

                        <Button
                           variant="destructive"
                           className="mt-8"
                           onClick={logout}
                        >
                           Wyloguj się
                        </Button>
                     </div>
                  ) : (
                     <Navigate to="/login" />
                  )
               }
            />

            {/* Domyślne przekierowanie */}
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
