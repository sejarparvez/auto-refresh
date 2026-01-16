let ctx: AudioContext | null = null;

export function playBeep(freq = 800, duration = 120): void {
	try {
		ctx ??= new AudioContext();
		const osc = ctx.createOscillator();
		const gain = ctx.createGain();
		osc.type = "sine";
		osc.frequency.value = freq;
		gain.gain.setValueAtTime(0.3, ctx.currentTime);
		gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration / 1000);
		osc.connect(gain).connect(ctx.destination);
		osc.start();
		osc.stop(ctx.currentTime + duration / 1000);
	} catch {
		// Audio not available
	}
}
