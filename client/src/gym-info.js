import { esc } from './ui/html.js';
import { ic } from './ui/icons.js';
import { openModal } from './ui/modal.js';

/* ===== GYM INFO — the owner fills this in. Empty optional fields (landmark, mapUrl, telegram, instagram) are simply not shown.
   Texts here are shown exactly as written (never auto-translated). hours = [['day(s)', 'time'], ...] ===== */
export const GYM_INFO = {
  address: "Namangan viloyati, Norin tumani, Haqqulobod shahri, Sirmak MFY, O'zbekiston ko'chasi, 3A-uy",   // street address
  landmark: '«Uztex Norin» yonida',                   // optional (shown under the address)
  mapUrl: '',                                         // optional, link to the map (Google / Yandex Maps)
  hours: [['Dushanba – Shanba', '14:30–24:00'], ['Yakshanba', 'Dam olish kuni']],
  phone: '+998 95 760 50 30',
  telegram: 'https://t.me/beksportklubi',             // optional, full link
  instagram: 'https://instagram.com/bek_gym1'         // optional, full link
};
export function aboutGym() {
  var g = GYM_INFO;
  function row(icon, cap, inner) { return '<div class="about-row">' + ic(icon) + '<div style="min-width:0"><div class="cap">' + cap + '</div>' + inner + '</div></div>'; }
  function safeUrl(u) { return /^https?:\/\//i.test(u) ? esc(u) : ''; }
  var h = '';
  h += row('pin', 'Address', '<div class="val" data-notr>' + esc(g.address) + '</div>' + (g.landmark ? '<div class="sub" data-notr>' + esc(g.landmark) + '</div>' : '') +
    (g.mapUrl && safeUrl(g.mapUrl) ? '<div><a href="' + safeUrl(g.mapUrl) + '" target="_blank" rel="noopener">Show on map</a></div>' : ''));
  if (g.hours && g.hours.length) h += row('clock', 'Working hours', '<table class="about-hours val" data-notr>' + g.hours.map(function (r) { return '<tr><td>' + esc(r[0]) + '</td><td>' + esc(r[1]) + '</td></tr>'; }).join('') + '</table>');
  if (g.phone) h += row('phone', 'Phone', '<div class="val" data-notr><a href="tel:' + esc(String(g.phone).replace(/[^+\d]/g, '')) + '">' + esc(g.phone) + '</a></div>');
  [['Telegram', g.telegram], ['Instagram', g.instagram]].forEach(function (s) {
    if (s[1] && safeUrl(s[1])) h += row('link', s[0], '<div class="val" data-notr><a href="' + safeUrl(s[1]) + '" target="_blank" rel="noopener">' + esc(s[1].replace(/^https?:\/\/(www\.)?/i, '')) + '</a></div>');
  });
  openModal({ title: 'About the gym', body: h, info: true });
}
