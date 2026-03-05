import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
   Card,
   CardContent,
   CardDescription,
   CardFooter,
   CardHeader,
   CardTitle,
} from "@/components/ui/card";
import { Link } from "react-router-dom";

export default function RegisterPage() {
   const [formData, setFormData] = useState({
      nickname: "",
      email: "",
      password: "",
   });

   const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();

      try {
         const response = await fetch("http://localhost:3000/users/register", {
            method: "POST",
            headers: {
               "Content-Type": "application/json",
            },
            body: JSON.stringify(formData),
         });

         const data = await response.json();

         if (!response.ok) {
            throw new Error(data.message || "Coś poszło nie tak");
         }

         console.log("Sukces! Zarejestrowano:", data);
         alert("Konto stworzone! Możesz się teraz zalogować.");
      } catch (error: any) {
         console.error("Błąd rejestracji:", error.message);
         alert("Błąd: " + error.message);
      }
   };

   return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950 p-4">
         <Card className="w-full max-w-md bg-slate-900 border-slate-800 text-white">
            <CardHeader className="space-y-1">
               <CardTitle className="text-2xl font-bold text-center">
                  Stwórz konto
               </CardTitle>
               <CardDescription className="text-center text-slate-400">
                  Dołącz do gry w Puns 2.0 i zacznij rysować!
               </CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
               <CardContent className="space-y-4">
                  <div className="space-y-2">
                     <Label htmlFor="nickname">Nickname</Label>
                     <Input
                        id="nickname"
                        placeholder="Twój nick w grze"
                        className="bg-slate-800 border-slate-700 focus:ring-indigo-500"
                        required
                        onChange={(e) =>
                           setFormData({
                              ...formData,
                              nickname: e.target.value,
                           })
                        }
                     />
                  </div>
                  <div className="space-y-2">
                     <Label htmlFor="email">Email</Label>
                     <Input
                        id="email"
                        type="email"
                        placeholder="marian@przyklad.pl"
                        className="bg-slate-800 border-slate-700"
                        required
                        onChange={(e) =>
                           setFormData({ ...formData, email: e.target.value })
                        }
                     />
                  </div>
                  <div className="space-y-2">
                     <Label htmlFor="password">Hasło</Label>
                     <Input
                        id="password"
                        type="password"
                        className="bg-slate-800 border-slate-700"
                        required
                        onChange={(e) =>
                           setFormData({
                              ...formData,
                              password: e.target.value,
                           })
                        }
                     />
                  </div>
               </CardContent>
               <CardFooter className="flex flex-col gap-4">
                  <Button
                     type="submit"
                     className="w-full bg-indigo-600 hover:bg-indigo-500 text-white"
                  >
                     Zarejestruj się
                  </Button>
                  <p className="text-sm text-slate-400 text-center">
                     Masz już konto?{" "}
                     <Link
                        to="/login"
                        className="text-indigo-400 hover:underline"
                     >
                        Zaloguj się
                     </Link>
                  </p>
               </CardFooter>
            </form>
         </Card>
      </div>
   );
}
