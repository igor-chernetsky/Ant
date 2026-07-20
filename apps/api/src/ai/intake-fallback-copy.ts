import {
  DEFAULT_LOCALE,
  isSupportedLocale,
  type SupportedLocale,
} from '../users/locale.types';
import type { IntakeQuestion } from './intake.types';

type LocalizedQuestion = Omit<IntakeQuestion, 'id' | 'type'> & {
  id: string;
  type: IntakeQuestion['type'];
};

const PROPERTY_TYPE: Record<SupportedLocale, LocalizedQuestion> = {
  en: {
    id: 'property-type',
    type: 'single',
    prompt: 'What type of property is this project for?',
    required: true,
    allowSkip: true,
    allowCustom: true,
    options: [
      { id: 'apartment', label: 'Apartment' },
      { id: 'house', label: 'House' },
      { id: 'commercial', label: 'Commercial' },
      { id: 'land', label: 'Land' },
    ],
  },
  ru: {
    id: 'property-type',
    type: 'single',
    prompt: 'Для какого типа недвижимости этот проект?',
    required: true,
    allowSkip: true,
    allowCustom: true,
    options: [
      { id: 'apartment', label: 'Квартира' },
      { id: 'house', label: 'Дом' },
      { id: 'commercial', label: 'Коммерческое помещение' },
      { id: 'land', label: 'Участок' },
    ],
  },
  th: {
    id: 'property-type',
    type: 'single',
    prompt: 'โครงการนี้เป็นทรัพย์สินประเภทใด?',
    required: true,
    allowSkip: true,
    allowCustom: true,
    options: [
      { id: 'apartment', label: 'อพาร์ตเมนต์' },
      { id: 'house', label: 'บ้าน' },
      { id: 'commercial', label: 'เชิงพาณิชย์' },
      { id: 'land', label: 'ที่ดิน' },
    ],
  },
};

const APPROX_AREA: Record<SupportedLocale, LocalizedQuestion> = {
  en: {
    id: 'approx-area',
    type: 'single',
    prompt: 'What is the approximate area involved?',
    required: true,
    allowSkip: true,
    allowCustom: true,
    options: [
      { id: 'under-30', label: 'Under 30 sqm' },
      { id: '30-80', label: '30–80 sqm' },
      { id: '80-150', label: '80–150 sqm' },
      { id: '150-plus', label: 'Over 150 sqm' },
    ],
  },
  ru: {
    id: 'approx-area',
    type: 'single',
    prompt: 'Какая приблизительная площадь работ?',
    required: true,
    allowSkip: true,
    allowCustom: true,
    options: [
      { id: 'under-30', label: 'До 30 м²' },
      { id: '30-80', label: '30–80 м²' },
      { id: '80-150', label: '80–150 м²' },
      { id: '150-plus', label: 'Более 150 м²' },
    ],
  },
  th: {
    id: 'approx-area',
    type: 'single',
    prompt: 'พื้นที่โดยประมาณที่เกี่ยวข้องคือเท่าใด?',
    required: true,
    allowSkip: true,
    allowCustom: true,
    options: [
      { id: 'under-30', label: 'ต่ำกว่า 30 ตร.ม.' },
      { id: '30-80', label: '30–80 ตร.ม.' },
      { id: '80-150', label: '80–150 ตร.ม.' },
      { id: '150-plus', label: 'มากกว่า 150 ตร.ม.' },
    ],
  },
};

const STOREY_COUNT: Record<SupportedLocale, LocalizedQuestion> = {
  en: {
    id: 'storey-count',
    type: 'single',
    prompt: 'How many storeys/floors does the building have?',
    required: true,
    allowSkip: true,
    allowCustom: true,
    options: [
      { id: '1', label: 'Single storey' },
      { id: '2', label: '2 storeys' },
      { id: '3-plus', label: '3 or more' },
    ],
  },
  ru: {
    id: 'storey-count',
    type: 'single',
    prompt: 'Сколько этажей у здания?',
    required: true,
    allowSkip: true,
    allowCustom: true,
    options: [
      { id: '1', label: 'Один этаж' },
      { id: '2', label: '2 этажа' },
      { id: '3-plus', label: '3 и больше' },
    ],
  },
  th: {
    id: 'storey-count',
    type: 'single',
    prompt: 'อาคารมีกี่ชั้น?',
    required: true,
    allowSkip: true,
    allowCustom: true,
    options: [
      { id: '1', label: 'ชั้นเดียว' },
      { id: '2', label: '2 ชั้น' },
      { id: '3-plus', label: '3 ชั้นขึ้นไป' },
    ],
  },
};

const POOL_DEPTH: Record<SupportedLocale, LocalizedQuestion> = {
  en: {
    id: 'pool-depth',
    type: 'single',
    prompt: 'What is the planned pool depth?',
    required: true,
    allowSkip: true,
    allowCustom: true,
    options: [
      { id: 'up-to-1.2', label: 'Up to 1.2 m' },
      { id: '1.2-1.5', label: '1.2–1.5 m' },
      { id: '1.5-2.0', label: '1.5–2.0 m' },
      { id: 'over-2.0', label: 'Over 2.0 m / variable depth' },
    ],
  },
  ru: {
    id: 'pool-depth',
    type: 'single',
    prompt: 'Какая планируемая глубина бассейна?',
    required: true,
    allowSkip: true,
    allowCustom: true,
    options: [
      { id: 'up-to-1.2', label: 'До 1,2 м' },
      { id: '1.2-1.5', label: '1,2–1,5 м' },
      { id: '1.5-2.0', label: '1,5–2,0 м' },
      { id: 'over-2.0', label: 'Более 2,0 м / переменная глубина' },
    ],
  },
  th: {
    id: 'pool-depth',
    type: 'single',
    prompt: 'ความลึกสระที่วางแผนไว้คือเท่าใด?',
    required: true,
    allowSkip: true,
    allowCustom: true,
    options: [
      { id: 'up-to-1.2', label: 'ไม่เกิน 1.2 ม.' },
      { id: '1.2-1.5', label: '1.2–1.5 ม.' },
      { id: '1.5-2.0', label: '1.5–2.0 ม.' },
      { id: 'over-2.0', label: 'มากกว่า 2.0 ม. / ความลึกไม่คงที่' },
    ],
  },
};

const POOL_PUMP: Record<SupportedLocale, LocalizedQuestion> = {
  en: {
    id: 'pool-pump-station',
    type: 'single',
    prompt: 'Where should the pump / equipment room be placed?',
    required: true,
    allowSkip: true,
    allowCustom: true,
    options: [
      { id: 'underground', label: 'Underground / plant room below grade' },
      { id: 'adjacent-building', label: 'Adjacent building / service room' },
      { id: 'outdoor-enclosure', label: 'Outdoor enclosure near the pool' },
      { id: 'undecided', label: 'Not decided yet' },
    ],
  },
  ru: {
    id: 'pool-pump-station',
    type: 'single',
    prompt: 'Где должна располагаться насосная / техническая?',
    required: true,
    allowSkip: true,
    allowCustom: true,
    options: [
      { id: 'underground', label: 'Под землёй / помещение ниже уровня' },
      { id: 'adjacent-building', label: 'В соседнем здании / техпомещении' },
      { id: 'outdoor-enclosure', label: 'Уличный блок рядом с бассейном' },
      { id: 'undecided', label: 'Ещё не решено' },
    ],
  },
  th: {
    id: 'pool-pump-station',
    type: 'single',
    prompt: 'ควรวางห้องปั๊ม / ห้องเครื่องไว้ที่ใด?',
    required: true,
    allowSkip: true,
    allowCustom: true,
    options: [
      { id: 'underground', label: 'ใต้ดิน / ห้องเครื่องใต้ระดับพื้น' },
      { id: 'adjacent-building', label: 'อาคารข้างเคียง / ห้องบริการ' },
      { id: 'outdoor-enclosure', label: 'ตู้ภายนอกใกล้สระ' },
      { id: 'undecided', label: 'ยังไม่ได้ตัดสินใจ' },
    ],
  },
};

const SPECIAL_SYSTEMS: Record<SupportedLocale, LocalizedQuestion> = {
  en: {
    id: 'special-systems',
    type: 'multi',
    prompt:
      'Which special building systems apply? (select all that apply, or skip if none)',
    required: true,
    allowSkip: true,
    allowCustom: true,
    options: [
      { id: 'none', label: 'None of these' },
      { id: 'elevator', label: 'Elevator / lift' },
      { id: 'pool', label: 'Swimming pool' },
      { id: 'basement', label: 'Basement / underground works' },
      { id: 'smart-home', label: 'Smart home / automation' },
    ],
  },
  ru: {
    id: 'special-systems',
    type: 'multi',
    prompt:
      'Какие особые системы здания нужны? (можно выбрать несколько или пропустить)',
    required: true,
    allowSkip: true,
    allowCustom: true,
    options: [
      { id: 'none', label: 'Ничего из перечисленного' },
      { id: 'elevator', label: 'Лифт' },
      { id: 'pool', label: 'Бассейн' },
      { id: 'basement', label: 'Подвал / подземные работы' },
      { id: 'smart-home', label: 'Умный дом / автоматизация' },
    ],
  },
  th: {
    id: 'special-systems',
    type: 'multi',
    prompt:
      'มีระบบพิเศษใดที่เกี่ยวข้องบ้าง? (เลือกได้หลายข้อ หรือข้ามหากไม่มี)',
    required: true,
    allowSkip: true,
    allowCustom: true,
    options: [
      { id: 'none', label: 'ไม่มีรายการเหล่านี้' },
      { id: 'elevator', label: 'ลิฟต์' },
      { id: 'pool', label: 'สระว่ายน้ำ' },
      { id: 'basement', label: 'ชั้นใต้ดิน / งานใต้ดิน' },
      { id: 'smart-home', label: 'สมาร์ทโฮม / ระบบอัตโนมัติ' },
    ],
  },
};

const TIMELINE: Record<SupportedLocale, LocalizedQuestion> = {
  en: {
    id: 'timeline',
    type: 'single',
    prompt: 'When would you like to start?',
    required: true,
    allowSkip: true,
    allowCustom: true,
    options: [
      { id: 'asap', label: 'As soon as possible' },
      { id: '1-3-months', label: 'In 1–3 months' },
      { id: 'flexible', label: 'Flexible' },
    ],
  },
  ru: {
    id: 'timeline',
    type: 'single',
    prompt: 'Когда вы хотите начать?',
    required: true,
    allowSkip: true,
    allowCustom: true,
    options: [
      { id: 'asap', label: 'Как можно скорее' },
      { id: '1-3-months', label: 'Через 1–3 месяца' },
      { id: 'flexible', label: 'Гибко' },
    ],
  },
  th: {
    id: 'timeline',
    type: 'single',
    prompt: 'ต้องการเริ่มงานเมื่อใด?',
    required: true,
    allowSkip: true,
    allowCustom: true,
    options: [
      { id: 'asap', label: 'เร็วที่สุด' },
      { id: '1-3-months', label: 'ใน 1–3 เดือน' },
      { id: 'flexible', label: 'ยืดหยุ่นได้' },
    ],
  },
};

function materialsNotes(
  locale: SupportedLocale,
  hasDocuments: boolean,
): LocalizedQuestion {
  if (locale === 'ru') {
    return {
      id: 'materials-notes',
      type: 'text',
      prompt: hasDocuments
        ? 'Что ещё важно знать подрядчикам и чего нет в загруженных документах? (необязательно)'
        : 'Есть ли предпочтения по материалам или ограничения? (необязательно)',
      required: false,
      allowSkip: true,
      placeholder: 'например, премиум плитка, светильники от заказчика…',
    };
  }
  if (locale === 'th') {
    return {
      id: 'materials-notes',
      type: 'text',
      prompt: hasDocuments
        ? 'มีอะไรที่เอกสารที่อัปโหลดยังไม่ครอบคลุมและผู้รับเหมาควรรู้หรือไม่? (ไม่บังคับ)'
        : 'มีข้อกำหนดวัสดุหรือข้อจำกัดใด ๆ หรือไม่? (ไม่บังคับ)',
      required: false,
      allowSkip: true,
      placeholder: 'เช่น กระเบื้องพรีเมียม, วัสดุที่ลูกค้าจัดหาเอง…',
    };
  }
  return {
    id: 'materials-notes',
    type: 'text',
    prompt: hasDocuments
      ? 'Anything missing from the uploaded documents that contractors should know? (optional)'
      : 'Any material preferences or constraints? (optional)',
    required: false,
    allowSkip: true,
    placeholder: 'e.g. premium tiles, client-supplied fixtures…',
  };
}

function resolveLocale(locale?: string | null): SupportedLocale {
  if (locale && isSupportedLocale(locale)) {
    return locale;
  }
  return DEFAULT_LOCALE;
}

export function fallbackDefaultDescription(
  locale: string | null | undefined,
  title: string,
): string {
  const resolved = resolveLocale(locale);
  if (resolved === 'ru') {
    return `Строительный проект: ${title}. Детали объёма работ уточняются в опросе.`;
  }
  if (resolved === 'th') {
    return `โครงการก่อสร้าง: ${title}. รายละเอียดขอบเขตงานจะได้รับการยืนยันระหว่างการสัมภาษณ์สั้น ๆ`;
  }
  return `Construction project: ${title}. Scope details to be confirmed during intake.`;
}

export function getFallbackPropertyTypeQuestion(
  locale?: string | null,
): IntakeQuestion {
  return { ...PROPERTY_TYPE[resolveLocale(locale)] };
}

export function getFallbackApproxAreaQuestion(
  locale?: string | null,
): IntakeQuestion {
  return { ...APPROX_AREA[resolveLocale(locale)] };
}

export function getFallbackStoreyCountQuestion(
  locale?: string | null,
): IntakeQuestion {
  return { ...STOREY_COUNT[resolveLocale(locale)] };
}

export function getFallbackPoolDepthQuestion(
  locale?: string | null,
): IntakeQuestion {
  return { ...POOL_DEPTH[resolveLocale(locale)] };
}

export function getFallbackPoolPumpQuestion(
  locale?: string | null,
): IntakeQuestion {
  return { ...POOL_PUMP[resolveLocale(locale)] };
}

export function getFallbackSpecialSystemsQuestion(
  locale?: string | null,
  options?: { includePool?: boolean },
): IntakeQuestion {
  const question = { ...SPECIAL_SYSTEMS[resolveLocale(locale)] };
  if (options?.includePool === false) {
    question.options = question.options?.filter((option) => option.id !== 'pool');
  }
  return question;
}

export function getFallbackTimelineQuestion(
  locale?: string | null,
): IntakeQuestion {
  return { ...TIMELINE[resolveLocale(locale)] };
}

export function getFallbackMaterialsNotesQuestion(
  locale: string | null | undefined,
  hasDocuments: boolean,
): IntakeQuestion {
  return materialsNotes(resolveLocale(locale), hasDocuments);
}

const UTILITY_CONNECTIONS: Record<SupportedLocale, LocalizedQuestion> = {
  en: {
    id: 'utility-connections',
    type: 'multi',
    prompt:
      'Which external utility connections are required? (select all that apply)',
    required: true,
    allowSkip: true,
    allowCustom: true,
    options: [
      { id: 'none', label: 'None — internal works only' },
      { id: 'power', label: 'Electrical grid / meter connection' },
      { id: 'water', label: 'Mains water connection' },
      { id: 'sewer', label: 'Sewer / septic connection' },
      { id: 'unknown', label: 'Not sure yet' },
    ],
  },
  ru: {
    id: 'utility-connections',
    type: 'multi',
    prompt:
      'Какие внешние подключения к сетям нужны? (можно выбрать несколько)',
    required: true,
    allowSkip: true,
    allowCustom: true,
    options: [
      { id: 'none', label: 'Не нужны — только внутренние работы' },
      { id: 'power', label: 'Электричество (ввод / счётчик)' },
      { id: 'water', label: 'Водопровод (ввод)' },
      { id: 'sewer', label: 'Канализация / септик' },
      { id: 'unknown', label: 'Пока неясно' },
    ],
  },
  th: {
    id: 'utility-connections',
    type: 'multi',
    prompt: 'ต้องการเชื่อมต่อสาธารณูปโภคภายนอกใดบ้าง? (เลือกได้หลายข้อ)',
    required: true,
    allowSkip: true,
    allowCustom: true,
    options: [
      { id: 'none', label: 'ไม่ต้อง — งานภายในอย่างเดียว' },
      { id: 'power', label: 'ไฟฟ้า / มิเตอร์' },
      { id: 'water', label: 'น้ำประปา' },
      { id: 'sewer', label: 'ท่อระบาย / บำบัดน้ำเสีย' },
      { id: 'unknown', label: 'ยังไม่แน่ใจ' },
    ],
  },
};

const ELECTRICAL_SCOPE: Record<SupportedLocale, LocalizedQuestion> = {
  en: {
    id: 'electrical-scope',
    type: 'multi',
    prompt: 'What should the electrical package include?',
    required: true,
    allowSkip: true,
    allowCustom: true,
    options: [
      { id: 'wiring', label: 'Cabling & outlets only' },
      { id: 'board', label: 'Distribution board / switchgear' },
      { id: 'lighting', label: 'Lighting fixtures' },
      { id: 'specialty-lighting', label: 'Specialty / underwater / designer lights' },
      { id: 'outdoor', label: 'Outdoor / garden lighting' },
    ],
  },
  ru: {
    id: 'electrical-scope',
    type: 'multi',
    prompt: 'Что должно входить в электромонтаж?',
    required: true,
    allowSkip: true,
    allowCustom: true,
    options: [
      { id: 'wiring', label: 'Только кабели и розетки' },
      { id: 'board', label: 'Распределительный щит' },
      { id: 'lighting', label: 'Светильники' },
      { id: 'specialty-lighting', label: 'Специальные / подводные / дизайнерские светильники' },
      { id: 'outdoor', label: 'Уличное / садовое освещение' },
    ],
  },
  th: {
    id: 'electrical-scope',
    type: 'multi',
    prompt: 'งานไฟฟ้าควรครอบคลุมอะไรบ้าง?',
    required: true,
    allowSkip: true,
    allowCustom: true,
    options: [
      { id: 'wiring', label: 'สายไฟและปลั๊กเท่านั้น' },
      { id: 'board', label: 'ตู้ไฟ / สวิตช์บอร์ด' },
      { id: 'lighting', label: 'โคมไฟทั่วไป' },
      { id: 'specialty-lighting', label: 'ไฟพิเศษ / ใต้น้ำ / ดีไซเนอร์' },
      { id: 'outdoor', label: 'ไฟภายนอก / สวน' },
    ],
  },
};

const SANITARY_POINTS: Record<SupportedLocale, LocalizedQuestion> = {
  en: {
    id: 'sanitary-points',
    type: 'single',
    prompt: 'Approximately how many sanitary / wet points are needed?',
    required: true,
    allowSkip: true,
    allowCustom: true,
    options: [
      { id: '1-3', label: '1–3 points' },
      { id: '4-8', label: '4–8 points' },
      { id: '9-plus', label: '9 or more' },
      { id: 'unknown', label: 'Not sure yet' },
    ],
  },
  ru: {
    id: 'sanitary-points',
    type: 'single',
    prompt: 'Примерно сколько сантехнических точек нужно?',
    required: true,
    allowSkip: true,
    allowCustom: true,
    options: [
      { id: '1-3', label: '1–3 точки' },
      { id: '4-8', label: '4–8 точек' },
      { id: '9-plus', label: '9 и больше' },
      { id: 'unknown', label: 'Пока неясно' },
    ],
  },
  th: {
    id: 'sanitary-points',
    type: 'single',
    prompt: 'ต้องการจุดสุขาภิบาล / จุดน้ำประมาณกี่จุด?',
    required: true,
    allowSkip: true,
    allowCustom: true,
    options: [
      { id: '1-3', label: '1–3 จุด' },
      { id: '4-8', label: '4–8 จุด' },
      { id: '9-plus', label: '9 จุดขึ้นไป' },
      { id: 'unknown', label: 'ยังไม่แน่ใจ' },
    ],
  },
};

const POOL_WATER_TREATMENT: Record<SupportedLocale, LocalizedQuestion> = {
  en: {
    id: 'pool-water-treatment',
    type: 'single',
    prompt: 'What water treatment system do you plan?',
    required: true,
    allowSkip: true,
    allowCustom: true,
    options: [
      { id: 'chlorine', label: 'Standard chlorine' },
      { id: 'salt', label: 'Salt chlorination' },
      { id: 'uv-ozone', label: 'Chlorine-free / UV / ozone' },
      { id: 'undecided', label: 'Not decided yet' },
    ],
  },
  ru: {
    id: 'pool-water-treatment',
    type: 'single',
    prompt: 'Какая система водоподготовки планируется?',
    required: true,
    allowSkip: true,
    allowCustom: true,
    options: [
      { id: 'chlorine', label: 'Обычный хлор' },
      { id: 'salt', label: 'Солевой хлоринатор' },
      { id: 'uv-ozone', label: 'Без хлора / УФ / озон' },
      { id: 'undecided', label: 'Ещё не решено' },
    ],
  },
  th: {
    id: 'pool-water-treatment',
    type: 'single',
    prompt: 'วางแผนใช้ระบบบำบัดน้ำแบบใด?',
    required: true,
    allowSkip: true,
    allowCustom: true,
    options: [
      { id: 'chlorine', label: 'คลอรีนมาตรฐาน' },
      { id: 'salt', label: 'เกลือ / salt system' },
      { id: 'uv-ozone', label: 'ไร้คลอรีน / UV /โอโซน' },
      { id: 'undecided', label: 'ยังไม่ได้ตัดสินใจ' },
    ],
  },
};

const POOL_LIGHTING: Record<SupportedLocale, LocalizedQuestion> = {
  en: {
    id: 'pool-lighting',
    type: 'single',
    prompt: 'What underwater / pool lighting is required?',
    required: true,
    allowSkip: true,
    allowCustom: true,
    options: [
      { id: 'none', label: 'None' },
      { id: 'basic', label: 'Basic underwater lights' },
      { id: 'specialty', label: 'Specialty / RGB / designer fixtures' },
      { id: 'undecided', label: 'Not decided yet' },
    ],
  },
  ru: {
    id: 'pool-lighting',
    type: 'single',
    prompt: 'Какое освещение бассейна нужно?',
    required: true,
    allowSkip: true,
    allowCustom: true,
    options: [
      { id: 'none', label: 'Не нужно' },
      { id: 'basic', label: 'Базовые подводные светильники' },
      { id: 'specialty', label: 'Специальные / RGB / дизайнерские' },
      { id: 'undecided', label: 'Ещё не решено' },
    ],
  },
  th: {
    id: 'pool-lighting',
    type: 'single',
    prompt: 'ต้องการไฟสระ / ไฟใต้น้ำแบบใด?',
    required: true,
    allowSkip: true,
    allowCustom: true,
    options: [
      { id: 'none', label: 'ไม่ต้องการ' },
      { id: 'basic', label: 'ไฟใต้น้ำพื้นฐาน' },
      { id: 'specialty', label: 'ไฟพิเศษ / RGB / ดีไซเนอร์' },
      { id: 'undecided', label: 'ยังไม่ได้ตัดสินใจ' },
    ],
  },
};

export function getFallbackUtilityConnectionsQuestion(
  locale?: string | null,
): IntakeQuestion {
  return { ...UTILITY_CONNECTIONS[resolveLocale(locale)] };
}

export function getFallbackElectricalScopeQuestion(
  locale?: string | null,
): IntakeQuestion {
  return { ...ELECTRICAL_SCOPE[resolveLocale(locale)] };
}

export function getFallbackSanitaryPointsQuestion(
  locale?: string | null,
): IntakeQuestion {
  return { ...SANITARY_POINTS[resolveLocale(locale)] };
}

export function getFallbackPoolWaterTreatmentQuestion(
  locale?: string | null,
): IntakeQuestion {
  return { ...POOL_WATER_TREATMENT[resolveLocale(locale)] };
}

export function getFallbackPoolLightingQuestion(
  locale?: string | null,
): IntakeQuestion {
  return { ...POOL_LIGHTING[resolveLocale(locale)] };
}
