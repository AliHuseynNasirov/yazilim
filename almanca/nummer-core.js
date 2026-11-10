// "Hast du die Nummer von …?" rol oyunu — UI-sız hissə: siyahılar və nömrələrin yoxlanması.
// Rolle A-da 4 nömrə var, 4-ü boşdur; Rolle B-də əksinə (kitabdakı kimi, Kursbuch A1 S. 31, 3).

import { germanNumber } from './numbers-core.js';
import { digitsOf } from './anmeldung-core.js';

export const PEOPLE = [
  { key: 'leon', name: 'Leon Heinrich', num: '01622082682', owner: 'B' },
  { key: 'katja', name: 'Katja Reichelt', num: '01622082784', owner: 'A' },
  { key: 'christina', name: 'Christina Fröhlich', num: '01622090503', owner: 'B' },
  { key: 'paul', name: 'Paul Kuhn', num: '01622082148', owner: 'A' },
  { key: 'hannah', name: 'Hannah Schmitt', num: '+49 221 84659510', owner: 'B' },
  { key: 'thomas', name: 'Thomas Müller', num: '+49 231 53256667', owner: 'A' },
  { key: 'karsten', name: 'Karsten Fischer', num: '+49 30 68831748', owner: 'B' },
  { key: 'carola', name: 'Carola Schumann', num: '+49 341 25659113', owner: 'A' },
];

export const OTHER = { A: 'B', B: 'A' };
/** Bu rolun siyahısında nömrəsi OLAN şəxslər */
export const hasList = (role) => PEOPLE.filter((p) => p.owner === role);
/** Bu rolun siyahısında nömrəsi OLMAYAN (soruşmalı olduğu) şəxslər */
export const missingList = (role) => PEOPLE.filter((p) => p.owner !== role);

// Nömrənin müqayisə forması: yalnız rəqəmlər, "0049" = "+49"
export function canon(s) {
  let d = digitsOf(String(s || '').replace(/\+/g, ' 00'));
  if (d.startsWith('00')) d = d.slice(2);
  return d;
}

/** Nömrə necə deyilir (müəllim üçün): rəqəm-rəqəm, qruplarla */
export function spokenNumber(num) {
  const say = (g) => g.split('').map((x) => germanNumber(+x)).join(' ');
  if (num.startsWith('+')) {
    const groups = num.slice(1).split(/\s+/);
    return 'plus ' + groups.map(say).join(', ');
  }
  // 01622082682 → 0162 2082682
  return [num.slice(0, 4), num.slice(4)].map(say).join(', ');
}

/** Şagirdin YAZDIĞI nömrə düzdürmü */
export const checkTyped = (p, value) => !!String(value || '').trim() && canon(value) === canon(p.num);

/**
 * Müəllimin EŞİTDİYİ cavab: nömrə düzdürmü, yoxsa şagird "Nein" deyib?
 * @returns {{ ok: boolean, said: 'number'|'no'|'none' }}
 */
export function checkHeard(p, value) {
  const v = String(value || '');
  const c = canon(v);
  if (c.length >= 6) return { ok: c === canon(p.num), said: 'number' };
  if (/\bnein\b|\bnicht\b|\bkeine?\b/i.test(v)) return { ok: false, said: 'no' };
  return { ok: false, said: 'none' };
}

/** Yeni oyun: rol və kimin başladığı təsadüfi */
export function newGame(rnd = Math.random) {
  return { role: rnd() < 0.5 ? 'A' : 'B', starter: rnd() < 0.5 ? 'learner' : 'teacher' };
}
