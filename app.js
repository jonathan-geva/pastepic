(() => {
  'use strict';

  const dom = {
    ctrl: document.getElementById('keyCtrl'),
    v: document.getElementById('keyV'),
    keys: document.getElementById('keys'),
    pick: document.getElementById('pickBtn'),
    input: document.getElementById('fileInput'),
    drop: document.getElementById('drop'),
    fx: document.getElementById('fx'),
    fxImg: document.getElementById('fxImg'),
    toast: document.getElementById('toast'),
  };

  const EXT = {
    'image/jpeg': 'jpg',
    'image/svg+xml': 'svg',
    'image/tiff': 'tif',
    'image/x-icon': 'ico',
    'image/vnd.microsoft.icon': 'ico',
  };

  let armed = false;
  let armedTimer = 0;
  let toastTimer = 0;
  let fxOutTimer = 0;
  let fxEndTimer = 0;
  let fxToastTimer = 0;
  let dragDepth = 0;

  const pad = (n) => String(n).padStart(2, '0');

  function stamp(ext) {
    const d = new Date();
    return (
      'pastepic-' +
      d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' +
      pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds()) +
      '.' + ext
    );
  }

  function extFor(type) {
    if (EXT[type]) return EXT[type];
    const sub = String(type || '').split('/')[1] || 'png';
    return sub.replace(/\+xml$/i, '').replace(/[^a-z0-9]/gi, '') || 'png';
  }

  function humanSize(bytes) {
    if (typeof bytes !== 'number' || !isFinite(bytes)) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(bytes < 10240 ? 1 : 0) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }

  function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  /* ---------- feedback ---------- */

  function showToast(message, meta, warn) {
    dom.toast.textContent = '';
    const dot = document.createElement('i');
    const text = document.createElement('span');
    text.textContent = message;
    dom.toast.appendChild(dot);
    dom.toast.appendChild(text);
    if (meta) {
      const m = document.createElement('span');
      m.className = 'toast__meta';
      m.textContent = meta;
      dom.toast.appendChild(m);
    }
    dom.toast.classList.toggle('is-warn', Boolean(warn));
    dom.toast.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => dom.toast.classList.remove('is-on'), 3600);
  }

  function flashError() {
    dom.keys.classList.remove('is-error');
    void dom.keys.offsetWidth;
    dom.keys.classList.add('is-error');
    setTimeout(() => dom.keys.classList.remove('is-error'), 500);
  }

  function press(key, ms) {
    key.classList.add('is-down');
    clearTimeout(key._pressTimer);
    key._pressTimer = setTimeout(() => key.classList.remove('is-down'), ms || 170);
  }

  function armCtrl(on) {
    armed = on;
    dom.ctrl.classList.toggle('is-armed', on);
    dom.ctrl.setAttribute('aria-pressed', String(on));
    clearTimeout(armedTimer);
    if (on) armedTimer = setTimeout(() => armCtrl(false), 5000);
  }

  /* ---------- the download animation ---------- */

  function playFx(blob, name, size, count) {
    if (!blob) return;

    clearTimeout(fxOutTimer);
    clearTimeout(fxEndTimer);
    clearTimeout(fxToastTimer);

    const url = URL.createObjectURL(blob);
    dom.fx.classList.remove('is-on', 'is-out');
    dom.fxImg.src = url;
    void dom.fx.offsetWidth;
    dom.fx.classList.add('is-on');

    fxToastTimer = setTimeout(() => {
      const more = count > 1 ? ' +' + (count - 1) + ' more' : '';
      showToast('Downloaded', name + more + ' · ' + humanSize(size));
    }, 1320);

    fxOutTimer = setTimeout(() => dom.fx.classList.add('is-out'), 1780);

    fxEndTimer = setTimeout(() => {
      dom.fx.classList.remove('is-on', 'is-out');
      dom.fxImg.removeAttribute('src');
      URL.revokeObjectURL(url);
    }, 2120);
  }

  /* ---------- handling images ---------- */

  function deliver(items) {
    if (!items.length) {
      showToast('Nothing to save', 'no image found', true);
      flashError();
      return;
    }
    items.forEach((item) => download(item.blob, item.name));
    armCtrl(false);
    playFx(items[0].blob, items[0].name, items[0].size, items.length);
  }

  function fromFiles(list, origin) {
    const images = Array.prototype.slice
      .call(list || [])
      .filter((file) => file && file.type && file.type.indexOf('image/') === 0);

    if (!images.length) {
      showToast('That is not an image', 'try png, jpg, gif or webp', true);
      flashError();
      return;
    }

    deliver(
      images.map((file) => ({
        blob: file,
        name:
          origin === 'clipboard'
            ? stamp(extFor(file.type))
            : file.name || stamp(extFor(file.type)),
        size: file.size,
      }))
    );
  }

  /* ---------- paste ---------- */

  window.addEventListener('paste', (event) => {
    const data = event.clipboardData;
    if (!data) return;

    const files = [];
    for (const item of data.items || []) {
      if (item.kind === 'file' && item.type.indexOf('image/') === 0) {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }
    if (!files.length) return;

    event.preventDefault();
    press(dom.ctrl, 220);
    press(dom.v, 220);
    fromFiles(files, 'clipboard');
  });

  /* ---------- drag & drop ---------- */

  function hasFiles(event) {
    const dt = event.dataTransfer;
    if (!dt) return false;
    const types = dt.types || [];
    for (const type of types) if (type === 'Files') return true;
    return false;
  }

  window.addEventListener('dragenter', (event) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    dragDepth += 1;
    dom.drop.classList.add('is-on');
  });

  window.addEventListener('dragover', (event) => {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = hasFiles(event) ? 'copy' : 'none';
  });

  window.addEventListener('dragleave', () => {
    if (dragDepth <= 0) return;
    dragDepth -= 1;
    if (dragDepth === 0) dom.drop.classList.remove('is-on');
  });

  window.addEventListener('drop', (event) => {
    event.preventDefault();
    dragDepth = 0;
    dom.drop.classList.remove('is-on');
    const files = event.dataTransfer && event.dataTransfer.files;
    if (files && files.length) fromFiles(files, 'drop');
  });

  /* ---------- file picker ---------- */

  function openPicker() {
    dom.input.click();
  }

  dom.pick.addEventListener('click', openPicker);
  dom.input.addEventListener('change', () => {
    const files = Array.prototype.slice.call(dom.input.files || []);
    dom.input.value = '';
    fromFiles(files, 'pick');
  });

  /* ---------- keycaps ---------- */

  async function readClipboard() {
    if (!navigator.clipboard || typeof navigator.clipboard.read !== 'function') {
      openPicker();
      return;
    }
    try {
      const entries = await navigator.clipboard.read();
      for (const entry of entries) {
        const type = (entry.types || []).find((t) => t.indexOf('image/') === 0);
        if (!type) continue;
        const blob = await entry.getType(type);
        deliver([{ blob, name: stamp(extFor(blob.type || type)), size: blob.size }]);
        return;
      }
      showToast('No image on the clipboard', 'drop a file instead', true);
      flashError();
    } catch (error) {
      openPicker();
    }
  }

  dom.ctrl.addEventListener('click', () => {
    press(dom.ctrl, 160);
    armCtrl(!armed);
  });

  dom.v.addEventListener('click', () => {
    press(dom.v, 160);
    if (armed) armCtrl(false);
    readClipboard();
  });

  // The keycaps light up when the real keys are used.
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Control' || event.key === 'Meta') {
      dom.ctrl.classList.add('is-down');
      armCtrl(true);
      return;
    }
    if ((event.key === 'v' || event.key === 'V') && (event.ctrlKey || event.metaKey)) {
      press(dom.v, 240);
    }
  });

  window.addEventListener('keyup', (event) => {
    if (event.key === 'Control' || event.key === 'Meta') {
      dom.ctrl.classList.remove('is-down');
    }
  });

  window.addEventListener('blur', () => {
    dom.ctrl.classList.remove('is-down');
    dom.v.classList.remove('is-down');
    armCtrl(false);
  });

  // Cursor-following sheen on the caps.
  [dom.ctrl, dom.v].forEach((key) => {
    key.addEventListener('pointermove', (event) => {
      const rect = key.getBoundingClientRect();
      key.style.setProperty('--mx', ((event.clientX - rect.left) / rect.width) * 100 + '%');
      key.style.setProperty('--my', ((event.clientY - rect.top) / rect.height) * 100 + '%');
    });
  });
})();
