import { useState } from "react";
import RegisterPage from "./pages/Register";
import LoginPage from "./pages/Login";
import { Button } from "./components/ui/button";

function App() {
  const [view, setView] = useState<"login" | "register">("login");

  return (
    <div className="relative">
      {/* przełącznik na górze ekranu do testów */}
      <div className="absolute top-4 left-4 z-50 flex gap-2">
        <Button variant="outline" onClick={() => setView("login")}>Widok Logowania</Button>
        <Button variant="outline" onClick={() => setView("register")}>Widok Rejestracji</Button>
      </div>

      {view === "login" ? <LoginPage /> : <RegisterPage />}
    </div>
  );
}

export default App;