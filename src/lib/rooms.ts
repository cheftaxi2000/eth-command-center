/**
 * ETH room codes ("HG E 3", "ETA F 5", "ML J 34.3", "ETF E1") -> official ETH location page.
 * URL pattern verified against ethz.ch ("Standortinformationen LEE C 114 | ETH Zürich").
 */
export interface RoomParts {
  building: string;
  floor: string;
  room: string;
}

export function parseRoom(code: string): RoomParts | null {
  const m = code.trim().match(/^([A-Z]{1,4})\s*([A-Z])\s*(\d+(?:\.\d+)?)$/);
  return m ? { building: m[1], floor: m[2], room: m[3] } : null;
}

export function roomUrl(code: string): string | null {
  const p = parseRoom(code);
  if (!p) return null;
  const q = new URLSearchParams({ building: p.building, floor: p.floor, room: p.room, lang: 'de' });
  return `https://ethz.ch/de/utils/location.html?${q}`;
}
