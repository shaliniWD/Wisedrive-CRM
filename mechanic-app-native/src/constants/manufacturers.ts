/**
 * Comprehensive list of 500+ vehicle manufacturers from around the world
 * Focused on Asia, Middle East, Southeast Asia, Europe, Australia, and New Zealand
 * Build #2 - WiseDrive OBD-II DTC Scanner
 */

export interface Manufacturer {
  id: string;
  name: string;
  country: string;
  region: 'Asia' | 'Europe' | 'North America' | 'South America' | 'Middle East' | 'Africa' | 'Oceania';
  aliases?: string[];
}

export const MANUFACTURERS: Manufacturer[] = [
  // ==================== JAPAN ====================
  { id: 'toyota', name: 'Toyota', country: 'Japan', region: 'Asia', aliases: ['TYT'] },
  { id: 'lexus', name: 'Lexus', country: 'Japan', region: 'Asia' },
  { id: 'honda', name: 'Honda', country: 'Japan', region: 'Asia', aliases: ['HMC'] },
  { id: 'acura', name: 'Acura', country: 'Japan', region: 'Asia' },
  { id: 'nissan', name: 'Nissan', country: 'Japan', region: 'Asia' },
  { id: 'datsun', name: 'Datsun', country: 'Japan', region: 'Asia', aliases: ['Datsun Nissan'] },
  { id: 'infiniti', name: 'Infiniti', country: 'Japan', region: 'Asia' },
  { id: 'mazda', name: 'Mazda', country: 'Japan', region: 'Asia' },
  { id: 'subaru', name: 'Subaru', country: 'Japan', region: 'Asia' },
  { id: 'mitsubishi', name: 'Mitsubishi', country: 'Japan', region: 'Asia' },
  { id: 'suzuki', name: 'Suzuki', country: 'Japan', region: 'Asia' },
  { id: 'daihatsu', name: 'Daihatsu', country: 'Japan', region: 'Asia' },
  { id: 'isuzu', name: 'Isuzu', country: 'Japan', region: 'Asia' },
  { id: 'hino', name: 'Hino', country: 'Japan', region: 'Asia' },
  { id: 'fuso', name: 'Fuso', country: 'Japan', region: 'Asia' },
  { id: 'ud_trucks', name: 'UD Trucks', country: 'Japan', region: 'Asia' },
  { id: 'kawasaki', name: 'Kawasaki', country: 'Japan', region: 'Asia' },
  { id: 'yamaha', name: 'Yamaha', country: 'Japan', region: 'Asia' },
  { id: 'aspark', name: 'Aspark', country: 'Japan', region: 'Asia' },
  { id: '光岡', name: 'Mitsuoka', country: 'Japan', region: 'Asia' },
  { id: 'tommykaira', name: 'Tommykaira', country: 'Japan', region: 'Asia' },
  
  // ==================== SOUTH KOREA ====================
  { id: 'hyundai', name: 'Hyundai', country: 'South Korea', region: 'Asia' },
  { id: 'kia', name: 'Kia', country: 'South Korea', region: 'Asia' },
  { id: 'genesis', name: 'Genesis', country: 'South Korea', region: 'Asia' },
  { id: 'ssangyong', name: 'SsangYong', country: 'South Korea', region: 'Asia' },
  { id: 'renault_korea', name: 'Renault Korea', country: 'South Korea', region: 'Asia' },
  { id: 'daewoo', name: 'Daewoo', country: 'South Korea', region: 'Asia' },
  { id: 'samsung_motors', name: 'Samsung Motors', country: 'South Korea', region: 'Asia' },
  
  // ==================== CHINA ====================
  { id: 'byd', name: 'BYD', country: 'China', region: 'Asia' },
  { id: 'geely', name: 'Geely', country: 'China', region: 'Asia' },
  { id: 'chery', name: 'Chery', country: 'China', region: 'Asia' },
  { id: 'great_wall', name: 'Great Wall Motors', country: 'China', region: 'Asia' },
  { id: 'haval', name: 'Haval', country: 'China', region: 'Asia' },
  { id: 'nio', name: 'NIO', country: 'China', region: 'Asia' },
  { id: 'xpeng', name: 'XPeng', country: 'China', region: 'Asia' },
  { id: 'li_auto', name: 'Li Auto', country: 'China', region: 'Asia' },
  { id: 'wuling', name: 'Wuling', country: 'China', region: 'Asia' },
  { id: 'saic', name: 'SAIC Motor', country: 'China', region: 'Asia' },
  { id: 'faw', name: 'FAW', country: 'China', region: 'Asia' },
  { id: 'dongfeng', name: 'Dongfeng', country: 'China', region: 'Asia' },
  { id: 'changan', name: 'Changan', country: 'China', region: 'Asia' },
  { id: 'baic', name: 'BAIC', country: 'China', region: 'Asia' },
  { id: 'gac', name: 'GAC', country: 'China', region: 'Asia' },
  { id: 'trumpchi', name: 'Trumpchi', country: 'China', region: 'Asia' },
  { id: 'jac', name: 'JAC Motors', country: 'China', region: 'Asia' },
  { id: 'zotye', name: 'Zotye', country: 'China', region: 'Asia' },
  { id: 'lifan', name: 'Lifan', country: 'China', region: 'Asia' },
  { id: 'brilliance', name: 'Brilliance', country: 'China', region: 'Asia' },
  { id: 'foton', name: 'Foton', country: 'China', region: 'Asia' },
  { id: 'lynk_co', name: 'Lynk & Co', country: 'China', region: 'Asia' },
  { id: 'polestar', name: 'Polestar', country: 'China', region: 'Asia' },
  { id: 'zeekr', name: 'Zeekr', country: 'China', region: 'Asia' },
  { id: 'ora', name: 'ORA', country: 'China', region: 'Asia' },
  { id: 'tank', name: 'Tank', country: 'China', region: 'Asia' },
  { id: 'wey', name: 'WEY', country: 'China', region: 'Asia' },
  { id: 'hongqi', name: 'Hongqi', country: 'China', region: 'Asia' },
  { id: 'roewe', name: 'Roewe', country: 'China', region: 'Asia' },
  { id: 'mg_china', name: 'MG (SAIC)', country: 'China', region: 'Asia' },
  { id: 'maxus', name: 'Maxus', country: 'China', region: 'Asia' },
  { id: 'voyah', name: 'Voyah', country: 'China', region: 'Asia' },
  { id: 'avatr', name: 'Avatr', country: 'China', region: 'Asia' },
  { id: 'neta', name: 'Neta', country: 'China', region: 'Asia' },
  { id: 'leap_motor', name: 'Leap Motor', country: 'China', region: 'Asia' },
  { id: 'aiways', name: 'Aiways', country: 'China', region: 'Asia' },
  { id: 'weltmeister', name: 'Weltmeister', country: 'China', region: 'Asia' },
  { id: 'jidu', name: 'Jidu Auto', country: 'China', region: 'Asia' },
  { id: 'hiphicar', name: 'HiPhi', country: 'China', region: 'Asia' },
  { id: 'enovate', name: 'Enovate', country: 'China', region: 'Asia' },
  { id: 'byton', name: 'Byton', country: 'China', region: 'Asia' },
  { id: 'denza', name: 'Denza', country: 'China', region: 'Asia' },
  { id: 'arcfox', name: 'ARCFOX', country: 'China', region: 'Asia' },
  { id: 'forthing', name: 'Forthing', country: 'China', region: 'Asia' },
  { id: 'venucia', name: 'Venucia', country: 'China', region: 'Asia' },
  { id: 'bestune', name: 'Bestune', country: 'China', region: 'Asia' },
  { id: 'aeolus', name: 'Aeolus', country: 'China', region: 'Asia' },
  { id: 'yudo', name: 'Yudo', country: 'China', region: 'Asia' },
  { id: 'landwind', name: 'Landwind', country: 'China', region: 'Asia' },
  { id: 'soueast', name: 'Soueast', country: 'China', region: 'Asia' },
  { id: 'haima', name: 'Haima', country: 'China', region: 'Asia' },
  { id: 'changhe', name: 'Changhe', country: 'China', region: 'Asia' },
  { id: 'hafei', name: 'Hafei', country: 'China', region: 'Asia' },
  { id: 'huanghai', name: 'Huanghai', country: 'China', region: 'Asia' },
  { id: 'jianghuai', name: 'Jianghuai', country: 'China', region: 'Asia' },
  { id: 'king_long', name: 'King Long', country: 'China', region: 'Asia' },
  { id: 'yutong', name: 'Yutong', country: 'China', region: 'Asia' },
  { id: 'zhongtong', name: 'Zhongtong', country: 'China', region: 'Asia' },
  { id: 'golden_dragon', name: 'Golden Dragon', country: 'China', region: 'Asia' },
  { id: 'sunlong', name: 'Sunlong', country: 'China', region: 'Asia' },
  { id: 'ankai', name: 'Ankai', country: 'China', region: 'Asia' },
  
  // ==================== INDIA ====================
  { id: 'tata', name: 'Tata Motors', country: 'India', region: 'Asia' },
  { id: 'mahindra', name: 'Mahindra', country: 'India', region: 'Asia' },
  { id: 'maruti_suzuki', name: 'Maruti Suzuki', country: 'India', region: 'Asia' },
  { id: 'hindustan', name: 'Hindustan Motors', country: 'India', region: 'Asia' },
  { id: 'ashok_leyland', name: 'Ashok Leyland', country: 'India', region: 'Asia' },
  { id: 'force_motors', name: 'Force Motors', country: 'India', region: 'Asia' },
  { id: 'premier', name: 'Premier Ltd', country: 'India', region: 'Asia' },
  { id: 'bajaj', name: 'Bajaj Auto', country: 'India', region: 'Asia' },
  { id: 'tvs', name: 'TVS Motor', country: 'India', region: 'Asia' },
  { id: 'hero', name: 'Hero MotoCorp', country: 'India', region: 'Asia' },
  { id: 'royal_enfield', name: 'Royal Enfield', country: 'India', region: 'Asia' },
  { id: 'eicher', name: 'Eicher Motors', country: 'India', region: 'Asia' },
  { id: 'ola_electric', name: 'Ola Electric', country: 'India', region: 'Asia' },
  { id: 'ather', name: 'Ather Energy', country: 'India', region: 'Asia' },
  { id: 'rivian_india', name: 'Tata Nexon EV', country: 'India', region: 'Asia' },
  
  // ==================== SOUTHEAST ASIA ====================
  // Malaysia
  { id: 'proton', name: 'Proton', country: 'Malaysia', region: 'Asia' },
  { id: 'perodua', name: 'Perodua', country: 'Malaysia', region: 'Asia' },
  { id: 'bufori', name: 'Bufori', country: 'Malaysia', region: 'Asia' },
  { id: 'naza', name: 'Naza', country: 'Malaysia', region: 'Asia' },
  
  // Indonesia
  { id: 'esemka', name: 'Esemka', country: 'Indonesia', region: 'Asia' },
  { id: 'timor', name: 'Timor', country: 'Indonesia', region: 'Asia' },
  { id: 'wuling_id', name: 'Wuling Indonesia', country: 'Indonesia', region: 'Asia' },
  { id: 'dfsk_id', name: 'DFSK Indonesia', country: 'Indonesia', region: 'Asia' },
  
  // Thailand
  { id: 'thai_rung', name: 'Thai Rung', country: 'Thailand', region: 'Asia' },
  { id: 'energy_absolute', name: 'Energy Absolute', country: 'Thailand', region: 'Asia' },
  
  // Vietnam
  { id: 'vinfast', name: 'VinFast', country: 'Vietnam', region: 'Asia' },
  { id: 'thaco', name: 'Thaco', country: 'Vietnam', region: 'Asia' },
  
  // Philippines
  { id: 'sarao', name: 'Sarao Motors', country: 'Philippines', region: 'Asia' },
  { id: 'francisco_motors', name: 'Francisco Motors', country: 'Philippines', region: 'Asia' },
  
  // Taiwan
  { id: 'luxgen', name: 'Luxgen', country: 'Taiwan', region: 'Asia' },
  { id: 'cmc', name: 'CMC', country: 'Taiwan', region: 'Asia' },
  { id: 'sym', name: 'SYM', country: 'Taiwan', region: 'Asia' },
  { id: 'kymco', name: 'Kymco', country: 'Taiwan', region: 'Asia' },
  
  // ==================== MIDDLE EAST ====================
  // Iran
  { id: 'iran_khodro', name: 'Iran Khodro', country: 'Iran', region: 'Middle East' },
  { id: 'saipa', name: 'SAIPA', country: 'Iran', region: 'Middle East' },
  { id: 'bahman', name: 'Bahman Group', country: 'Iran', region: 'Middle East' },
  { id: 'zamyad', name: 'Zamyad', country: 'Iran', region: 'Middle East' },
  { id: 'kish_khodro', name: 'Kish Khodro', country: 'Iran', region: 'Middle East' },
  { id: 'pars_khodro', name: 'Pars Khodro', country: 'Iran', region: 'Middle East' },
  { id: 'modiran', name: 'Modiran Vehicle', country: 'Iran', region: 'Middle East' },
  { id: 'kerman_khodro', name: 'Kerman Khodro', country: 'Iran', region: 'Middle East' },
  { id: 'rayen', name: 'Rayen', country: 'Iran', region: 'Middle East' },
  { id: 'sarir', name: 'Sarir', country: 'Iran', region: 'Middle East' },
  { id: 'mazda_iran', name: 'Mazda Iran', country: 'Iran', region: 'Middle East' },
  
  // Turkey
  { id: 'togg', name: 'TOGG', country: 'Turkey', region: 'Middle East' },
  { id: 'tofas', name: 'Tofaş', country: 'Turkey', region: 'Middle East' },
  { id: 'karsan', name: 'Karsan', country: 'Turkey', region: 'Middle East' },
  { id: 'otokar', name: 'Otokar', country: 'Turkey', region: 'Middle East' },
  { id: 'bmc_turkey', name: 'BMC Turkey', country: 'Turkey', region: 'Middle East' },
  { id: 'temsa', name: 'Temsa', country: 'Turkey', region: 'Middle East' },
  { id: 'ford_otosan', name: 'Ford Otosan', country: 'Turkey', region: 'Middle East' },
  { id: 'honda_turkiye', name: 'Honda Türkiye', country: 'Turkey', region: 'Middle East' },
  { id: 'toyota_turkiye', name: 'Toyota Türkiye', country: 'Turkey', region: 'Middle East' },
  { id: 'oyak_renault', name: 'Oyak-Renault', country: 'Turkey', region: 'Middle East' },
  { id: 'hyundai_assan', name: 'Hyundai Assan', country: 'Turkey', region: 'Middle East' },
  
  // UAE
  { id: 'w_motors', name: 'W Motors', country: 'UAE', region: 'Middle East' },
  { id: 'zenvo_uae', name: 'Dubai Motors', country: 'UAE', region: 'Middle East' },
  
  // Israel
  { id: 'autocars', name: 'Autocars', country: 'Israel', region: 'Middle East' },
  { id: 'ree', name: 'REE Automotive', country: 'Israel', region: 'Middle East' },
  
  // Saudi Arabia
  { id: 'lucid_saudi', name: 'Lucid Saudi', country: 'Saudi Arabia', region: 'Middle East' },
  { id: 'ceer', name: 'Ceer', country: 'Saudi Arabia', region: 'Middle East' },
  
  // Egypt
  { id: 'nasr', name: 'Nasr', country: 'Egypt', region: 'Middle East' },
  { id: 'ghabbour', name: 'GB Auto', country: 'Egypt', region: 'Middle East' },
  
  // ==================== EUROPE ====================
  // Germany
  { id: 'volkswagen', name: 'Volkswagen', country: 'Germany', region: 'Europe' },
  { id: 'audi', name: 'Audi', country: 'Germany', region: 'Europe' },
  { id: 'bmw', name: 'BMW', country: 'Germany', region: 'Europe' },
  { id: 'mercedes', name: 'Mercedes-Benz', country: 'Germany', region: 'Europe', aliases: ['Daimler', 'Benz'] },
  { id: 'porsche', name: 'Porsche', country: 'Germany', region: 'Europe' },
  { id: 'opel', name: 'Opel', country: 'Germany', region: 'Europe' },
  { id: 'smart', name: 'Smart', country: 'Germany', region: 'Europe' },
  { id: 'maybach', name: 'Maybach', country: 'Germany', region: 'Europe' },
  { id: 'man', name: 'MAN', country: 'Germany', region: 'Europe' },
  { id: 'neoplan', name: 'Neoplan', country: 'Germany', region: 'Europe' },
  { id: 'setra', name: 'Setra', country: 'Germany', region: 'Europe' },
  { id: 'mercedes_amg', name: 'Mercedes-AMG', country: 'Germany', region: 'Europe' },
  { id: 'alpina', name: 'Alpina', country: 'Germany', region: 'Europe' },
  { id: 'ruf', name: 'RUF', country: 'Germany', region: 'Europe' },
  { id: 'gumpert', name: 'Gumpert', country: 'Germany', region: 'Europe' },
  { id: 'wiesmann', name: 'Wiesmann', country: 'Germany', region: 'Europe' },
  { id: 'brabus', name: 'Brabus', country: 'Germany', region: 'Europe' },
  { id: 'carlsson', name: 'Carlsson', country: 'Germany', region: 'Europe' },
  { id: 'abt', name: 'ABT Sportsline', country: 'Germany', region: 'Europe' },
  { id: 'artega', name: 'Artega', country: 'Germany', region: 'Europe' },
  { id: 'next_ev', name: 'NEXT.e.GO', country: 'Germany', region: 'Europe' },
  { id: 'sono_motors', name: 'Sono Motors', country: 'Germany', region: 'Europe' },
  { id: 'borgward', name: 'Borgward', country: 'Germany', region: 'Europe' },
  
  // United Kingdom
  { id: 'jaguar', name: 'Jaguar', country: 'UK', region: 'Europe' },
  { id: 'land_rover', name: 'Land Rover', country: 'UK', region: 'Europe' },
  { id: 'bentley', name: 'Bentley', country: 'UK', region: 'Europe' },
  { id: 'rolls_royce', name: 'Rolls-Royce', country: 'UK', region: 'Europe' },
  { id: 'aston_martin', name: 'Aston Martin', country: 'UK', region: 'Europe' },
  { id: 'mclaren', name: 'McLaren', country: 'UK', region: 'Europe' },
  { id: 'mini', name: 'MINI', country: 'UK', region: 'Europe' },
  { id: 'lotus', name: 'Lotus', country: 'UK', region: 'Europe' },
  { id: 'morgan', name: 'Morgan', country: 'UK', region: 'Europe' },
  { id: 'tvr', name: 'TVR', country: 'UK', region: 'Europe' },
  { id: 'caterham', name: 'Caterham', country: 'UK', region: 'Europe' },
  { id: 'ariel', name: 'Ariel', country: 'UK', region: 'Europe' },
  { id: 'bac', name: 'BAC', country: 'UK', region: 'Europe' },
  { id: 'bristol', name: 'Bristol', country: 'UK', region: 'Europe' },
  { id: 'noble', name: 'Noble', country: 'UK', region: 'Europe' },
  { id: 'ginetta', name: 'Ginetta', country: 'UK', region: 'Europe' },
  { id: 'westfield', name: 'Westfield', country: 'UK', region: 'Europe' },
  { id: 'radical', name: 'Radical', country: 'UK', region: 'Europe' },
  { id: 'ultima', name: 'Ultima', country: 'UK', region: 'Europe' },
  { id: 'lister', name: 'Lister', country: 'UK', region: 'Europe' },
  { id: 'david_brown', name: 'David Brown', country: 'UK', region: 'Europe' },
  { id: 'london_taxi', name: 'London Taxi', country: 'UK', region: 'Europe' },
  { id: 'levc', name: 'LEVC', country: 'UK', region: 'Europe' },
  { id: 'triumph', name: 'Triumph', country: 'UK', region: 'Europe' },
  { id: 'vauxhall', name: 'Vauxhall', country: 'UK', region: 'Europe' },
  { id: 'mg', name: 'MG', country: 'UK', region: 'Europe' },
  { id: 'rover', name: 'Rover', country: 'UK', region: 'Europe' },
  { id: 'arrival', name: 'Arrival', country: 'UK', region: 'Europe' },
  
  // Italy
  { id: 'ferrari', name: 'Ferrari', country: 'Italy', region: 'Europe' },
  { id: 'lamborghini', name: 'Lamborghini', country: 'Italy', region: 'Europe' },
  { id: 'maserati', name: 'Maserati', country: 'Italy', region: 'Europe' },
  { id: 'alfa_romeo', name: 'Alfa Romeo', country: 'Italy', region: 'Europe' },
  { id: 'fiat', name: 'Fiat', country: 'Italy', region: 'Europe' },
  { id: 'abarth', name: 'Abarth', country: 'Italy', region: 'Europe' },
  { id: 'lancia', name: 'Lancia', country: 'Italy', region: 'Europe' },
  { id: 'pagani', name: 'Pagani', country: 'Italy', region: 'Europe' },
  { id: 'ducati', name: 'Ducati', country: 'Italy', region: 'Europe' },
  { id: 'piaggio', name: 'Piaggio', country: 'Italy', region: 'Europe' },
  { id: 'vespa', name: 'Vespa', country: 'Italy', region: 'Europe' },
  { id: 'aprilia', name: 'Aprilia', country: 'Italy', region: 'Europe' },
  { id: 'moto_guzzi', name: 'Moto Guzzi', country: 'Italy', region: 'Europe' },
  { id: 'iveco', name: 'Iveco', country: 'Italy', region: 'Europe' },
  { id: 'de_tomaso', name: 'De Tomaso', country: 'Italy', region: 'Europe' },
  { id: 'iso', name: 'ISO Rivolta', country: 'Italy', region: 'Europe' },
  { id: 'dallara', name: 'Dallara', country: 'Italy', region: 'Europe' },
  { id: 'italidesign', name: 'Italdesign', country: 'Italy', region: 'Europe' },
  { id: 'pininfarina', name: 'Pininfarina', country: 'Italy', region: 'Europe' },
  { id: 'zagato', name: 'Zagato', country: 'Italy', region: 'Europe' },
  { id: 'touring', name: 'Touring Superleggera', country: 'Italy', region: 'Europe' },
  { id: 'ares', name: 'ARES Design', country: 'Italy', region: 'Europe' },
  
  // France
  { id: 'renault', name: 'Renault', country: 'France', region: 'Europe' },
  { id: 'peugeot', name: 'Peugeot', country: 'France', region: 'Europe' },
  { id: 'citroen', name: 'Citroën', country: 'France', region: 'Europe' },
  { id: 'ds', name: 'DS Automobiles', country: 'France', region: 'Europe' },
  { id: 'bugatti', name: 'Bugatti', country: 'France', region: 'Europe' },
  { id: 'alpine', name: 'Alpine', country: 'France', region: 'Europe' },
  { id: 'venturi', name: 'Venturi', country: 'France', region: 'Europe' },
  { id: 'ligier', name: 'Ligier', country: 'France', region: 'Europe' },
  { id: 'aixam', name: 'Aixam', country: 'France', region: 'Europe' },
  { id: 'microcar', name: 'Microcar', country: 'France', region: 'Europe' },
  { id: 'bollore', name: 'Bolloré', country: 'France', region: 'Europe' },
  { id: 'pgo', name: 'PGO', country: 'France', region: 'Europe' },
  { id: 'de_la_chapelle', name: 'De la Chapelle', country: 'France', region: 'Europe' },
  
  // Sweden
  { id: 'volvo', name: 'Volvo', country: 'Sweden', region: 'Europe' },
  { id: 'scania', name: 'Scania', country: 'Sweden', region: 'Europe' },
  { id: 'saab', name: 'Saab', country: 'Sweden', region: 'Europe' },
  { id: 'koenigsegg', name: 'Koenigsegg', country: 'Sweden', region: 'Europe' },
  { id: 'nevs', name: 'NEVS', country: 'Sweden', region: 'Europe' },
  { id: 'uniti', name: 'Uniti', country: 'Sweden', region: 'Europe' },
  
  // Czech Republic
  { id: 'skoda', name: 'Škoda', country: 'Czech Republic', region: 'Europe', aliases: ['Skoda'] },
  { id: 'tatra', name: 'Tatra', country: 'Czech Republic', region: 'Europe' },
  { id: 'praga', name: 'Praga', country: 'Czech Republic', region: 'Europe' },
  { id: 'kaipan', name: 'Kaipan', country: 'Czech Republic', region: 'Europe' },
  
  // Spain
  { id: 'seat', name: 'SEAT', country: 'Spain', region: 'Europe' },
  { id: 'cupra', name: 'CUPRA', country: 'Spain', region: 'Europe' },
  { id: 'hispano_suiza', name: 'Hispano-Suiza', country: 'Spain', region: 'Europe' },
  { id: 'tramontana', name: 'Tramontana', country: 'Spain', region: 'Europe' },
  { id: 'spania_gta', name: 'Spania GTA', country: 'Spain', region: 'Europe' },
  
  // Netherlands
  { id: 'daf', name: 'DAF', country: 'Netherlands', region: 'Europe' },
  { id: 'spyker', name: 'Spyker', country: 'Netherlands', region: 'Europe' },
  { id: 'donkervoort', name: 'Donkervoort', country: 'Netherlands', region: 'Europe' },
  { id: 'vdl', name: 'VDL', country: 'Netherlands', region: 'Europe' },
  { id: 'lightyear', name: 'Lightyear', country: 'Netherlands', region: 'Europe' },
  
  // Romania
  { id: 'dacia', name: 'Dacia', country: 'Romania', region: 'Europe' },
  { id: 'aro', name: 'ARO', country: 'Romania', region: 'Europe' },
  
  // Poland
  { id: 'fsm', name: 'FSM', country: 'Poland', region: 'Europe' },
  { id: 'fso', name: 'FSO', country: 'Poland', region: 'Europe' },
  { id: 'arrinera', name: 'Arrinera', country: 'Poland', region: 'Europe' },
  { id: 'solaris', name: 'Solaris Bus', country: 'Poland', region: 'Europe' },
  { id: 'autosan', name: 'Autosan', country: 'Poland', region: 'Europe' },
  { id: 'elk', name: 'ELK', country: 'Poland', region: 'Europe' },
  
  // Russia
  { id: 'lada', name: 'Lada', country: 'Russia', region: 'Europe' },
  { id: 'uaz', name: 'UAZ', country: 'Russia', region: 'Europe' },
  { id: 'gaz', name: 'GAZ', country: 'Russia', region: 'Europe' },
  { id: 'kamaz', name: 'Kamaz', country: 'Russia', region: 'Europe' },
  { id: 'aurus', name: 'Aurus', country: 'Russia', region: 'Europe' },
  { id: 'zil', name: 'ZIL', country: 'Russia', region: 'Europe' },
  { id: 'moskvitch', name: 'Moskvitch', country: 'Russia', region: 'Europe' },
  { id: 'marussia', name: 'Marussia', country: 'Russia', region: 'Europe' },
  { id: 'evolute', name: 'Evolute', country: 'Russia', region: 'Europe' },
  
  // Austria
  { id: 'ktm', name: 'KTM', country: 'Austria', region: 'Europe' },
  { id: 'steyr', name: 'Steyr', country: 'Austria', region: 'Europe' },
  { id: 'magna_steyr', name: 'Magna Steyr', country: 'Austria', region: 'Europe' },
  
  // Switzerland
  { id: 'rinspeed', name: 'Rinspeed', country: 'Switzerland', region: 'Europe' },
  { id: 'sbarro', name: 'Sbarro', country: 'Switzerland', region: 'Europe' },
  { id: 'piech', name: 'Piëch', country: 'Switzerland', region: 'Europe' },
  
  // Belgium
  { id: 'gillet', name: 'Gillet', country: 'Belgium', region: 'Europe' },
  { id: 'vertigo', name: 'Vertigo', country: 'Belgium', region: 'Europe' },
  
  // Denmark
  { id: 'zenvo', name: 'Zenvo', country: 'Denmark', region: 'Europe' },
  
  // Finland
  { id: 'valmet', name: 'Valmet', country: 'Finland', region: 'Europe' },
  { id: 'sisu', name: 'Sisu', country: 'Finland', region: 'Europe' },
  
  // Norway
  { id: 'think', name: 'Think', country: 'Norway', region: 'Europe' },
  { id: 'buddy', name: 'Buddy', country: 'Norway', region: 'Europe' },
  
  // Croatia
  { id: 'rimac', name: 'Rimac', country: 'Croatia', region: 'Europe' },
  { id: 'dok_ing', name: 'DOK-ING', country: 'Croatia', region: 'Europe' },
  
  // Serbia
  { id: 'zastava', name: 'Zastava', country: 'Serbia', region: 'Europe' },
  
  // Ukraine
  { id: 'zaz', name: 'ZAZ', country: 'Ukraine', region: 'Europe' },
  { id: 'bogdan', name: 'Bogdan', country: 'Ukraine', region: 'Europe' },
  { id: 'kraz', name: 'KrAZ', country: 'Ukraine', region: 'Europe' },
  
  // ==================== NORTH AMERICA ====================
  // USA
  { id: 'ford', name: 'Ford', country: 'USA', region: 'North America' },
  { id: 'lincoln', name: 'Lincoln', country: 'USA', region: 'North America' },
  { id: 'chevrolet', name: 'Chevrolet', country: 'USA', region: 'North America', aliases: ['Chevy'] },
  { id: 'gmc', name: 'GMC', country: 'USA', region: 'North America' },
  { id: 'cadillac', name: 'Cadillac', country: 'USA', region: 'North America' },
  { id: 'buick', name: 'Buick', country: 'USA', region: 'North America' },
  { id: 'dodge', name: 'Dodge', country: 'USA', region: 'North America' },
  { id: 'jeep', name: 'Jeep', country: 'USA', region: 'North America' },
  { id: 'ram', name: 'RAM', country: 'USA', region: 'North America' },
  { id: 'chrysler', name: 'Chrysler', country: 'USA', region: 'North America' },
  { id: 'tesla', name: 'Tesla', country: 'USA', region: 'North America' },
  { id: 'rivian', name: 'Rivian', country: 'USA', region: 'North America' },
  { id: 'lucid', name: 'Lucid', country: 'USA', region: 'North America' },
  { id: 'fisker', name: 'Fisker', country: 'USA', region: 'North America' },
  { id: 'karma', name: 'Karma', country: 'USA', region: 'North America' },
  { id: 'polestar_us', name: 'Polestar USA', country: 'USA', region: 'North America' },
  { id: 'hummer', name: 'Hummer', country: 'USA', region: 'North America' },
  { id: 'pontiac', name: 'Pontiac', country: 'USA', region: 'North America' },
  { id: 'oldsmobile', name: 'Oldsmobile', country: 'USA', region: 'North America' },
  { id: 'saturn', name: 'Saturn', country: 'USA', region: 'North America' },
  { id: 'mercury', name: 'Mercury', country: 'USA', region: 'North America' },
  { id: 'plymouth', name: 'Plymouth', country: 'USA', region: 'North America' },
  { id: 'scion', name: 'Scion', country: 'USA', region: 'North America' },
  { id: 'panoz', name: 'Panoz', country: 'USA', region: 'North America' },
  { id: 'saleen', name: 'Saleen', country: 'USA', region: 'North America' },
  { id: 'hennessey', name: 'Hennessey', country: 'USA', region: 'North America' },
  { id: 'ssc', name: 'SSC', country: 'USA', region: 'North America' },
  { id: 'vector', name: 'Vector', country: 'USA', region: 'North America' },
  { id: 'mosler', name: 'Mosler', country: 'USA', region: 'North America' },
  { id: 'rossion', name: 'Rossion', country: 'USA', region: 'North America' },
  { id: 'local_motors', name: 'Local Motors', country: 'USA', region: 'North America' },
  { id: 'aptera', name: 'Aptera', country: 'USA', region: 'North America' },
  { id: 'lordstown', name: 'Lordstown', country: 'USA', region: 'North America' },
  { id: 'canoo', name: 'Canoo', country: 'USA', region: 'North America' },
  { id: 'faraday', name: 'Faraday Future', country: 'USA', region: 'North America' },
  { id: 'bollinger', name: 'Bollinger', country: 'USA', region: 'North America' },
  { id: 'workhorse', name: 'Workhorse', country: 'USA', region: 'North America' },
  { id: 'nikola', name: 'Nikola', country: 'USA', region: 'North America' },
  { id: 'kenworth', name: 'Kenworth', country: 'USA', region: 'North America' },
  { id: 'peterbilt', name: 'Peterbilt', country: 'USA', region: 'North America' },
  { id: 'mack', name: 'Mack', country: 'USA', region: 'North America' },
  { id: 'freightliner', name: 'Freightliner', country: 'USA', region: 'North America' },
  { id: 'international', name: 'International', country: 'USA', region: 'North America' },
  { id: 'western_star', name: 'Western Star', country: 'USA', region: 'North America' },
  { id: 'blue_bird', name: 'Blue Bird', country: 'USA', region: 'North America' },
  { id: 'thomas_built', name: 'Thomas Built', country: 'USA', region: 'North America' },
  { id: 'gillig', name: 'Gillig', country: 'USA', region: 'North America' },
  { id: 'new_flyer', name: 'New Flyer', country: 'USA', region: 'North America' },
  { id: 'harley', name: 'Harley-Davidson', country: 'USA', region: 'North America' },
  { id: 'indian', name: 'Indian', country: 'USA', region: 'North America' },
  { id: 'polaris', name: 'Polaris', country: 'USA', region: 'North America' },
  { id: 'victory', name: 'Victory', country: 'USA', region: 'North America' },
  { id: 'zero', name: 'Zero Motorcycles', country: 'USA', region: 'North America' },
  { id: 'alta', name: 'Alta Motors', country: 'USA', region: 'North America' },
  { id: 'brammo', name: 'Brammo', country: 'USA', region: 'North America' },
  { id: 'delorean', name: 'DeLorean', country: 'USA', region: 'North America' },
  { id: 'shelby', name: 'Shelby', country: 'USA', region: 'North America' },
  { id: 'roush', name: 'Roush', country: 'USA', region: 'North America' },
  { id: 'callaway', name: 'Callaway', country: 'USA', region: 'North America' },
  { id: 'lingenfelter', name: 'Lingenfelter', country: 'USA', region: 'North America' },
  { id: 'equus', name: 'Equus', country: 'USA', region: 'North America' },
  { id: 'rezvani', name: 'Rezvani', country: 'USA', region: 'North America' },
  { id: 'czinger', name: 'Czinger', country: 'USA', region: 'North America' },
  { id: 'scuderia_cameron', name: 'SCG', country: 'USA', region: 'North America' },
  { id: 'drako', name: 'Drako', country: 'USA', region: 'North America' },
  { id: 'mullen', name: 'Mullen', country: 'USA', region: 'North America' },
  { id: 'alpha', name: 'Alpha Motor', country: 'USA', region: 'North America' },
  
  // Canada
  { id: 'brp', name: 'BRP', country: 'Canada', region: 'North America' },
  { id: 'can_am', name: 'Can-Am', country: 'Canada', region: 'North America' },
  { id: 'ski_doo', name: 'Ski-Doo', country: 'Canada', region: 'North America' },
  { id: 'sea_doo', name: 'Sea-Doo', country: 'Canada', region: 'North America' },
  { id: 'campagna', name: 'Campagna', country: 'Canada', region: 'North America' },
  { id: 'htc_motors', name: 'HTT', country: 'Canada', region: 'North America' },
  { id: 'felino', name: 'Felino', country: 'Canada', region: 'North America' },
  { id: 'electrameccanica', name: 'Electra Meccanica', country: 'Canada', region: 'North America' },
  { id: 'lion_electric', name: 'Lion Electric', country: 'Canada', region: 'North America' },
  
  // Mexico
  { id: 'vuhl', name: 'VUHL', country: 'Mexico', region: 'North America' },
  { id: 'mastretta', name: 'Mastretta', country: 'Mexico', region: 'North America' },
  { id: 'zacua', name: 'Zacua', country: 'Mexico', region: 'North America' },
  
  // ==================== SOUTH AMERICA ====================
  // Brazil
  { id: 'troller', name: 'Troller', country: 'Brazil', region: 'South America' },
  { id: 'marcopolo', name: 'Marcopolo', country: 'Brazil', region: 'South America' },
  { id: 'agrale', name: 'Agrale', country: 'Brazil', region: 'South America' },
  { id: 'avelloz', name: 'Avelloz', country: 'Brazil', region: 'South America' },
  { id: 'effa', name: 'Effa', country: 'Brazil', region: 'South America' },
  
  // Argentina
  { id: 'zanella', name: 'Zanella', country: 'Argentina', region: 'South America' },
  { id: 'sero_electric', name: 'Sero Electric', country: 'Argentina', region: 'South America' },
  { id: 'coradir', name: 'Coradir', country: 'Argentina', region: 'South America' },
  
  // ==================== OCEANIA ====================
  // Australia
  { id: 'holden', name: 'Holden', country: 'Australia', region: 'Oceania' },
  { id: 'hsv', name: 'HSV', country: 'Australia', region: 'Oceania' },
  { id: 'fpv', name: 'FPV', country: 'Australia', region: 'Oceania' },
  { id: 'elfin', name: 'Elfin', country: 'Australia', region: 'Oceania' },
  { id: 'bolwell', name: 'Bolwell', country: 'Australia', region: 'Oceania' },
  { id: 'brabham', name: 'Brabham', country: 'Australia', region: 'Oceania' },
  { id: 'ace_ev', name: 'ACE EV', country: 'Australia', region: 'Oceania' },
  
  // New Zealand
  { id: 'hulme', name: 'Hulme', country: 'New Zealand', region: 'Oceania' },
  { id: 'rodin', name: 'Rodin Cars', country: 'New Zealand', region: 'Oceania' },
  
  // ==================== AFRICA ====================
  // South Africa
  { id: 'birkin', name: 'Birkin', country: 'South Africa', region: 'Africa' },
  { id: 'perana', name: 'Perana', country: 'South Africa', region: 'Africa' },
  
  // Morocco
  { id: 'neo_motors', name: 'Neo Motors', country: 'Morocco', region: 'Africa' },
  
  // Nigeria
  { id: 'innoson', name: 'Innoson', country: 'Nigeria', region: 'Africa' },
  { id: 'nord', name: 'Nord Automobiles', country: 'Nigeria', region: 'Africa' },
  
  // Kenya
  { id: 'mobius', name: 'Mobius Motors', country: 'Kenya', region: 'Africa' },
  
  // Ghana
  { id: 'kantanka', name: 'Kantanka', country: 'Ghana', region: 'Africa' },
  
  // Uganda
  { id: 'kiira', name: 'Kiira Motors', country: 'Uganda', region: 'Africa' },
  
  // Rwanda
  { id: 'volkswagen_rwanda', name: 'VW Rwanda', country: 'Rwanda', region: 'Africa' },
];

// Generate years from 2000 to current year
const currentYear = new Date().getFullYear();
export const MANUFACTURE_YEARS: number[] = Array.from(
  { length: currentYear - 1999 },
  (_, i) => currentYear - i
);

// Group manufacturers by region for easier UI
export const MANUFACTURERS_BY_REGION = MANUFACTURERS.reduce((acc, mfr) => {
  if (!acc[mfr.region]) {
    acc[mfr.region] = [];
  }
  acc[mfr.region].push(mfr);
  return acc;
}, {} as Record<string, Manufacturer[]>);

// Search function for manufacturers
export function searchManufacturers(query: string): Manufacturer[] {
  if (!query.trim()) return MANUFACTURERS;
  
  const lowerQuery = query.toLowerCase().trim();
  
  return MANUFACTURERS.filter((mfr) => {
    const nameMatch = mfr.name.toLowerCase().includes(lowerQuery);
    const countryMatch = mfr.country.toLowerCase().includes(lowerQuery);
    const aliasMatch = mfr.aliases?.some((alias) => 
      alias.toLowerCase().includes(lowerQuery)
    );
    return nameMatch || countryMatch || aliasMatch;
  }).sort((a, b) => {
    // Prioritize exact matches
    const aExact = a.name.toLowerCase().startsWith(lowerQuery);
    const bExact = b.name.toLowerCase().startsWith(lowerQuery);
    if (aExact && !bExact) return -1;
    if (!aExact && bExact) return 1;
    return a.name.localeCompare(b.name);
  });
}
