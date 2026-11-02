/**
 * A guilloche rosette (the fine engraved pattern of banknotes and certificates) as a small SVG document.
 * Each band is one curve drawn once and repeated by rotation (<use>), so the file stays small.
 */
export function guillocheSvg(stroke = '#c9a45c'): string {
  const C = 300;
  const curve = (R: number, a: number, k: number, n = 540) => {
    const pts: string[] = [];
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2;
      const r = R + a * Math.sin(k * t);
      pts.push(`${(C + r * Math.cos(t)).toFixed(1)} ${(C + r * Math.sin(t)).toFixed(1)}`);
    }
    return `M${pts.join('L')}Z`;
  };
  const bands = [
    { id: 'a', R: 248, a: 20, k: 40, copies: 8 },
    { id: 'b', R: 176, a: 24, k: 28, copies: 8 },
    { id: 'c', R: 108, a: 20, k: 18, copies: 6 },
  ];
  const defs = bands.map((b) => `<path id="${b.id}" d="${curve(b.R, b.a, b.k)}"/>`).join('');
  const uses = bands
    .map((b) =>
      Array.from({ length: b.copies }, (_, j) => {
        const deg = ((360 / b.k) * j) / b.copies;
        return `<use href="#${b.id}" transform="rotate(${deg.toFixed(3)} ${C} ${C})"/>`;
      }).join(''),
    )
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" fill="none" stroke="${stroke}" stroke-width=".55"><defs>${defs}</defs>${uses}<circle cx="300" cy="300" r="284" stroke-width=".8"/><circle cx="300" cy="300" r="291" stroke-width=".4"/><circle cx="300" cy="300" r="66"/><circle cx="300" cy="300" r="60" stroke-width=".4"/></svg>`;
}
