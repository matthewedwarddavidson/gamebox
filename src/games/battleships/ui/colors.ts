// Pastel colours for ships, keyed by their length. Gives the fleet a soft,
// varied look echoing the inboxes board, while staying distinct from the
// pastel-blue water.

export interface ShipColor {
  fill: string;
  stroke: string;
}

const PALETTE: Record<number, ShipColor> = {
  1: { fill: '#f6c9c2', stroke: '#d9887b' }, // coral
  2: { fill: '#f8dcb4', stroke: '#d9a663' }, // apricot
  3: { fill: '#d8e8ac', stroke: '#9cbc5f' }, // pear
  4: { fill: '#d7c7ed', stroke: '#9d85c9' }, // lavender
  5: { fill: '#f3c6d8', stroke: '#cf7ea0' }, // rose
};

function fallback(len: number): ShipColor {
  const hue = (len * 53 + 20) % 360;
  return { fill: `hsl(${hue} 60% 82%)`, stroke: `hsl(${hue} 45% 58%)` };
}

export function colorForLength(len: number): ShipColor {
  return PALETTE[len] ?? fallback(len);
}
