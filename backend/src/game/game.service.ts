import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { WordsService } from './words.service';

export interface Player {
  id: string; // Socket ID
  userId: string;
  nickname: string;
  isHost: boolean;
  score: number;
  hasGuessed: boolean;
}

export interface GameState {
  roomId: string;
  status: 'WAITING' | 'PLAYING' | 'FINISHED';
  players: Player[];
  currentDrawerId: string | null;
  currentWord: string | null;
  timeLeft: number;
  currentRound: number;
  maxRounds: number;
  drawerIndex: number; // Kto aktualnie rysuje (indeks w tablicy players)
}

const MAX_ROUNDS = 3;

// Usuwa polskie znaki diakrytyczne i normalizuje wielkość liter, żeby "zolw" == "żółw"
function normalizeGuess(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

@Injectable()
export class GameService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wordsService: WordsService,
  ) {}

  // Przechowujemy stan gier i aktywne timery
  private games = new Map<string, GameState>();
  private intervals = new Map<string, NodeJS.Timeout>();

  // Pobierz stan pokoju (lub stwórz nowy, jeśli nie istnieje)
  getGameState(roomId: string): GameState {
    if (!this.games.has(roomId)) {
      this.games.set(roomId, {
        roomId,
        status: 'WAITING',
        players: [],
        currentDrawerId: null,
        currentWord: null,
        timeLeft: 0,
        currentRound: 0,
        maxRounds: MAX_ROUNDS,
        drawerIndex: 0,
      });
    }
    return this.games.get(roomId)!;
  }

  // Dodaj gracza do gry
  addPlayer(
    roomId: string,
    id: string,
    userId: string,
    nickname: string,
  ): GameState {
    const game = this.getGameState(roomId);
    const isHost = game.players.length === 0;

    game.players.push({
      id,
      userId,
      nickname,
      isHost,
      score: 0,
      hasGuessed: false,
    });

    return game;
  }

  // Usuń gracza i przenieś Hosta
  removePlayer(socketId: string): string | null {
    for (const [roomId, game] of this.games.entries()) {
      const index = game.players.findIndex((p) => p.id === socketId);
      if (index !== -1) {
        const wasHost = game.players[index].isHost;
        game.players.splice(index, 1);

        if (game.players.length > 0) {
          if (wasHost) game.players[0].isHost = true;
          return roomId; // Zwracamy pokój, żeby Gateway mógł odświeżyć listę
        } else {
          // Pokój pusty - sprzątamy pamięć i timery!
          if (this.intervals.has(roomId)) {
            clearInterval(this.intervals.get(roomId)!);
            this.intervals.delete(roomId);
          }
          this.games.delete(roomId);
          return null;
        }
      }
    }
    return null;
  }

  // --- LOGIKA GRY ---

  startGame(roomId: string, server: Server) {
    const game = this.games.get(roomId);
    if (!game || game.status === 'PLAYING') return;

    game.status = 'PLAYING';
    game.currentRound = 1;
    game.drawerIndex = 0; // Zaczyna pierwsza osoba z listy (możemy potem to losować)

    this.startTurn(roomId, server);
  }

  startTurn(roomId: string, server: Server) {
    const game = this.games.get(roomId);
    if (!game) return;

    // Resetujemy statusy zgadywania
    game.players.forEach((p) => (p.hasGuessed = false));

    // Wybieramy rysownika i słowo
    const drawer = game.players[game.drawerIndex];
    game.currentDrawerId = drawer.id;
    game.currentWord = this.wordsService.getRandomWord();
    game.timeLeft = 60; // 60 sekund na rysowanie

    // 1. Informujemy wszystkich (oprócz słowa)
    server.to(roomId).emit('turnStarted', {
      drawerId: game.currentDrawerId,
      drawerName: drawer.nickname,
      timeLeft: game.timeLeft,
      currentRound: game.currentRound,
    });

    // 2. Informujemy TYLKO rysownika o jego słowie!
    server
      .to(game.currentDrawerId)
      .emit('yourWord', { word: game.currentWord });

    // 3. Startujemy Timer
    if (this.intervals.has(roomId)) clearInterval(this.intervals.get(roomId)!);

    const timer = setInterval(() => {
      game.timeLeft -= 1;

      // Co sekundę wysyłamy aktualny czas
      server.to(roomId).emit('timerUpdate', { timeLeft: game.timeLeft });

      // Czas minął!
      if (game.timeLeft <= 0) {
        clearInterval(timer);
        server
          .to(roomId)
          .emit('messageUpdate', {
            user: 'SYSTEM',
            text: `Czas minął! Hasło to: ${game.currentWord}`,
          });
        this.endTurn(roomId, server);
      }
    }, 1000);

    this.intervals.set(roomId, timer);
  }

  endTurn(roomId: string, server: Server) {
    const game = this.games.get(roomId);
    if (!game) return;

    // Przesuwamy kolejkę na następną osobę
    game.drawerIndex += 1;

    // Jeśli wszyscy już rysowali, przechodzimy do nowej rundy lub kończymy grę
    if (game.drawerIndex >= game.players.length) {
      game.drawerIndex = 0;
      game.currentRound += 1;

      if (game.currentRound > game.maxRounds) {
        this.finishGame(roomId, server);
        return;
      }
    }

    // Odpalamy następną turę po 5 sekundach przerwy
    setTimeout(() => {
      this.startTurn(roomId, server);
    }, 5000);
  }

  private finishGame(roomId: string, server: Server) {
    const game = this.games.get(roomId);
    if (!game) return;

    game.status = 'FINISHED';
    game.currentDrawerId = null;
    game.currentWord = null;

    if (this.intervals.has(roomId)) {
      clearInterval(this.intervals.get(roomId)!);
      this.intervals.delete(roomId);
    }

    const finalScores = [...game.players].sort((a, b) => b.score - a.score);
    server.to(roomId).emit('gameEnded', { players: finalScores });

    this.prisma.room
      .update({ where: { name: roomId }, data: { status: 'LOBBY' } })
      .catch(() => {
        // Pokój mógł zostać usunięty w międzyczasie - nic wtedy nie robimy
      });
  }

  // --- ZGADYWANIE ---

  checkGuess(
    roomId: string,
    playerId: string,
    text: string,
    server: Server,
  ): boolean {
    const game = this.games.get(roomId);
    if (!game || game.status !== 'PLAYING') return false;

    // Rysownik nie zgaduje
    if (playerId === game.currentDrawerId) return false;

    const player = game.players.find((p) => p.id === playerId);
    if (!player || player.hasGuessed) return false;

    if (!game.currentWord) return false;
    if (normalizeGuess(text) === normalizeGuess(game.currentWord)) {
      player.hasGuessed = true;
      player.score += 10;

      // --- KLUCZOWA LOGIKA KOŃCZENIA TURY ---
      // Pobierz wszystkich, którzy NIE są aktualnym rysownikiem
      const guessers = game.players.filter(
        (p) => p.id !== game.currentDrawerId,
      );

      // Sprawdź, czy KAŻDY z nich już odgadł
      const everyoneGuessed = guessers.every((p) => p.hasGuessed);

      if (everyoneGuessed) {
        // Zamiast czekać na kolejny tick timera, kończymy turę od razu
        if (this.intervals.has(roomId)) {
          clearInterval(this.intervals.get(roomId)!);
          this.intervals.delete(roomId);
        }
        game.timeLeft = 0;
        server.to(roomId).emit('timerUpdate', { timeLeft: 0 });
        server.to(roomId).emit('messageUpdate', {
          user: 'SYSTEM',
          text: `Wszyscy odgadli hasło: ${game.currentWord}`,
          isSystem: true,
        });
        this.endTurn(roomId, server);
      }

      return true;
    }
    return false;
  }
}
