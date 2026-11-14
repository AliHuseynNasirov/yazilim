// Kursun bölmələri (kitabdakı sıra ilə)
import e0 from './e0.js';
import e1 from './e1.js';

export const UNITS = [e0, e1];
export const findUnit = (id) => UNITS.find((u) => u.id === id);
