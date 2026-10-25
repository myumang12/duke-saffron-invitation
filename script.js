
'use strict';

const $ = (id) => document.getElementById(id);

// Invitation opening
const openBtn = $('openInvite');

openBtn.addEventListener('click', () => {
  $('cover').classList.add('is-open');
  document.body.classList.remove('locked');

  setTimeout(() => {
    $('cover').hidden = true;
  }, 950);
});

$('joinButton').addEventListener('click', () => {
  $('registration').hidden = false;
  $('registration').scrollIntoView({ behavior: 'smooth' });
});

// Countdown
const target = new Date('2026-11-21T10:00:00+08:00').getTime();

function tick() {
  const diff = Math.max(0, target - Date.now());
  const values = [
    Math.floor(diff / 86400000),
    Math.floor(diff / 3600000) % 24,
    Math.floor(diff / 60000) % 60,
    Math.floor(diff / 1000) % 60
  ];

  ['days', 'hours', 'minutes', 'seconds'].forEach((id, i) => {
    $(id).textContent = String(values[i]).padStart(2, '0');
  });

  if (!diff) {
    $('countdownMessage').textContent =
      'The royal day has arrived!';
  }
}

tick();
setInterval(tick, 1000);

// Optional music
const ENABLE_MUSIC = false;
let audio = null;

if (ENABLE_MUSIC) {
  const toggle = $('musicToggle');
  toggle.hidden = false;

  audio = new Audio('assets/music.mp3');
  audio.loop = true;

  toggle.addEventListener('click', async () => {
    if (audio.paused) {
      try {
        await audio.play();
        toggle.textContent = '♫ Music: On';
      } catch {
        toggle.textContent = '♫ Tap to play';
      }
    } else {
      audio.pause();
      toggle.textContent = '♫ Music: Off';
    }
  });

  openBtn.addEventListener('click', () => {
    audio.play()
      .then(() => toggle.textContent = '♫ Music: On')
      .catch(() => {});
  });
}

// Royal Circle registration
const form = $('pledgeForm');
let pending = null;

function status(message) {
  $('formStatus').textContent = message;
}

function endpointUrl() {
  const url = (window.DUKE_CONFIG?.appsScriptUrl || '').trim();

  if (!/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(url)) {
    return null;
  }

  return url;
}

function createRequestId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return String(Date.now()) + '-' +
    Math.random().toString(36).slice(2);
}

// Check status using a JSONP script request.
// No iframe messaging or CORS response reading required.
function checkRegistration(endpoint, requestId) {
  return new Promise((resolve, reject) => {
    const callbackName =
      'dukeStatus_' +
      Math.random().toString(36).slice(2);

    const script = document.createElement('script');
    let finished = false;

    const cleanup = () => {
      clearTimeout(timer);
      script.remove();
      delete window[callbackName];
    };

    const finish = (error, result) => {
      if (finished) return;
      finished = true;
      cleanup();

      if (error) reject(error);
      else resolve(result);
    };

    window[callbackName] = (result) => {
      finish(null, result);
    };

    const timer = setTimeout(() => {
      finish(new Error('Status check timed out.'));
    }, 10000);

    script.onerror = () => {
      finish(new Error('Status service could not be reached.'));
    };

    const url = new URL(endpoint);
    url.searchParams.set('action', 'status');
    url.searchParams.set('requestId', requestId);
    url.searchParams.set('callback', callbackName);
    url.searchParams.set('_', String(Date.now()));

    script.src = url.toString();
    document.head.appendChild(script);
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForRegistration(endpoint, requestId) {
  const deadline = Date.now() + 65000;

  while (Date.now() < deadline) {
    try {
      const result = await checkRegistration(endpoint, requestId);

      if (result && result.ok && result.status === 'ISSUED') {
        return result;
      }

      if (result && result.ok === false) {
        throw new Error(result.error || 'Status check failed.');
      }
    } catch (error) {
      // Temporary network errors can happen during processing.
      // Keep checking until the overall deadline.
      console.warn('Royal Circle status check:', error.message);
    }

    await sleep(2500);
  }

  return null;
}

function submitToAppsScript(endpoint, data) {
  const iframe = document.createElement('iframe');
  iframe.name = 'duke-submit-' + Date.now();
  iframe.style.display = 'none';
  iframe.title = 'Royal Circle registration submission';
  document.body.appendChild(iframe);

  const sender = document.createElement('form');
  sender.method = 'POST';
  sender.action = endpoint;
  sender.target = iframe.name;
  sender.style.display = 'none';

  for (const [key, value] of Object.entries(data)) {
    const input = document.createElement('input');
    input.name = key;
    input.value = value;
    sender.appendChild(input);
  }

  document.body.appendChild(sender);
  sender.submit();
  sender.remove();

  // Leave enough time for the backend to finish its work.
  // The status polling is independent of this iframe.
  setTimeout(() => iframe.remove(), 90000);
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (pending) return;

  const endpoint = endpointUrl();

  if (!endpoint) {
    status(
      'Registration is not connected. No information was saved.'
    );
    return;
  }

  const name = $('guardianName').value.trim();
  const promise = $('promise').value;
  const message = $('message').value.trim();

  if (!name || !promise || !$('consent').checked) {
    status('Please complete the required fields.');
    return;
  }

  const fingerprint = JSON.stringify({
    name,
    promise,
    message
  });

  // Reuse the same ID when retrying an unconfirmed submission.
  const previous = window.dukeRetry;

  const requestId =
    previous?.fingerprint === fingerprint
      ? previous.requestId
      : createRequestId();

  window.dukeRetry = { fingerprint, requestId };

  pending = { requestId, name };
  $('submitPledge').disabled = true;

  status('Sending your royal promise…');

  try {
    submitToAppsScript(endpoint, {
      requestId,
      name,
      promise,
      message,
      consent: 'yes'
    });

    status(
      'Your promise has been sent. Checking the Royal Registry…'
    );

    const result = await waitForRegistration(endpoint, requestId);

    if (result && result.status === 'ISSUED') {
      window.dukeRetry = null;

      renderCertificate(
        name,
        result.reference || '',
        result.date || new Date().toISOString().slice(0, 10)
      );

      form.reset();

      $('certificateSection').hidden = false;
      $('certificateSection').scrollIntoView({
        behavior: 'smooth'
      });

      status(
        'Your royal promise is registered! Your certificate is ready below.'
      );
    } else {
      status(
        'Your submission could not be confirmed yet. ' +
        'Please check with the family before retrying. ' +
        'Do not submit a second registration.'
      );
    }
  } catch (error) {
    console.error('Royal Circle submission:', error);

    status(
      'We could not confirm your registration. ' +
      'Please check with the family before trying again.'
    );
  } finally {
    pending = null;
    $('submitPledge').disabled = false;
  }
});

// Personalized downloadable PNG certificate
function renderCertificate(name, reference, date) {
  const canvas = $('certificateCanvas');
  const ctx = canvas.getContext('2d');

  const w = canvas.width;
  const h = canvas.height;

  ctx.fillStyle = '#faf8f0';
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = '#c5a46d';
  ctx.lineWidth = 7;
  ctx.strokeRect(40, 40, w - 80, h - 80);

  ctx.lineWidth = 2;
  ctx.strokeRect(59, 59, w - 118, h - 118);

  ctx.fillStyle = '#425d48';
  ctx.textAlign = 'center';
  ctx.font = '84px Georgia';
  ctx.fillText('♛', w / 2, 185);

  ctx.fillStyle = '#7b9076';
  ctx.font = 'bold 25px Georgia';
  ctx.fillText(
    'THE ROYAL HOUSEHOLD OF DUKE SAFFRON',
    w / 2, 250
  );

  ctx.fillStyle = '#425d48';
  ctx.font = '74px Georgia';
  ctx.fillText(
    'Certificate of Royal Affection',
    w / 2, 360
  );

  ctx.font = '30px Georgia';
  ctx.fillText(
    'This certificate is joyfully presented to',
    w / 2, 440
  );

  ctx.font = 'italic 66px Georgia';

  const safeName =
    name.length > 38 ? name.slice(0, 38) + '…' : name;

  ctx.fillText(safeName, w / 2, 530);

  ctx.fillStyle = '#c5a46d';
  ctx.fillRect(480, 564, 640, 3);

  ctx.fillStyle = '#425d48';
  ctx.font = 'bold 45px Georgia';
  ctx.fillText(
    'ROYAL GUARDIAN OF LOVE',
    w / 2, 645
  );

  ctx.font = '30px Georgia';
  ctx.fillText(
    'of Duke Saffron M. Yumang',
    w / 2, 705
  );

  ctx.font = '27px Georgia';
  ctx.fillText(
    'In grateful recognition of your promise to offer',
    w / 2, 780
  );
  ctx.fillText(
    'love, kindness, guidance, and encouragement as Duke grows.',
    w / 2, 825
  );

  ctx.font = 'italic 31px Georgia';
  ctx.fillText(
    'A promise made with love. A bond treasured for life.',
    w / 2, 890
  );

  ctx.font = '21px Georgia';
  ctx.fillStyle = '#71806c';
  ctx.fillText(
    'Registered ' + date + '   ·   ' + reference,
    w / 2, 961
  );

  ctx.font = '18px Georgia';
  ctx.fillText(
    'Commemorative keepsake only — not an official church godparent appointment',
    w / 2, 1006
  );
}

$('downloadCertificate').addEventListener('click', () => {
  const link = document.createElement('a');

  link.download =
    'Duke-Saffron-Royal-Guardian-Certificate.png';

  link.href = $('certificateCanvas').toDataURL('image/png');
  link.click();
});
