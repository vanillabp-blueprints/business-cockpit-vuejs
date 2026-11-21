function toChannels(hexColor: string): [number, number, number] {
  const digits = hexColor.replace('#', '');
  return [0, 2, 4].map((start) => parseInt(digits.slice(start, start + 2), 16)) as [number, number, number];
}

/** Lays `shareOfTop` (0 to 1) of one colour over another, as a hex colour. */
export function mixColors(topColor: string, shareOfTop: number, bottomColor: string): string {
  const top = toChannels(topColor);
  const bottom = toChannels(bottomColor);
  const mixed = top.map((channel, index) => Math.round(channel * shareOfTop + bottom[index] * (1 - shareOfTop)));
  return '#' + mixed.map((channel) => channel.toString(16).padStart(2, '0')).join('').toUpperCase();
}
