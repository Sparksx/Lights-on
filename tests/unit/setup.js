// === Test Setup — jsdom environment bootstrap ===

// Mock localStorage
const store = {};
const localStorageMock = {
  getItem: (key) => store[key] ?? null,
  setItem: (key, value) => { store[key] = String(value); },
  removeItem: (key) => { delete store[key]; },
  clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
};
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

// Mock canvas
HTMLCanvasElement.prototype.getContext = function () {
  return {
    fillRect: () => {},
    clearRect: () => {},
    beginPath: () => {},
    arc: () => {},
    fill: () => {},
    stroke: () => {},
    moveTo: () => {},
    lineTo: () => {},
    closePath: () => {},
    save: () => {},
    restore: () => {},
    translate: () => {},
    rotate: () => {},
    scale: () => {},
    createRadialGradient: () => ({
      addColorStop: () => {},
    }),
    createLinearGradient: () => ({
      addColorStop: () => {},
    }),
    measureText: () => ({ width: 0 }),
    fillText: () => {},
    strokeText: () => {},
    drawImage: () => {},
    canvas: { width: 800, height: 600 },
  };
};

// Mock requestAnimationFrame
globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);

// Reset localStorage between tests
afterEach(() => {
  localStorageMock.clear();
});
