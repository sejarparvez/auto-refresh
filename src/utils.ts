export const CIRC = 175.9;
export const MIN_INTERVAL = 60;
export const MAX_INTERVAL = 7200;
export const STEP = 30;

export function truncateTitle(title: string, maxLength = 30): string {
	if (title.length <= maxLength) return title;
	return `${title.slice(0, maxLength)}...`;
}

export function formatInterval(secs: number): string {
	if (secs >= 3600) {
		const h = Math.floor(secs / 3600);
		const m = Math.floor((secs % 3600) / 60);
		return m > 0 ? `${h}h ${m}m` : `${h}h`;
	}
	if (secs >= 60) return `${Math.round(secs / 60)}m`;
	return `${secs}s`;
}

export function formatRemaining(secs: number): string {
	if (secs >= 60) return `${Math.floor(secs / 60)}m ${secs % 60}s`;
	return `${secs}s`;
}

export function snapInterval(raw: number): number {
	const snapped = Math.round(raw / STEP) * STEP;
	return Math.max(MIN_INTERVAL, Math.min(MAX_INTERVAL, snapped));
}

export function computeRingOffset(rem: number, total: number): string {
	const pct = total > 0 ? Math.min(1, rem / total) : 0;
	return (CIRC * (1 - pct)).toFixed(1);
}

export function debounce<A extends unknown[]>(
	fn: (...args: A) => unknown,
	ms: number,
): (...args: A) => void {
	let timer: ReturnType<typeof setTimeout> | null = null;
	return ((...args: A) => {
		if (timer) clearTimeout(timer);
		timer = setTimeout(() => fn(...args), ms);
	}) as (...args: A) => void;
}
