let video = null;
let canvas = null;
let stream = null;
let facingMode = 'environment';

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
  // store last blob for save
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

window.addEventListener('load', async () => {
  document.getElementById('captureBtn').addEventListener('click', onCaptureClick);
  document.getElementById('saveBtn').addEventListener('click', onSaveClick);
  document.getElementById('switchBtn').addEventListener('click', onSwitchClick);
  await startCamera();
  registerSW();
});

window.addEventListener('beforeunload', () => stopCamera());
