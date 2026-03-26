export interface Tender {
  id: string;
  title: string;
  description: string;
  contracting_authority: string;
  published_date: string;
  deadline: string | null;
  estimated_value: number | null;
  currency: string;
  cpv_codes: string[];
  cpv_descriptions: string[];
  region: string;
  bundesland: string | null;
  source_platform: string;
  source_url: string;
  tender_type: string;
  keywords_matched: string[];
}

export interface FilterState {
  keywords: string[];
  cpv_codes: string[];
  min_value: number | null;
  max_value: number | null;
  bundeslaender: string[];
  platforms: string[];
  date_from: string | null;
  show_today_only: boolean;
}

export interface Platform {
  id: string;
  name: string;
  url: string;
  type: 'api' | 'rss';
  active: boolean;
  last_fetched: string | null;
  tender_count: number;
}

export const BUNDESLAENDER = [
  'Baden-Württemberg',
  'Bayern',
  'Berlin',
  'Brandenburg',
  'Bremen',
  'Hamburg',
  'Hessen',
  'Mecklenburg-Vorpommern',
  'Niedersachsen',
  'Nordrhein-Westfalen',
  'Rheinland-Pfalz',
  'Saarland',
  'Sachsen',
  'Sachsen-Anhalt',
  'Schleswig-Holstein',
  'Thüringen',
];

export const FRAME_LIGHTING_CPV_CODES = [
  { code: '31520000', description: 'Leuchten und Beleuchtungszubehör' },
  { code: '31521000', description: 'Lampen' },
  { code: '31521100', description: 'Schreibtischleuchten' },
  { code: '31521200', description: 'Außenleuchten' },
  { code: '31524000', description: 'Deckenleuchten und Wandleuchten' },
  { code: '31527000', description: 'Strahler' },
  { code: '31527260', description: 'LED-Lampen' },
  { code: '44212000', description: 'Rahmen und Gestelle' },
  { code: '44212321', description: 'Metallrahmen' },
  { code: '34992000', description: 'Anzeigetafeln, Hinweisschilder' },
  { code: '34992200', description: 'Außeninformationstafeln' },
  { code: '34992300', description: 'Straßenschilder' },
  { code: '39154000', description: 'Ausstellungsausstattung' },
  { code: '39154100', description: 'Ausstellungsregale' },
  { code: '35821000', description: 'Fahnen' },
  { code: '44316000', description: 'Eisenverarbeitungserzeugnisse' },
  { code: '44316400', description: 'Metallwaren' },
  { code: '45316100', description: 'Installation von Außenbeleuchtungsanlagen' },
  { code: '45316110', description: 'Installation von Straßenbeleuchtungsanlagen' },
  { code: '31600000', description: 'Elektrische Ausrüstung' },
];

export const DEFAULT_KEYWORDS = [
  'Rahmen',
  'Leuchtrahmen',
  'Lichtrahmen',
  'Beleuchtung',
  'LED',
  'Beschilderung',
  'Schilder',
  'Lichtwerbung',
  'Display',
  'Anzeigetafel',
  'Hinweisschild',
  'Außenwerbung',
  'Schaukasten',
  'Informationstafeln',
  'Wegweiser',
];
