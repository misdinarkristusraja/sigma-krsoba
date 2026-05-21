// Mapping wilayah → lingkungan untuk Paroki Kristus Raja Solo Baru

export const WILAYAH_MAP: Record<string, string[]> = {
  'Thomas Aquino': [
    'Albertus Magnus',
    'Martinus',
    'Vincentius de Paul',
  ],
  'Matias Rasul': [
    'Yohanes Paulus II',
    'Fransiskus Asisi',
    'Dominikus',
    'Fransiskus de Sales',
  ],
  'Thomas Rasul': [
    'Benediktus Puri Gading',
    'Fransiskus Borgia',
    'Fransiskus de Paola',
    'Fransiskus Xaverius',
  ],
  'Filipus Rasul': [
    'Anna',
    'Yusup',
    'Barnabas',
    'Antonius Padua',
    'Paulus',
  ],
  'Yakobus Rasul': [
    'Angela',
    'Elisabeth',
    'Veronika Solo Baru',
  ],
  'Maria': [
    'Petrus Teplok',
    'Mateus Mancasan',
    'Simon Petrus Tembolan',
  ],
  'Yosef': [
    'Yulius Papringan',
    'Thomas Klampisan',
    'Veronika Gedongan',
    'Benediktus Baki',
  ],
};

export const WILAYAH_LIST = Object.keys(WILAYAH_MAP);

export const LINGKUNGAN_LIST = Object.values(WILAYAH_MAP).flat().sort((a, b) => a.localeCompare(b));

/** Given a lingkungan name, return its wilayah. */
export function getWilayah(lingkungan: string): string {
  for (const [w, list] of Object.entries(WILAYAH_MAP)) {
    if (list.includes(lingkungan)) return w;
  }
  return '';
}
