// "Guten Appetit! — Food Blogger" (Das Leben A1, 4-cü bölmə): mətn, suallar və cavab yoxlaması. DOM yoxdur — test olunur.
import { wordsToDigits } from './anmeldung-core.js';

// ---------- mətn ----------
export const TEXT = [
  {
    who: 'Was machen Food Blogger?',
    lines: [
      ['Viele Menschen fotografieren Essen oder Getränke und posten die Fotos im Internet.', 'Çox adam yemək və ya içki şəkli çəkir və şəkilləri internetdə paylaşır.'],
      ['Dann kommen die Kommentare: Sieht lecker aus! Wo bist du? Toll! Was ist das?', 'Sonra şərhlər gəlir: Dadlı görünür! Haradasan? Əla! Bu nədir?'],
      ['Andere Menschen sagen: Das nervt!', 'Başqa adamlar deyir: Bu, adamı əsəbiləşdirir!'],
    ],
  },
  {
    who: '➕ Elaine, 19',
    lines: [
      ['Essen ist Kultur! Essen ist Leben!', 'Yemək mədəniyyətdir! Yemək həyatdır!'],
      ['Ich poste auch oft Fotos von Essen im Internet.', 'Mən də tez-tez internetdə yemək şəkilləri paylaşıram.'],
      ['Das ist interessant. Essen ist ein super Thema.', 'Bu maraqlıdır. Yemək əla mövzudur.'],
    ],
  },
  {
    who: '➖ Sascha, 22',
    lines: [
      ['Bitte keine Fotos von Essen! Das nervt!', 'Xahiş edirəm, yemək şəkli olmasın! Bu, adamı əsəbiləşdirir!'],
      ['Ich esse gern im Restaurant, aber ich fotografiere und poste das Essen nicht.', 'Restoranda yemək yeməyi xoşlayıram, amma yeməyin şəklini çəkmirəm və paylaşmıram.'],
      ['Das finde ich nicht interessant. Meine Freunde machen das auch nicht.', 'Bunu maraqlı hesab etmirəm. Dostlarım da bunu etmir.'],
      ['Sport oder Musik sind interessant, aber Essen ist kein Thema.', 'İdman və ya musiqi maraqlıdır, amma yemək mövzu deyil.'],
    ],
  },
];

// Pro (+) oder kontra (−)
export const PRO = [
  ['Ich finde das interessant!', 'pro', 'Bunu maraqlı hesab edirəm!'],
  ['Ich poste keine Fotos von Essen.', 'kontra', 'Mən yemək şəkli paylaşmıram.'],
  ['Das ist toll!', 'pro', 'Bu əladır!'],
  ['Das nervt!', 'kontra', 'Bu, adamı əsəbiləşdirir!'],
  ['Ich mache das auch.', 'pro', 'Mən də bunu edirəm.'],
  ['Ich finde das nicht interessant.', 'kontra', 'Bunu maraqlı hesab etmirəm.'],
  ['Meine Freunde machen das auch.', 'pro', 'Dostlarım da bunu edir.'],
  ['Meine Freunde finden die Fotos toll.', 'pro', 'Dostlarım şəkilləri əla hesab edir.'],
];

// ---------- normallaşdırma ----------
export function norm(s) {
  return wordsToDigits(
    String(s || '')
      .toLowerCase()
      .replace(/ß/g, 'ss')
      .replace(/ä|ae/g, 'a')
      .replace(/ö|oe/g, 'o')
      .replace(/ü|ue/g, 'u')
      .replace(/[^a-z0-9 ]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  )
    .replace(/\s+/g, ' ')
    .trim();
}
const has = (t, re) => re.test(norm(t));
const nums = (t) => (norm(t).match(/\d+/g) || []).map(Number);

// Ümumi səhvlər (sənin fikrin sualları): ich + ...st, du ilə cavab, deine → meine
function commonErrors(t) {
  const n = norm(t);
  const m = n.match(/\bich (\w+st)\b/);
  if (m && !/^(bist|ist|isst)$/.test(m[1])) return `"ich" ilə fel "-e" ilə bitir: "ich ${m[1].replace(/e?st$/, 'e')}" ("${m[1]}" — "du" üçündür).`;
  if (/\bich isst\b/.test(n)) return '"ich" ilə: "ich esse" ("isst" — du / er üçündür).';
  if (/\bich bist\b/.test(n)) return '"ich" ilə: "ich bin".';
  if (/\bdeine freunde\b/.test(n)) return 'Sual "deine Freunde" (sənin dostların) ilədir — cavabda "meine Freunde" (mənim dostlarım) de.';
  if (/^(ja |nein )?(du )/.test(n) || /\bdu (findest|postest|machst|isst|fotografierst)\b/.test(n)) return 'Sual "du" ilədir — cavabı "ich" ilə ver: "Ich …".';
  if (/\bmeine freunde (macht|findet|postet)\b/.test(n)) return '"Freunde" cəmdir: "meine Freunde machen / finden / posten".';
  return null;
}

// Bəli/xeyr sualları: yes / no nümunələri və uyğunluq
function yesNo({ yes, no, exYes, exNo, extra }) {
  return (t) => {
    const n = norm(t);
    const isYes = yes.test(n);
    const isNo = no.test(n);
    const saysNein = /^nein\b/.test(n);
    const saysJa = /^ja\b/.test(n);
    if (isNo && saysJa) return { ok: false, az: `"Ja" deyirsən, amma cümlə inkardır. Ya "Nein, …" de, ya da: "${exYes}"` };
    if (isYes && !isNo && saysNein) return { ok: false, az: `"Nein" deyirsən, amma cümlə təsdiqdir. İnkar belədir: "${exNo}"` };
    if (isYes || isNo) return { ok: true };
    const extraMsg = extra && extra(n);
    if (extraMsg) return { ok: false, az: extraMsg };
    const ce = commonErrors(t);
    if (ce) return { ok: false, az: ce };
    return { ok: false, az: `Tam cümlə ilə cavab ver: "${exYes}" və ya "${exNo}"` };
  };
}

// Fikir sualları: bir neçə düzgün qəlib
function opinion({ ok, ex, extra }) {
  return (t) => {
    const n = norm(t);
    if (ok.test(n)) return { ok: true };
    const extraMsg = extra && extra(n);
    if (extraMsg) return { ok: false, az: extraMsg };
    const ce = commonErrors(t);
    if (ce) return { ok: false, az: ce };
    return { ok: false, az: `Tam cümlə ilə cavab ver, məsələn: "${ex[0]}"` };
  };
}

const ADJ = '(toll|gut|super|interessant|lecker|schon|langweilig|ok|okay|nicht (gut|toll|interessant|schon|super)|blod|doof)';

// ---------- suallar ----------
// type: text (mətndən) | pro (pro oder kontra) | me (sənin fikrin)
export const QUESTIONS = [
  // mətndən
  { id: 't1', type: 'text', q: 'Wer postet oft Fotos von Essen im Internet?', az: 'Kim internetdə tez-tez yemək şəkilləri paylaşır?', ex: [['Elaine.', 'Elaine.'], ['Elaine postet oft Fotos von Essen.', 'Elaine tez-tez yemək şəkilləri paylaşır.']], check: (t) => (has(t, /\belaine\b|\belen\b|\bele?ine\b/) ? { ok: true } : { ok: false, az: 'Mətnə bax: "Ich poste auch oft Fotos von Essen im Internet" — bunu Elaine yazır. Cavab: "Elaine."' }) },
  { id: 't2', type: 'text', q: 'Wie alt ist Elaine?', az: 'Elaine neçə yaşındadır?', ex: [['Sie ist neunzehn.', 'O, 19 yaşındadır.'], ['Neunzehn.', '19.']], check: (t) => (nums(t).includes(19) ? { ok: true } : { ok: false, az: 'Mətndə: "Elaine, 19". Cavab: "Sie ist neunzehn (Jahre alt)."' }) },
  { id: 't3', type: 'text', q: 'Wie alt ist Sascha?', az: 'Sascha neçə yaşındadır?', ex: [['Er ist zweiundzwanzig.', 'O, 22 yaşındadır.'], ['Zweiundzwanzig.', '22.']], check: (t) => (nums(t).includes(22) ? { ok: true } : { ok: false, az: 'Mətndə: "Sascha, 22". Cavab: "Er ist zweiundzwanzig."' }) },
  { id: 't4', type: 'text', q: 'Wo isst Sascha gern?', az: 'Sascha harada yemək yeməyi xoşlayır?', ex: [['Im Restaurant.', 'Restoranda.'], ['Sascha isst gern im Restaurant.', 'Sascha restoranda yeməyi xoşlayır.']], check: (t) => (has(t, /restaurant/) ? { ok: true } : { ok: false, az: 'Sascha yazır: "Ich esse gern im Restaurant." Cavab: "Im Restaurant."' }) },
  { id: 't5', type: 'text', q: 'Was ist für Elaine ein super Thema?', az: 'Elaine üçün əla mövzu nədir?', ex: [['Essen.', 'Yemək.'], ['Essen ist ein super Thema.', 'Yemək əla mövzudur.']], check: (t) => (has(t, /\bessen\b/) ? { ok: true } : { ok: false, az: 'Elaine yazır: "Essen ist ein super Thema." Cavab: "Essen."' }) },
  { id: 't6', type: 'text', q: 'Was ist für Sascha interessant?', az: 'Sascha üçün nə maraqlıdır?', ex: [['Sport oder Musik.', 'İdman və ya musiqi.'], ['Sport und Musik sind interessant.', 'İdman və musiqi maraqlıdır.']], check: (t) => (has(t, /sport/) && has(t, /musik/) ? { ok: true } : { ok: false, az: 'Sascha yazır: "Sport oder Musik sind interessant." İkisini də de: "Sport oder Musik."' }) },
  { id: 't7', type: 'text', q: 'Was sagen andere Menschen?', az: 'Başqa adamlar nə deyir?', ex: [['Das nervt!', 'Bu, adamı əsəbiləşdirir!']], check: (t) => (has(t, /nervt/) ? { ok: true } : { ok: false, az: 'Mətndə: "Andere Menschen sagen: Das nervt!" Cavab: "Das nervt!"' }) },
  { id: 't8', type: 'text', q: 'Was schreiben die Leute in den Kommentaren?', az: 'İnsanlar şərhlərdə nə yazır?', ex: [['Sieht lecker aus! Toll!', 'Dadlı görünür! Əla!'], ['Wo bist du? Was ist das?', 'Haradasan? Bu nədir?']], check: (t) => (has(t, /lecker|toll|wo bist du|was ist das/) ? { ok: true } : { ok: false, az: 'Şərhlər: "Sieht lecker aus! Wo bist du? Toll! Was ist das?" Birini və ya bir neçəsini de.' }) },
  { id: 't9', type: 'text', q: 'Postet Sascha Fotos von Essen?', az: 'Sascha yemək şəkilləri paylaşır?', ex: [['Nein, er postet keine Fotos von Essen.', 'Xeyr, o, yemək şəkli paylaşmır.'], ['Nein.', 'Xeyr.']], check: (t) => (has(t, /^nein\b|\bkeine\b|\bnicht\b/) && !has(t, /^ja\b/) ? { ok: true } : { ok: false, az: 'Sascha yazır: "ich fotografiere und poste das Essen nicht." Cavab: "Nein, er postet keine Fotos von Essen."' }) },
  // sənin fikrin
  {
    id: 'm1', type: 'me', q: 'Findest du das interessant?', az: 'Bunu maraqlı hesab edirsən?',
    ex: [['Ja, ich finde das interessant.', 'Bəli, bunu maraqlı hesab edirəm.'], ['Nein, ich finde das nicht interessant.', 'Xeyr, bunu maraqlı hesab etmirəm.']],
    check: yesNo({ yes: /(ich finde (das|es)|das finde ich) interessant/, no: /(ich finde (das|es)|das finde ich) nicht interessant/, exYes: 'Ja, ich finde das interessant.', exNo: 'Nein, ich finde das nicht interessant.', extra: (n) => (/finde nicht (das|es)/.test(n) ? '"nicht" sifətdən əvvəl gəlir: "Ich finde das nicht interessant."' : null) }),
  },
  {
    id: 'm2', type: 'me', q: 'Postest du Fotos von Essen?', az: 'Sən yemək şəkilləri paylaşırsan?',
    ex: [['Ja, ich poste Fotos von Essen.', 'Bəli, yemək şəkilləri paylaşıram.'], ['Nein, ich poste keine Fotos von Essen.', 'Xeyr, yemək şəkli paylaşmıram.']],
    check: yesNo({ yes: /ich poste (oft |auch |gern |manchmal )*fotos/, no: /ich poste keine fotos/, exYes: 'Ja, ich poste Fotos von Essen.', exNo: 'Nein, ich poste keine Fotos von Essen.', extra: (n) => (/poste (nicht|kein) fotos/.test(n) ? 'İsimlə "keine" işlənir: "Ich poste keine Fotos von Essen." ("nicht Fotos" / "kein Fotos" yox)' : null) }),
  },
  {
    id: 'm3', type: 'me', q: 'Machst du das auch?', az: 'Sən də bunu edirsən? (yemək şəkli çəkib paylaşmaq)',
    ex: [['Ja, ich mache das auch.', 'Bəli, mən də bunu edirəm.'], ['Nein, ich mache das nicht.', 'Xeyr, mən bunu etmirəm.']],
    check: yesNo({ yes: /ich mache das( auch)?$|ich mache das auch/, no: /ich mache das (auch )?nicht/, exYes: 'Ja, ich mache das auch.', exNo: 'Nein, ich mache das nicht.' }),
  },
  {
    id: 'm4', type: 'me', q: 'Machen deine Freunde das auch?', az: 'Sənin dostların da bunu edir?',
    ex: [['Ja, meine Freunde machen das auch.', 'Bəli, dostlarım da bunu edir.'], ['Nein, meine Freunde machen das nicht.', 'Xeyr, dostlarım bunu etmir.']],
    check: yesNo({ yes: /meine freunde machen das( auch)?$|meine freunde machen das auch/, no: /meine freunde machen das (auch )?nicht/, exYes: 'Ja, meine Freunde machen das auch.', exNo: 'Nein, meine Freunde machen das nicht.' }),
  },
  {
    id: 'm5', type: 'me', q: 'Isst du gern im Restaurant?', az: 'Restoranda yemək yeməyi xoşlayırsan?',
    ex: [['Ja, ich esse gern im Restaurant.', 'Bəli, restoranda yeməyi xoşlayıram.'], ['Nein, ich esse nicht gern im Restaurant.', 'Xeyr, restoranda yeməyi xoşlamıram.']],
    check: yesNo({ yes: /ich esse gerne? im restaurant/, no: /ich esse nicht gerne? im restaurant/, exYes: 'Ja, ich esse gern im Restaurant.', exNo: 'Nein, ich esse nicht gern im Restaurant.', extra: (n) => (/ich esse gerne? nicht/.test(n) ? '"nicht" "gern"-dən əvvəl gəlir: "Ich esse nicht gern im Restaurant."' : null) }),
  },
  {
    id: 'm6', type: 'me', q: 'Fotografierst du das Essen im Restaurant?', az: 'Restoranda yeməyin şəklini çəkirsən?',
    ex: [['Ja, ich fotografiere das Essen.', 'Bəli, yeməyin şəklini çəkirəm.'], ['Nein, ich fotografiere das Essen nicht.', 'Xeyr, yeməyin şəklini çəkmirəm.']],
    check: yesNo({ yes: /ich fotografiere (das essen|es)/, no: /ich fotografiere (das essen|es)( im restaurant)? nicht|ich fotografiere nicht$/, exYes: 'Ja, ich fotografiere das Essen.', exNo: 'Nein, ich fotografiere das Essen nicht.', extra: (n) => (/fotografiere nicht (das|es)/.test(n) ? '"nicht" cümlənin sonuna gəlir: "Ich fotografiere das Essen nicht."' : null) }),
  },
  {
    id: 'm7', type: 'me', q: 'Wie finden deine Freunde die Fotos?', az: 'Dostların şəkilləri necə hesab edir?',
    ex: [['Meine Freunde finden die Fotos toll.', 'Dostlarım şəkilləri əla hesab edir.'], ['Meine Freunde finden die Fotos nicht interessant.', 'Dostlarım şəkilləri maraqlı hesab etmir.']],
    check: opinion({ ok: new RegExp(`meine freunde finden (die fotos|sie) ${ADJ}`), ex: ['Meine Freunde finden die Fotos toll.'] }),
  },
  {
    id: 'm8', type: 'me', q: 'Wie findest du Food Blogging?', az: 'Food blogging-i necə hesab edirsən?',
    ex: [['Ich finde das toll!', 'Bunu əla hesab edirəm!'], ['Das nervt!', 'Bu, adamı əsəbiləşdirir!']],
    check: opinion({ ok: new RegExp(`ich finde (das|es|food blogging) ${ADJ}|das finde ich ${ADJ}|das nervt|das ist ${ADJ}`), ex: ['Ich finde das toll!', 'Das nervt!'] }),
  },
  {
    id: 'm9', type: 'me', q: 'Wie findest du Telefonieren im Restaurant?', az: 'Restoranda telefonla danışmağı necə hesab edirsən?',
    ex: [['Das nervt!', 'Bu, adamı əsəbiləşdirir!'], ['Ich finde das nicht gut.', 'Bunu yaxşı hesab etmirəm.']],
    check: opinion({ ok: new RegExp(`ich finde (das|es|telefonieren( im restaurant)?) ${ADJ}|das finde ich ${ADJ}|das nervt|das ist ${ADJ}`), ex: ['Das nervt!', 'Ich finde das nicht gut.'] }),
  },
];
// pro oder kontra sualları
PRO.forEach(([s, val, az], i) => {
  QUESTIONS.push({
    id: `p${i + 1}`, type: 'pro', q: `„${s}" — Ist das pro oder kontra?`, say: `${s} … Ist das pro oder kontra?`, az: `"${az}" — müsbət (pro), yoxsa mənfi (kontra)?`,
    ex: [[val === 'pro' ? 'Pro.' : 'Kontra.', val === 'pro' ? 'Müsbət (+).' : 'Mənfi (−).']],
    check: (t) => {
      const p = has(t, /\bpro\b|\bplus\b|\bpositiv/), k = has(t, /\b(kontra|contra|kontr|minus|negativ)/);
      const got = p && !k ? 'pro' : k && !p ? 'kontra' : null;
      if (got === val) return { ok: true };
      if (!got) return { ok: false, az: 'Cavab ver: "Pro." (müsbət, +) və ya "Kontra." (mənfi, −).' };
      return { ok: false, az: `"${s}" — ${az} Bu ${val === 'pro' ? 'müsbət fikirdir: "Pro."' : 'mənfi fikirdir: "Kontra."'}` };
    },
  });
});
export const byId = (id) => QUESTIONS.find((x) => x.id === id);
export const TYPES = { text: '📖 Mətndən', pro: '➕➖ Pro oder kontra?', me: '💬 Sənin fikrin' };

// Tur: 9 mətn sualı + 4 pro/kontra + 9 fikir; hər hissə daxilində qarışıq, hissələr növbələşir
export function newRound(rnd = Math.random) {
  const sh = (a) => {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const text = sh(QUESTIONS.filter((x) => x.type === 'text').map((x) => x.id));
  const pro = sh(QUESTIONS.filter((x) => x.type === 'pro').map((x) => x.id)).slice(0, 4);
  const me = sh(QUESTIONS.filter((x) => x.type === 'me').map((x) => x.id));
  // əvvəl mətni dinlə → mətn sualları; sonra pro/kontra və fikir sualları qarışıq
  const rest = sh([...pro, ...me]);
  return [...text, ...rest];
}
