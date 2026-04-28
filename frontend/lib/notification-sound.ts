let audio: HTMLAudioElement | null = null;

function getAudio(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio("/notification.mp3");
    audio.volume = 0.7;
  }
  return audio;
}

export async function playNotificationSound(): Promise<void> {
  try {
    const a = getAudio();
    a.currentTime = 0;
    await a.play();
  } catch {
  }
}
