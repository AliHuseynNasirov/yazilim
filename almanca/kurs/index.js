// Kursun bölmələri (kitabdakı sıra ilə)
import e0 from './e0.js';
import e1 from './e1.js';
import e2 from './e2.js';
import e3 from './e3.js';
import e4 from './e4.js';
import e5 from './e5.js';

export const UNITS = [e0, e1, e2, e3, e4, e5];
export const findUnit = (id) => UNITS.find((u) => u.id === id);
