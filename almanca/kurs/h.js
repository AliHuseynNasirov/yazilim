// Çalışma yazmaq üçün qısa köməkçilər. Variantlarda HƏMİŞƏ BİRİNCİ variant düzgündür (ekranda qarışdırılır).
export const mc = (q, opts, ex) => ({ t: 'mc', q, opts, ex }); // seç
export const gap = (q, a, ex) => ({ t: 'gap', q, a: [].concat(a), ex }); // boşluğu yaz: "Ich ___ aus Baku. (kommen)"
export const ord = (s, az, ...alts) => ({ t: 'ord', s, az, alts }); // sözləri sırala
export const tr = (az, ...a) => ({ t: 'tr', az, a }); // az → de yaz
export const dict = (de, ...alts) => ({ t: 'dict', de, alts }); // eşitdiyini yaz
export const lmc = (say, q, opts, ex) => ({ t: 'lmc', say, q, opts, ex }); // dinlə və seç (say: mətn və ya sətirlər)
export const wr = (task, must, model) => ({ t: 'wr', task, must, model }); // sərbəst yazı
export const rep = (de, az) => ({ t: 'rep', de, az }); // dinlə və təkrar et
export const pair = (say, other) => ({ t: 'pair', say, other }); // iki oxşar sözdən hansını eşitdin
export const g = (name, w) => ({ g: name, w }); // söz qrupu
