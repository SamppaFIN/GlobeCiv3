/** surfaceWorker.ts — computes the surface patterns off the main thread (surfacePatterns.ts). */
import { computePatterns } from './surfacePatterns';

self.onmessage = (e: MessageEvent<{ size: number }>) => {
  const t0 = performance.now();
  const patterns = computePatterns(e.data.size);
  (self as unknown as Worker).postMessage({ ...patterns, ms: performance.now() - t0 }, [patterns.data.buffer]);
};
