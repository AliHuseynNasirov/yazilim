# 🇩🇪 Deutsch A1.1 — Danış

Alman dilini A1.1 səviyyəsində öyrənmək üçün telefon tətbiqi (PWA).

- **11 kateqoriya, 13 dialoq**: tanışlıq, salamlaşma, rəqəmlər, ailə, kafe, alış-veriş, saat, hobbilər, yol, ev, sərbəst məşq
- Hər dialoqda: **nümunə dialoq** (tərcümə və səsləndirmə ilə), **qayda** (cədvəl və izahla), **lüğət**
- **Səsli məşq**: Gemini Live API (native audio) ilə müəllim rol oynayır, səhvlərini azərbaycanca izah edir

## Necə işə salmaq

1. Pulsuz Gemini API açarı al: https://aistudio.google.com/apikey
2. Saytı HTTPS ilə aç (mikrofon üçün HTTPS lazımdır). Ən asan yol — **GitHub Pages**:
   repo → Settings → Pages → Branch seç → Save. Sonra `https://<istifadəçi>.github.io/yazilim/almanca/` aç.
3. Tətbiqdə ⚙️ Ayarlar → API açarını yapışdır → Yadda saxla.
4. Telefonda brauzer menyusundan **"Ana ekrana əlavə et"** — tətbiq kimi açılacaq.

## Məsləhətlər

- Sərbəst rejimdə **qulaqlıq** istifadə et, yoxsa dinamikdən gələn səs müəllimin sözünü kəsə bilər. Qulaqlıq yoxdursa, ayarlarda **"Bas və danış"** rejimini seç.
- Bir sessiya təxminən 15 dəqiqə davam edir (API limiti).
- Model işləməsə (xəta 1008/1011), ayarlarda başqa model seç.
- API açarı yalnız telefonundakı brauzerdə saxlanılır. Açarı başqası ilə paylaşma.

## Yeni dialoq əlavə etmək

`data.js` faylında istənilən kateqoriyaya eyni formatda yeni obyekt əlavə et.
