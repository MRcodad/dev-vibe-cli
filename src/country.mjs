const COUNTRIES = {
  AF:'افغانستان',AL:'آلبانی',DZ:'الجزایر',AD:'آندورا',AO:'آنگولا',
  AG:'آنتیگوا و باربودا',AR:'آرژانتین',AM:'ارمنستان',AU:'استرالیا',AT:'اتریش',
  AZ:'آذربایجان',BS:'باهاما',BH:'بحرین',BD:'بنگلادش',BB:'باربادوس',
  BY:'بلاروس',BE:'بلژیک',BZ:'بلیز',BJ:'بنین',BT:'بوتان',
  BO:'بولیوی',BA:'بوسنی و هرزگوین',BW:'بوتسوانا',BR:'برزیل',BN:'برونئی',
  BG:'بلغارستان',BF:'بورکینافاسو',BI:'بوروندی',KH:'کامبوج',CM:'کامرون',
  CA:'کانادا',CV:'کابو ورده',CF:'آفریقای مرکزی',TD:'چاد',CL:'شیلی',
  CN:'چین',CO:'کلمبیا',KM:'کومور',CG:'کنگو',CR:'کاستاریکا',
  HR:'کرواسی',CU:'کوبا',CY:'قبرس',CZ:'چک',DK:'دانمارک',
  DJ:'جیبوتی',DM:'دومینیکا',DO:'دومینیکا',EC:'اکوادور',EG:'مصر',
  SV:'السالوادور',GQ:'گینه استوایی',ER:'اریتره',EE:'استونی',ET:'اتیوپی',
  FJ:'فیجی',FI:'فنلاند',FR:'فرانسه',GA:'گابن',GM:'گامبیا',
  GE:'گرجستان',DE:'آلمان',GH:'غنا',GR:'یونان',GD:'گرنادا',
  GT:'گواتمالا',GN:'گینه',GW:'گینه بیسائو',GY:'گویان',HT:'هائیتی',
  HN:'هندوراس',HU:'مجارستان',IS:'ایسلند',IN:'هند',ID:'اندونزی',
  IR:'ایران',IQ:'عراق',IE:'ایرلند',IL:'اسرائیل',IT:'ایتالیا',
  JM:'جامائیکا',JP:'ژاپن',JO:'اردن',KZ:'قزاقستان',KE:'کنیا',
  KI:'کیریباتی',KP:'کره شمالی',KR:'کره جنوبی',KW:'کویت',KG:'قرقیزستان',
  LA:'لائوس',LV:'لتونی',LB:'لبنان',LS:'لسوتو',LR:'لیبریا',
  LY:'لیبی',LI:'لیختن اشتاین',LT:'لیتوانی',LU:'لوکزامبورگ',MG:'ماداگاسکار',
  MW:'مالاوی',MY:'مالزی',MV:'مالدیو',ML:'مالی',MT:'مالت',
  MH:'جزایر مارشال',MR:'موریتانی',MU:'موریس',MX:'مکزیک',FM:'میکرونزی',
  MD:'مولداوی',MC:'موناکو',MN:'مغولستان',ME:'مونته‌نگرو',MA:'مراکش',
  Moz:'موزامبیک',MM:'میانمار',NA:'نامیبیا',NR:'نائورو',NP:'نپال',
  NL:'هلند',NZ:'نیوزیلند',NI:'نیکاراگوئه',NE:'نیجر',NG:'نیجریه',
  NO:'نروژ',OM:'عمان',PK:'پاکستان',PW:'پالائو',PA:'پاناما',
  PG:'پاپوآ گینه نو',PY:'پاراگوئه',PE:'پرو',PH:'فیلیپین',PL:'لهستان',
  PT:'پرتغال',QA:'قطر',RO:'رومانی',RU:'روسیه',RW:'رواندا',
  KN:'سنت کیتس و نویس',LC:'سنت لوسیا',VC:'سنت وینسنت',WS:'ساموآ',
  SM:'سان مارینو',ST:'سائوتومه و پرینسیپ',SA:'عربستان',SN:'سنگال',
  RS:'صربستان',SC:'سیشل',SL:'سیرالئون',SG:'سنگاپور',SK:'اسلواکی',
  SI:'اسلوونی',SB:'جزایر سلیمان',SO:'سومالی',ZA:'آفریقای جنوبی',
  SS:'سودان جنوبی',ES:'اسپانیا',LK:'سری‌لانکا',SD:'سودان',SR:'سورینام',
  SZ:'سوازیلند',SE:'سوئد',CH:'سوئیس',SY:'سوریه',TW:'تایوان',
  TJ:'تاجیکستان',TZ:'تانزانیا',TH:'تایلند',TL:'تیمور شرقی',TG:'توگو',
  TO:'تونگا',TT:'ترینیداد و توباگو',TN:'تونس',TR:'ترکیه',TM:'ترکمنستان',
  TV:'تووالو',UG:'اوگاندا',UA:'اوکراین',AE:'امارات',GB:'بریتانیا',
  US:'آمریکا',UY:'اروگوئه',UZ:'ازبکستان',VU:'وانواتو',VA:'واتیکان',
  VE:'ونزوئلا',VN:'ویتنام',YE:'یمن',ZM:'زامبیا',ZW:'زیمبابوه',
};

const COUNTRY_CODES_BY_NAME = {};
for (const [code, name] of Object.entries(COUNTRIES)) {
  COUNTRY_CODES_BY_NAME[name] = code;
}

export function getCountryFlag(countryCode) {
  if (!countryCode || countryCode.length !== 2) return '🌐';
  const code = countryCode.toUpperCase();
  const first = 0x1F1E6 + code.charCodeAt(0) - 65;
  const second = 0x1F1E6 + code.charCodeAt(1) - 65;
  return String.fromCodePoint(first, second);
}

export function getCountryName(countryCode) {
  if (!countryCode) return 'نامشخص';
  return COUNTRIES[countryCode.toUpperCase()] || countryCode;
}

export function getCountryCode(countryName) {
  return COUNTRY_CODES_BY_NAME[countryName] || null;
}

export function formatServerName(index, countryCode, protocol) {
  const flag = getCountryFlag(countryCode);
  const num = String(index + 1).padStart(3, '0');
  const proto = (protocol || 'V2Ray').toUpperCase();
  return `MRCODAD ${flag} Node-${num} | ${proto}`;
}

export { COUNTRIES };
