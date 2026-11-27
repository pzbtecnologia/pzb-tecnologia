'use strict';

const sounds = {
  petisco: [[0, .19, 245], [.25, .21, 270]],
  passeio: [[0, .21, 202], [.27, .19, 234], [.5, .24, 255]],
  brincadeira: [[0, .15, 290], [.21, .16, 320], [.43, .22, 278]],
  descanso: [[0, .29, 145]],
  visita: [[0, .29, 168], [.36, .3, 154]],
};

const scenarios = document.querySelectorAll('[data-scenario]');
const repeat = document.querySelector('#repetir');
const wave = document.querySelector('.wave');
const status = document.querySelector('#status');
const shareStatus = document.querySelector('#share-status');
const shareBox = document.querySelector('#share-box');
const shareUrl = document.querySelector('#share-url');
const buffers = new Map();
let audio;
let source;
let last;
let playbackRequest = 0;
let shareRequest = 0;

for (let i = 0; i < 40; i++) {
  const bar = document.createElement('span');
  bar.style.setProperty('--bar', `${8 + (i * 17 % 33)}px`);
  bar.style.setProperty('--delay', `${-(i % 8) * 40}ms`);
  wave.append(bar);
}

function makeSound(key) {
  const rate = audio.sampleRate;
  const notes = sounds[key];
  const buffer = audio.createBuffer(1, Math.ceil((notes.at(-1)[0] + notes.at(-1)[1] + .07) * rate), rate);
  const samples = buffer.getChannelData(0);
  for (const [offset, duration, pitch] of notes) {
    let phase = 0;
    let seed = 143721;
    let lowNoise = 0;
    for (let i = 0; i < Math.floor(duration * rate); i++) {
      const t = i / rate;
      const progress = t / duration;
      const envelope = Math.min(1, t / .012) * (1 - progress) ** 1.55;
      phase += 2 * Math.PI * pitch * (1 + .34 * Math.sin(progress * Math.PI) - .47 * progress) / rate;
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const noise = seed / 2147483648 - 1;
      lowNoise += .12 * (noise - lowNoise);
      const voice = .54 * Math.sin(phase) + .24 * Math.sin(phase * 2) + .14 * Math.sin(phase * 3);
      samples[Math.floor(offset * rate) + i] = envelope * (voice * (.86 + .14 * Math.sin(t * 180)) + .44 * lowNoise) * .57;
    }
  }
  return buffer;
}

function stop() {
  if (source) {
    source.onended = null;
    source.stop();
    source.disconnect();
    source = null;
  }
  wave.classList.remove('playing');
}

async function play(choice) {
  const request = ++playbackRequest;
  stop();
  try {
    const AudioEngine = window.AudioContext || window.webkitAudioContext;
    audio ??= new AudioEngine();
    if (audio.state !== 'running') await audio.resume();
    if (request !== playbackRequest) return;
    if (!buffers.has(choice.key)) buffers.set(choice.key, makeSound(choice.key));
    const next = audio.createBufferSource();
    next.buffer = buffers.get(choice.key);
    next.connect(audio.destination);
    next.onended = () => {
      next.disconnect();
      source = null;
      wave.classList.remove('playing');
    };
    next.start();
    source = next;
    last = choice;
    repeat.disabled = false;
    status.textContent = 'Latido: ' + choice.label;
    wave.classList.add('playing');
  } catch {
    if (request === playbackRequest) status.textContent = 'Não foi possível tocar o áudio. Tente novamente.';
  }
}

for (const button of scenarios) {
  button.addEventListener('click', () => {
    void play({ key: button.dataset.scenario, label: button.textContent });
  });
}
repeat.addEventListener('click', () => {
  if (last) void play(last);
});
document.querySelector('#recomecar').addEventListener('click', () => {
  playbackRequest++;
  stop();
  last = null;
  repeat.disabled = true;
  status.textContent = '';
  shareStatus.textContent = '';
  shareBox.hidden = true;
  shareRequest++;
  scenarios[0].focus();
});

document.querySelector('#compartilhar').addEventListener('click', async () => {
  const request = ++shareRequest;
  shareStatus.textContent = '';
  shareBox.hidden = true;
  if (location.protocol !== 'https:' || ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) {
    shareStatus.textContent = 'O compartilhamento estará disponível no endereço público do LateDog.';
    return;
  }
  const url = new URL(location.pathname, location.origin).href;
  try {
    if (navigator.share) {
      await navigator.share({ title: 'LateDog | Pzb Play', url });
      return;
    }
  } catch (error) {
    if (request !== shareRequest || error.name === 'AbortError') return;
  }
  try {
    await navigator.clipboard.writeText(url);
    if (request === shareRequest) shareStatus.textContent = 'Link do LateDog copiado.';
  } catch {
    if (request !== shareRequest) return;
    shareBox.hidden = false;
    shareUrl.value = url;
    shareUrl.select();
  }
});
