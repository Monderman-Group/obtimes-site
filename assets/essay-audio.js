/* A small enhancement to the native audio controls; no autoplay or tracking. */
document.querySelectorAll('[data-essay-audio]').forEach(section => {
  const audio = section.querySelector('audio');
  const speed = section.querySelector('[data-audio-speed]');
  const error = section.querySelector('[data-audio-error]');
  if (!audio || !speed) return;
  speed.addEventListener('change', () => {
    const rate = Number(speed.value);
    if (Number.isFinite(rate) && rate >= 0.75 && rate <= 2) audio.playbackRate = rate;
  });
  audio.addEventListener('ratechange', () => {
    const rate = String(audio.playbackRate);
    if ([...speed.options].some(option => option.value === rate)) speed.value = rate;
  });
  const showError = () => { if (error) error.hidden = false; };
  audio.addEventListener('error', showError);
  audio.querySelector('source')?.addEventListener('error', showError);
  audio.addEventListener('loadeddata', () => { if (error) error.hidden = true; });
});
