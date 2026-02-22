let video = null;
let canvas = null;
let stream = null;
let facingMode = 'environment';
let refObjectUrl = null; // held separately so it's NEVER drawn to canvas

async function startCamera() {
  video = document.getElementById('video');
  canvas = document.getElementById('canvas');
  const constraints = { video: { facingMode }, audio: false };
  try {
    stream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = stream;
  } catch (err) {
    console.error('Camera start failed', err);
    alert('Camera access is required. Check permissions.');
  }
}

function stopCamera() {
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }
}

function takePhoto() {
  if (!video) return;
  const w = video.videoWidth;
  const h = video.videoHeight;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, w, h);
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob);
    }, 'image/jpeg', 0.95);
  });
}

async function saveBlob(blob) {
  const filename = `mipozy-${Date.now()}.jpg`;
  // Try Web Share (files) first (good on mobile Android/modern browsers)
  try {
    const file = new File([blob], filename, { type: blob.type });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Mipozy Photo' });
      return;
    }
  } catch (e) {
    // ignore and fallback to download
  }

  // Fallback: download via anchor
  const url = URL.createObjectURL(blob);
  const a = document.getElementById('downloadLink');
  a.href = url;
  a.download = filename;
  a.hidden = false;
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.hidden = true;
  }, 1000);
}

async function onCaptureClick() {
  const blob = await takePhoto();
  // auto-save immediately
  await saveBlob(blob);
  // show a quick preview by replacing video with captured frame briefly
  const previewUrl = URL.createObjectURL(blob);
  const prevVideo = document.getElementById('video');
  prevVideo.pause();
  prevVideo.srcObject = null;
  prevVideo.src = previewUrl;
  setTimeout(() => {
    prevVideo.src = '';
    prevVideo.srcObject = stream;
    prevVideo.play();
    URL.revokeObjectURL(previewUrl);
  }, 800);
  // store last blob in case user wants to re-save
  window._lastCapture = blob;
}

async function onSaveClick() {
  const blob = window._lastCapture;
  if (!blob) {
    alert('Take a picture first');
    return;
  }
  await saveBlob(blob);
}

async function onSwitchClick() {
  facingMode = (facingMode === 'environment') ? 'user' : 'environment';
  stopCamera();
  await startCamera();
}

function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js').catch(console.error);
  }
}

function setupRefImage() {
  const refUpload    = document.getElementById('refUpload');
  const refImg       = document.getElementById('refImg');
  const opacityRow   = document.getElementById('opacityRow');
  const opacitySlider = document.getElementById('opacitySlider');
  const clearRefBtn  = document.getElementById('clearRef');

  refUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (refObjectUrl) URL.revokeObjectURL(refObjectUrl);
    refObjectUrl = URL.createObjectURL(file);
    refImg.src = refObjectUrl;
    refImg.hidden = false;
    refImg.style.opacity = opacitySlider.value / 100;
    opacityRow.hidden = false;
    // reset input so same file can be re-picked
    e.target.value = '';
  });

  opacitySlider.addEventListener('input', () => {
    refImg.style.opacity = opacitySlider.value / 100;
  });

  clearRefBtn.addEventListener('click', () => {
    refImg.hidden = true;
    refImg.src = '';
    opacityRow.hidden = true;
    if (refObjectUrl) { URL.revokeObjectURL(refObjectUrl); refObjectUrl = null; }
  });
}

let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  document.getElementById('installBtn').hidden = false;
});

window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  document.getElementById('installBtn').hidden = true;
});

window.addEventListener('load', async () => {
  document.getElementById('captureBtn').addEventListener('click', onCaptureClick);
  document.getElementById('saveBtn').addEventListener('click', onSaveClick);
  document.getElementById('switchBtn').addEventListener('click', onSwitchClick);
  document.getElementById('installBtn').addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`User ${outcome} the install prompt`);
      deferredPrompt = null;
    }
  });
  setupRefImage();
  await startCamera();
  registerSW();
});

window.addEventListener('beforeunload', () => stopCamera());
