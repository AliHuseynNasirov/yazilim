// Kursun bölmələri (kitabdakı sıra ilə). "review" olanlar yalnız qarışıq testdir.
import e0 from './e0.js';
import e1 from './e1.js';
import e2 from './e2.js';
import e3 from './e3.js';
import e4 from './e4.js';
import e5 from './e5.js';
import e6 from './e6.js';
import e7 from './e7.js';
import e8 from './e8.js';

const p1 = { id: 'p1', review: ['e1', 'e2', 'e3', 'e4'], n: 30, icon: '🔁', title: 'Plateau 1 · Təkrar (1–4)', az: '1–4-cü bölmələrdən qarışıq təkrar testi: sözlər, qrammatika, dinləmə, yazı və oxu.' };
const p2 = { id: 'p2', review: ['e5', 'e6', 'e7', 'e8'], n: 30, icon: '🔁', title: 'Plateau 2 · Təkrar (5–8)', az: '5–8-ci bölmələrdən qarışıq təkrar testi: sözlər, qrammatika, dinləmə, yazı və oxu.' };
const ex = { id: 'ex', review: ['e0', 'e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7', 'e8'], n: 40, icon: '🎓', title: 'A1.1 yekun imtahanı', az: 'Bütün kursdan (Start və 1–8-ci bölmələr) 40 sual. Keçsən, A1.1 səviyyəsini bitirmisən!' };

export const UNITS = [e0, e1, e2, e3, e4, p1, e5, e6, e7, e8, p2, ex];
export const findUnit = (id) => UNITS.find((u) => u.id === id);
