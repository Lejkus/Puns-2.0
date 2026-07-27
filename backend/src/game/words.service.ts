import { Injectable } from '@nestjs/common';

const WORDS = [
  'KOTEK',
  'PIESEK',
  'JABŁKO',
  'DOM',
  'DRZEWO',
  'SŁOŃCE',
  'KSIĘŻYC',
  'SAMOCHÓD',
];

@Injectable()
export class WordsService {
  getRandomWord(): string {
    return WORDS[Math.floor(Math.random() * WORDS.length)];
  }
}
