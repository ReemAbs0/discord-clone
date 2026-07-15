import { useEffect, useState } from "react";

// FR-028: "speaking" is derived client-locally from the audio each client
// already has (research.md §5) — never round-tripped through Convex. Gated by
// `active` (the participant's micOn) so a muted tile never lights up.
export function useSpeakingDetection(stream: MediaStream | null, active: boolean): boolean {
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    if (!stream || !active || stream.getAudioTracks().length === 0) {
      // Reset when the input becomes inactive (mic off / stream gone). Runs
      // only on a stream/active change, not every render — no cascade.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSpeaking(false);
      return;
    }
    if (typeof window.AudioContext === "undefined") return;

    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);

    const SPEAKING_THRESHOLD = 20; // average byte magnitude across the spectrum
    let raf = 0;
    let last = false;

    const tick = () => {
      analyser.getByteFrequencyData(data);
      let sum = 0;
      for (const value of data) sum += value;
      const isSpeaking = sum / data.length > SPEAKING_THRESHOLD;
      if (isSpeaking !== last) {
        last = isSpeaking;
        setSpeaking(isSpeaking);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      source.disconnect();
      void audioContext.close();
    };
  }, [stream, active]);

  return speaking;
}
