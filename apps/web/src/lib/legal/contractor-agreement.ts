import type { Locale } from '@/lib/i18n';
import {
  LEGAL_CONTACT_EMAIL,
  LEGAL_PLATFORM_NAME,
  LEGAL_PLATFORM_URL,
} from './branding';
import type { LegalDocument } from './types';

const en: LegalDocument = {
  title: 'Contractor Agreement',
  updatedLabel: 'Last updated: 23 July 2026',
  intro: `This Platform Partner Agreement ("Agreement") sets out the terms and conditions governing the use of the ${LEGAL_PLATFORM_NAME} online platform (the "Platform") at ${LEGAL_PLATFORM_URL} by Service Providers and Sellers and constitutes a public offer under the applicable laws.`,
  sections: [
    {
      title: '1. Definitions',
      paragraphs: [
        `Platform (Owner) means ${LEGAL_PLATFORM_NAME}, which owns and operates the online marketplace at ${LEGAL_PLATFORM_URL} and provides access to the Platform.`,
        'Partner means any independent legal entity, sole proprietor, self-employed individual, licensed professional, contractor, consultant, supplier, manufacturer, distributor, retailer, or other independent business registered on the Platform as either a Seller or a Service Provider.',
        'Seller means a Partner that offers Products for sale through the Platform.',
        'Service Provider means a Partner that offers Construction and Design Services through the Platform.',
        'Construction and Design Services means planning, design, engineering, architectural, drafting, quantity surveying, project management, construction, renovation, installation, maintenance, inspection, consulting, and other related services that may be offered through the Platform, including without limitation the preparation of concepts, drawings, plans, specifications, cost estimates, procurement support, site supervision, construction execution, repairs, remodeling, fit-out works, landscaping, interior design, and other services relating to residential, commercial, industrial, or infrastructure projects.',
        'Product means any physical or digital goods offered for sale by a Seller through the Platform.',
        'Client means an individual, legal entity, sole proprietor, or self-employed person who uses the Platform to purchase Products or engage Construction and Design Services.',
        'Contract Amount means the total monetary value agreed between the Partner and the Client for the supply of Products and/or provision of Services, including taxes where required by applicable law.',
        'Grace Period means the promotional period designated by the Platform during which no Platform Fee is charged. The duration and expiration date of the Grace Period shall be determined and published by the Platform.',
      ],
    },
    {
      title: '2. Subject of the Agreement',
      paragraphs: [
        '2.1. The Platform grants the Partner a non-exclusive, revocable, non-transferable right to use the Platform to advertise, market, offer, negotiate, and conclude transactions with Clients.',
        '2.2. The Platform acts solely as an intermediary facilitating communication and transactions between Clients and Partners.',
        '2.3. The Partner remains solely responsible for all Products, Services, quotations, pricing, warranties, licenses, permits, taxes, contractual obligations, and legal compliance relating to transactions concluded with Clients.',
      ],
    },
    {
      title: '3. Platform Fee and Payment Terms',
      paragraphs: [
        '3.1. Grace Period. During the Grace Period, the Partner may use the Platform without payment of any Platform Fee.',
        '3.2. Platform Fee. Following expiration of the Grace Period, the Partner shall pay the Platform a service fee equal to two percent (2%) of the total Contract Amount for every contract concluded with a Client introduced through the Platform. The Platform Fee becomes payable regardless of whether the contract is signed electronically, in writing, verbally confirmed, or otherwise concluded between the Partner and the Client introduced through the Platform.',
        '3.3. Payment Schedule. For each contract concluded with a Client after expiration of the Grace Period, the Partner agrees to pay the Platform as follows: (a) a non-refundable down payment equivalent to Twenty United States Dollars (USD 20) immediately upon execution of the agreement between the Partner and the Client; and (b) the remaining balance of the applicable 2% Platform Fee no later than thirty (30) calendar days after the date the agreement with the Client is signed. If the total Platform Fee is less than USD 20, the Partner shall pay only the actual amount of the Platform Fee.',
        '3.4. Late Payments. Any overdue payment may accrue interest at the rate of 0.05% for each day of delay. The Platform may suspend or terminate the Partner’s account until all outstanding amounts have been paid.',
      ],
    },
    {
      title: '4. Use of the Platform',
      paragraphs: [
        '4.1. The Partner shall maintain accurate, complete, and current registration information.',
        '4.2. The Partner is solely responsible for all information, descriptions, pricing, quotations, schedules, qualifications, licenses, certifications, and representations published on the Platform.',
        '4.3. The Platform may remove listings or suspend accounts that violate this Agreement or applicable law.',
      ],
    },
    {
      title: '5. Rights and Obligations',
      paragraphs: [
        '5.1. The Partner agrees to: use the Platform only for lawful business purposes; provide truthful, accurate, and complete information; maintain all licenses, permits, certifications, and insurance required by applicable law; deliver Products and Services professionally and in accordance with applicable laws and contractual obligations; maintain confidentiality of account credentials; and pay all Platform Fees in accordance with this Agreement.',
        'Non-Circumvention. The Partner acknowledges that every Client introduced through the Platform has been identified solely through the Platform’s services. The Partner shall not directly or indirectly encourage, solicit, negotiate with, or enter into arrangements with any Client introduced through the Platform for the purpose of avoiding the Platform Fee. This obligation applies during the Partner’s use of the Platform and for a period of twenty-four (24) months following the last communication, quotation, proposal, introduction, or transaction with the Client through the Platform.',
        'Any agreement entered into in violation of this Section shall constitute a material breach of this Agreement. Upon determining that such breach has occurred, the Platform may, at its sole discretion: immediately suspend or permanently terminate the Partner’s account; prohibit future use of the Platform; and require the Partner to pay liquidated damages equal to five percent (5%) of the total Contract Amount of the transaction conducted outside the Platform.',
        '5.2. The Platform agrees to: make reasonable efforts to maintain Platform availability; implement reasonable technical and organizational measures to protect Partner information; and provide tools enabling communication between Partners and Clients.',
      ],
    },
    {
      title: '6. Liability',
      paragraphs: [
        '6.1. The Platform is provided on an “as is” and “as available” basis.',
        '6.2. The Platform is not a party to any contract between a Partner and a Client and assumes no responsibility for the quality, legality, performance, delivery, warranties, payment, or fulfillment of Products or Services.',
        '6.3. The Partner shall indemnify and hold harmless the Platform from claims arising out of the Partner’s Products, Services, negligence, contractual breaches, or violations of law.',
        '6.4. Neither party shall be liable for delays or failures caused by force majeure events beyond its reasonable control.',
      ],
    },
    {
      title: '7. Dispute Resolution',
      paragraphs: [
        `7.1. Before commencing legal proceedings, the Partner shall submit a written complaint to ${LEGAL_CONTACT_EMAIL}. The Platform shall make reasonable efforts to respond within ten (10) business days.`,
        '7.2. Disputes between the Partner and a Client shall be resolved directly between those parties. The Platform may assist in communications but has no obligation to participate in or resolve such disputes.',
        '7.3. Any dispute arising between the Platform and the Partner under this Agreement shall be resolved by the competent courts in accordance with applicable law.',
      ],
    },
    {
      title: '8. Term and Termination',
      paragraphs: [
        '8.1. This Agreement becomes effective upon the Partner’s registration on the Platform and remains in force until terminated.',
        '8.2. The Platform may suspend or terminate the Partner’s account immediately for: non-payment of Platform Fees; fraudulent activity; breach of this Agreement; unlawful conduct; or conduct damaging to the Platform’s reputation. Termination shall not affect any accrued payment obligations.',
      ],
    },
    {
      title: '9. Final Provisions',
      paragraphs: [
        '9.1. The Platform may amend this Agreement by publishing an updated version on the Platform. Continued use of the Platform following publication constitutes acceptance of the revised Agreement.',
        '9.2. If any provision of this Agreement is held invalid or unenforceable, the remaining provisions shall remain in full force and effect.',
        '9.3. This Agreement constitutes the entire agreement between the Platform and the Partner concerning use of the Platform and supersedes all prior understandings relating to its subject matter.',
      ],
    },
  ],
};

const ru: LegalDocument = {
  title: 'Соглашение подрядчика',
  updatedLabel: 'Обновлено: 23 июля 2026',
  intro: `Настоящее Партнёрское соглашение («Соглашение») определяет условия использования онлайн-платформы ${LEGAL_PLATFORM_NAME} («Платформа») по адресу ${LEGAL_PLATFORM_URL} Исполнителями и Продавцами и является публичной офертой в соответствии с применимым правом.`,
  sections: [
    {
      title: '1. Определения',
      paragraphs: [
        `Владелец Платформы означает ${LEGAL_PLATFORM_NAME}, которому принадлежит и который эксплуатирует онлайн-маркетплейс по адресу ${LEGAL_PLATFORM_URL}.`,
        'Партнёр означает независимое лицо или бизнес, зарегистрированный на Платформе как Продавец или Исполнитель услуг.',
        'Продавец означает Партнёра, предлагающего Товары через Платформу.',
        'Исполнитель означает Партнёра, предлагающего Строительные и проектные услуги через Платформу.',
        'Строительные и проектные услуги включают планирование, проектирование, строительство, ремонт, монтаж, консалтинг и иные связанные услуги.',
        'Клиент означает лицо, использующее Платформу для покупки Товаров или заказа услуг.',
        'Сумма договора означает общую денежную стоимость, согласованную между Партнёром и Клиентом, включая налоги, если требуется законом.',
        'Льготный период означает промо-период, в течение которого Платформенный сбор не взимается. Срок определяется и публикуется Платформой.',
      ],
    },
    {
      title: '2. Предмет Соглашения',
      paragraphs: [
        '2.1. Платформа предоставляет Партнёру неисключительное, отзывное, непередаваемое право использовать Платформу для рекламы, предложения, переговоров и заключения сделок с Клиентами.',
        '2.2. Платформа действует исключительно как посредник.',
        '2.3. Партнёр самостоятельно отвечает за Товары, услуги, цены, гарантии, лицензии, налоги и соблюдение закона по сделкам с Клиентами.',
      ],
    },
    {
      title: '3. Платформенный сбор и оплата',
      paragraphs: [
        '3.1. В Льготный период Партнёр может пользоваться Платформой без оплаты Платформенного сбора.',
        '3.2. После окончания Льготного периода Партнёр уплачивает Платформе сервисный сбор в размере двух процентов (2%) от Суммы договора по каждому договору с Клиентом, привлечённым через Платформу, независимо от формы заключения договора.',
        '3.3. График оплаты: (a) невозвратный аванс, эквивалентный 20 USD, сразу после заключения соглашения с Клиентом; (b) остаток 2% сбора — не позднее 30 календарных дней после подписания. Если весь сбор меньше 20 USD, уплачивается только фактическая сумма сбора.',
        '3.4. Просрочка может облагаться процентами 0,05% за каждый день задержки. Платформа может приостановить или закрыть аккаунт до погашения задолженности.',
      ],
    },
    {
      title: '4. Использование Платформы',
      paragraphs: [
        '4.1. Партнёр поддерживает точные и актуальные регистрационные данные.',
        '4.2. Партнёр отвечает за сведения, описания, цены, сроки, лицензии и заявления, опубликованные на Платформе.',
        '4.3. Платформа может удалять объявления или приостанавливать аккаунты при нарушении Соглашения или закона.',
      ],
    },
    {
      title: '5. Права и обязанности',
      paragraphs: [
        '5.1. Партнёр обязуется использовать Платформу законно; предоставлять правдивые сведения; иметь необходимые лицензии и страховки; исполнять обязательства перед Клиентами; хранить конфиденциальность учётных данных; уплачивать сборы.',
        'Антиобход. Партнёр не вправе прямо или косвенно заключать сделки с Клиентами, привлечёнными через Платформу, с целью обхода сбора. Обязательство действует в период использования и 24 месяца после последнего взаимодействия через Платформу.',
        'Нарушение является существенным. Платформа может закрыть аккаунт, отказать в доступе и потребовать неустойку в размере 5% от Суммы договора по сделке вне Платформы.',
        '5.2. Платформа обязуется прилагать разумные усилия для доступности сервиса, защиты данных Партнёра и предоставления инструментов коммуникации с Клиентами.',
      ],
    },
    {
      title: '6. Ответственность',
      paragraphs: [
        '6.1. Платформа предоставляется «как есть» и «по мере доступности».',
        '6.2. Платформа не является стороной договора между Партнёром и Клиентом и не отвечает за качество, законность, исполнение, оплату или поставку.',
        '6.3. Партнёр возмещает Платформе убытки по претензиям, связанным с Товарами, услугами, небрежностью или нарушением закона Партнёром.',
        '6.4. Стороны не отвечают за задержки вследствие форс-мажора.',
      ],
    },
    {
      title: '7. Разрешение споров',
      paragraphs: [
        `7.1. До суда Партнёр направляет письменную жалобу на ${LEGAL_CONTACT_EMAIL}. Платформа по возможности отвечает в течение десяти (10) рабочих дней.`,
        '7.2. Споры между Партнёром и Клиентом разрешаются ими напрямую. Платформа может содействовать, но не обязана участвовать.',
        '7.3. Споры между Платформой и Партнёром разрешаются компетентными судами по применимому праву.',
      ],
    },
    {
      title: '8. Срок и прекращение',
      paragraphs: [
        '8.1. Соглашение вступает в силу с регистрации Партнёра и действует до прекращения.',
        '8.2. Платформа может немедленно приостановить или закрыть аккаунт за неуплату, мошенничество, нарушение Соглашения, незаконные действия или ущерб репутации. Прекращение не отменяет уже возникшие обязательства по оплате.',
      ],
    },
    {
      title: '9. Заключительные положения',
      paragraphs: [
        '9.1. Платформа может изменять Соглашение, публикуя новую версию. Продолжение использования означает согласие.',
        '9.2. Недействительность отдельного положения не влияет на остальные.',
        '9.3. Соглашение составляет полное соглашение сторон относительно использования Платформы.',
      ],
    },
  ],
};

const th: LegalDocument = {
  title: 'ข้อตกลงผู้รับเหมา',
  updatedLabel: 'อัปเดตล่าสุด: 23 กรกฎาคม 2026',
  intro: `ข้อตกลงพันธมิตรแพลตฟอร์มฉบับนี้ ("ข้อตกลง") กำหนดเงื่อนไขการใช้แพลตฟอร์มออนไลน์ ${LEGAL_PLATFORM_NAME} ("แพลตฟอร์ม") ที่ ${LEGAL_PLATFORM_URL} โดยผู้ให้บริการและผู้ขาย และถือเป็นคำเสนอต่อสาธารณะตามกฎหมายที่เกี่ยวข้อง`,
  sections: [
    {
      title: '1. คำนิยาม',
      paragraphs: [
        `เจ้าของแพลตฟอร์ม หมายถึง ${LEGAL_PLATFORM_NAME} ซึ่งเป็นเจ้าของและดำเนินตลาดกลางที่ ${LEGAL_PLATFORM_URL}`,
        'พันธมิตร หมายถึง ธุรกิจอิสระที่ลงทะเบียนบนแพลตฟอร์มในฐานะผู้ขายหรือผู้ให้บริการ',
        'ผู้ขาย หมายถึง พันธมิตรที่เสนอสินค้าผ่านแพลตฟอร์ม',
        'ผู้ให้บริการ หมายถึง พันธมิตรที่เสนอบริการก่อสร้างและออกแบบผ่านแพลตฟอร์ม',
        'ลูกค้า หมายถึง บุคคลที่ใช้แพลตฟอร์มเพื่อซื้อสินค้าหรือว่าจ้างบริการ',
        'มูลค่าสัญญา หมายถึง มูลค่ารวมที่พันธมิตรและลูกค้าตกลงกัน รวมภาษีหากกฎหมายกำหนด',
        'ระยะเวลาผ่อนผัน หมายถึงช่วงโปรโมชันที่แพลตฟอร์มไม่เรียกเก็บค่าธรรมเนียม โดยระยะเวลาจะประกาศโดยแพลตฟอร์ม',
      ],
    },
    {
      title: '2. วัตถุแห่งข้อตกลง',
      paragraphs: [
        '2.1. แพลตฟอร์มให้สิทธิ์พันธมิตรแบบไม่ผูกขาด เพิกถอนได้ โอนไม่ได้ ในการโฆษณา เสนอ เจรจา และทำธุรกรรมกับลูกค้า',
        '2.2. แพลตฟอร์มเป็นเพียงตัวกลาง',
        '2.3. พันธมิตรรับผิดชอบแต่เพียงผู้เดียวต่อสินค้า บริการ ราคา การรับประกัน ใบอนุญาต ภาษี และภาระตามกฎหมายของธุรกรรมกับลูกค้า',
      ],
    },
    {
      title: '3. ค่าธรรมเนียมแพลตฟอร์มและการชำระเงิน',
      paragraphs: [
        '3.1. ในระยะเวลาผ่อนผัน พันธมิตรใช้แพลตฟอร์มได้โดยไม่ต้องชำระค่าธรรมเนียม',
        '3.2. หลังสิ้นสุดระยะเวลาผ่อนผัน พันธมิตรชำระค่าบริการร้อยละ 2 ของมูลค่าสัญญาสำหรับทุกสัญญาที่ทำกับลูกค้าซึ่งแนะนำผ่านแพลตฟอร์ม ไม่ว่าจะลงนามในรูปแบบใด',
        '3.3. ตารางชำระ: (ก) เงินดาวน์ไม่คืนจำนวนเทียบเท่า 20 ดอลลาร์สหรัฐทันทีเมื่อทำสัญญากับลูกค้า และ (ข) ส่วนที่เหลือของค่าธรรมเนียม 2% ภายใน 30 วันปฏิทินหลังลงนาม หากค่าธรรมเนียมรวมน้อยกว่า 20 ดอลลาร์สหรัฐ ให้ชำระเฉพาะจำนวนจริง',
        '3.4. การชำระล่าช้าอาจคิดดอกเบี้ยร้อยละ 0.05 ต่อวัน แพลตฟอร์มอาจระงับหรือยกเลิกบัญชีจนกว่าจะชำระครบ',
      ],
    },
    {
      title: '4. การใช้แพลตฟอร์ม',
      paragraphs: [
        '4.1. พันธมิตรต้องรักษาข้อมูลลงทะเบียนให้ถูกต้องและเป็นปัจจุบัน',
        '4.2. พันธมิตรรับผิดชอบข้อมูล คำอธิบาย ราคา ใบเสนอราคา กำหนดเวลา และใบอนุญาตที่เผยแพร่บนแพลตฟอร์ม',
        '4.3. แพลตฟอร์มอาจลบประกาศหรือระงับบัญชีที่ละเมิดข้อตกลงหรือกฎหมาย',
      ],
    },
    {
      title: '5. สิทธิและหน้าที่',
      paragraphs: [
        '5.1. พันธมิตรตกลงใช้แพลตฟอร์มโดยชอบ ให้ข้อมูลจริง มีใบอนุญาตและประกันที่จำเป็น ส่งมอบสินค้า/บริการอย่างมืออาชีพ รักษาความลับบัญชี และชำระค่าธรรมเนียม',
        'ห้ามหลีกเลี่ยง พันธมิตรต้องไม่ติดต่อหรือทำข้อตกลงกับลูกค้าที่แนะนำผ่านแพลตฟอร์มเพื่อเลี่ยงค่าธรรมเนียม พันธะนี้มีผลระหว่างการใช้และ 24 เดือนหลังการติดต่อครั้งสุดท้ายผ่านแพลตฟอร์ม',
        'การฝ่าฝืนถือเป็นการผิดสัญญาอย่างร้ายแรง แพลตฟอร์มอาจระงับบัญชี ห้ามใช้ในอนาคต และเรียกค่าเสียหายกำหนดไว้ร้อยละ 5 ของมูลค่าสัญญานอกแพลตฟอร์ม',
        '5.2. แพลตฟอร์มตกลงใช้ความพยายามตามสมควรเพื่อความพร้อมใช้ ปกป้องข้อมูลพันธมิตร และจัดเครื่องมือสื่อสารกับลูกค้า',
      ],
    },
    {
      title: '6. ความรับผิด',
      paragraphs: [
        '6.1. แพลตฟอร์มให้บริการแบบ "ตามสภาพ" และ "ตามที่มี"',
        '6.2. แพลตฟอร์มไม่ใช่คู่สัญญาในสัญญาระหว่างพันธมิตรกับลูกค้า และไม่รับผิดต่อคุณภาพ ความชอบด้วยกฎหมาย การส่งมอบ การรับประกัน หรือการชำระเงิน',
        '6.3. พันธมิตรต้องชดใช้ความเสียหายให้แพลตฟอร์มจากข้อเรียกร้องที่เกิดจากสินค้า บริการ ความประมาท หรือการละเมิดกฎหมายของพันธมิตร',
        '6.4. คู่สัญญาไม่รับผิดต่อความล่าช้าจากเหตุสุดวิสัย',
      ],
    },
    {
      title: '7. การระงับข้อพิพาท',
      paragraphs: [
        `7.1. ก่อนดำเนินคดี พันธมิตรส่งคำร้องเป็นลายลักษณ์อักษรไปที่ ${LEGAL_CONTACT_EMAIL} แพลตฟอร์มจะพยายามตอบภายในสิบ (10) วันทำการ`,
        '7.2. ข้อพิพาทระหว่างพันธมิตรกับลูกค้าให้ระงับระหว่างกันเอง แพลตฟอร์มอาจช่วยสื่อสารแต่ไม่มีหน้าที่เข้าร่วม',
        '7.3. ข้อพิพาทระหว่างแพลตฟอร์มกับพันธมิตรให้ระงับโดยศาลที่มีอำนาจตามกฎหมายที่ใช้บังคับ',
      ],
    },
    {
      title: '8. ระยะเวลาและการสิ้นสุด',
      paragraphs: [
        '8.1. ข้อตกลงมีผลเมื่อพันธมิตรลงทะเบียนและมีผลจนกว่าจะสิ้นสุด',
        '8.2. แพลตฟอร์มอาจระงับหรือยกเลิกบัญชีทันทีหากไม่ชำระค่าธรรมเนียม มีการฉ้อโกง ละเมิดข้อตกลง ทำผิดกฎหมาย หรือทำความเสียหายต่อชื่อเสียง การสิ้นสุดไม่กระทบภาระชำระที่เกิดขึ้นแล้ว',
      ],
    },
    {
      title: '9. บทบัญญัติสุดท้าย',
      paragraphs: [
        '9.1. แพลตฟอร์มอาจแก้ไขข้อตกลงโดยเผยแพร่ฉบับใหม่ การใช้ต่อถือว่ายอมรับ',
        '9.2. หากข้อใดใช้บังคับไม่ได้ ข้ออื่นยังมีผล',
        '9.3. ข้อตกลงนี้เป็นข้อตกลงทั้งหมดระหว่างแพลตฟอร์มกับพันธมิตรเกี่ยวกับการใช้แพลตฟอร์ม',
      ],
    },
  ],
};

const byLocale: Record<Locale, LegalDocument> = { en, ru, th };

export function getContractorAgreement(locale: Locale): LegalDocument {
  return byLocale[locale] ?? byLocale.en;
}
