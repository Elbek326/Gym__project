import G from '../core/gym.js';

/* ----- photo upload: shrink to a 320px JPEG so it fits inside the member record ----- */
export function readImage(file) {
  return new Promise(function (res, rej) {
    if (!file || !/^image\//.test(file.type)) return rej(new G.AppError('Choose an image file.'));
    var fr = new FileReader();
    fr.onerror = function () { rej(new G.AppError('The photo could not be read.')); };
    fr.onload = function () {
      var img = new Image();
      img.onerror = function () { rej(new G.AppError('The photo could not be read.')); };
      img.onload = function () {
        var M = 320, k = Math.min(1, M / Math.max(img.width, img.height));
        var c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
        var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
        res(c.toDataURL('image/jpeg', 0.82));
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}

