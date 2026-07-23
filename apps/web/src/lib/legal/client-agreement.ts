import type { Locale } from '@/lib/i18n';
import {
  LEGAL_CONTACT_EMAIL,
  LEGAL_PLATFORM_NAME,
  LEGAL_PLATFORM_URL,
} from './branding';
import type { LegalDocument } from './types';

const en: LegalDocument = {
  title: 'Client Agreement',
  updatedLabel: 'Last updated: 23 July 2026',
  intro: `This User Agreement ("Agreement") sets out the terms and conditions governing the use of the online ${LEGAL_PLATFORM_NAME} platform (the "Platform") operated at ${LEGAL_PLATFORM_URL} and constitutes a public offer under the applicable laws.`,
  sections: [
    {
      title: '1. Definitions',
      paragraphs: [
        `Platform (Owner) means ${LEGAL_PLATFORM_NAME}, which owns and operates the online marketplace at ${LEGAL_PLATFORM_URL} and provides access to the Platform.`,
        'User (Client) means an individual, legal entity, sole proprietor, or self-employed individual with legal capacity who uses the Platform to browse, request, purchase, or otherwise obtain Products or Construction and Design Services through the Platform.',
        'Construction and Design Services means the planning, design, engineering, architectural, drafting, quantity surveying, project management, construction, renovation, installation, maintenance, inspection, consulting, and other related services that may be offered by independent Service Providers through the Platform. Such services may include, without limitation, the preparation of concepts, drawings, plans, specifications, cost estimates, procurement support, site supervision, construction execution, repairs, remodeling, fit-out works, landscaping, interior design, and other services relating to the design, development, construction, improvement, or maintenance of residential, commercial, industrial, or infrastructure projects.',
        'For the avoidance of doubt, the Platform facilitates the listing, discovery, engagement, and communication between Users and independent Service Providers in relation to Construction and Design Services. Unless expressly stated otherwise, the Platform does not itself provide, perform, supervise, endorse, guarantee, or warrant any Construction and Design Services, and any agreement for such services is solely between the User and the applicable Service Provider.',
        'Product means any physical or digital goods offered for sale by independent Sellers through the Platform.',
        'Seller means an independent legal entity, sole proprietor, self-employed individual, or other independent business that offers Products for sale through the Platform.',
        'Service Provider means an independent legal entity, sole proprietor, self-employed individual, licensed professional, contractor, consultant, or other independent business that offers Construction and Design Services through the Platform.',
      ],
    },
    {
      title: '2. Subject of the Agreement',
      paragraphs: [
        "2.1. The Owner grants the User a non-exclusive, revocable, non-transferable, and free-of-charge right to access and use the Platform's functionality, including user registration, personal account management, searching for Products and Construction and Design Services, communicating with Sellers and Service Providers, requesting quotations, and placing orders or service requests through the Platform.",
        '2.2. The Platform acts solely as an intermediary that facilitates interactions between Users, Sellers, and Service Providers. Any agreement for the purchase of Products or the provision of Construction and Design Services is concluded directly between the User and the respective Seller or Service Provider.',
      ],
    },
    {
      title: '3. Use of the Platform',
      paragraphs: [
        '3.1. The basic functionality of the Platform, including registration, browsing listings, searching for Products and Construction and Design Services, communicating with Sellers and Service Providers, and placing orders or service requests, is provided free of charge unless otherwise stated. The Owner does not charge Users for accessing these basic Platform functions.',
        '3.2. To place an order, submit a request, or engage a Service Provider, the User must complete the registration process and provide accurate, complete, and up-to-date information.',
        '3.3. The Owner is not responsible for the quality, safety, legality, availability, pricing, timeliness, performance, licensing, qualifications, delivery, accuracy of descriptions, or any other characteristics of Products or Construction and Design Services offered by Sellers or Service Providers. Any claims, complaints, disputes, warranties, or liabilities arising from the purchase of Products or the provision of Construction and Design Services shall be resolved directly between the User and the relevant Seller or Service Provider.',
      ],
    },
    {
      title: '4. Personal Data',
      paragraphs: [
        "4.1. By using the Platform, the User consents to the collection, storage, use, processing, and transfer of personal information in accordance with the Platform's Privacy Policy and applicable data protection laws.",
        '4.2. Personal data is processed in accordance with the Privacy Policy published on the Platform.',
      ],
    },
    {
      title: '5. Rights and Obligations of the Parties',
      paragraphs: [
        '5.1. The User agrees to: use the Platform solely for lawful purposes and in accordance with this Agreement; provide accurate, complete, and current information during registration and while using the Platform; maintain the confidentiality of login credentials and passwords and promptly notify the Owner of any unauthorized access to the User’s account; and communicate respectfully with Sellers, Service Providers, and other Users and refrain from submitting false, misleading, or unlawful requests or content.',
        'The User agrees that any Supplier identified, introduced, or engaged through the Platform has been made available to the User solely by virtue of the Platform’s services. The User shall not, directly or indirectly, solicit, negotiate, or contract with such Supplier outside the Platform for the purpose of avoiding the Platform’s fees, commissions, or Terms of Service. The obligations set forth in this Section shall apply during the parties’ use of the Platform and for a period of twenty-four (24) months following the last interaction, introduction, proposal, quotation, or transaction between the User and the Supplier through the Platform.',
        'Any direct or indirect agreement, arrangement, or transaction entered into between a User and a Supplier in violation of this Section shall constitute a material breach of these Terms.',
        'Upon determining that a breach has occurred, the Platform may, in its sole discretion: (a) immediately suspend or permanently terminate the accounts of both the User and the Supplier; (b) deny either party future access to the Platform and its services; and (c) require each breaching party to pay liquidated damages equal to five percent (5%) of the total value of the contract, project, purchase order, or other commercial arrangement entered into outside the Platform.',
        '5.2. The Owner agrees to: make reasonable efforts to ensure the continuous operation of the Platform, subject to technical limitations, maintenance, and circumstances beyond its reasonable control; implement reasonable technical and organizational security measures to protect user accounts and personal information; and provide functionality enabling Users to interact with Sellers and Service Providers through the Platform.',
      ],
    },
    {
      title: '6. Liability and Disclaimer',
      paragraphs: [
        '6.1. The Platform and its services are provided on an “as is” and “as available” basis. The Owner does not warrant that the Platform will operate without interruption, be error-free, or meet the User’s expectations.',
        '6.2. The Owner is not a party to any agreement between a User and a Seller or Service Provider and assumes no responsibility for the acts, omissions, performance, quality of work, professional advice, delays, warranties, contractual obligations, or conduct of any Seller or Service Provider.',
        '6.3. Neither party shall be liable for any failure or delay in performing its obligations where such failure or delay results from circumstances beyond its reasonable control, including events commonly recognized as force majeure.',
      ],
    },
    {
      title: '7. Dispute Resolution',
      paragraphs: [
        `7.1. Before initiating legal proceedings, the User should submit a written complaint to the Platform’s customer support at ${LEGAL_CONTACT_EMAIL}. The Owner will make reasonable efforts to respond within ten (10) business days.`,
        '7.2. Where a dispute relates to a Product or Construction and Design Service, the User agrees to first attempt to resolve the matter directly with the relevant Seller or Service Provider. The Owner may, at its sole discretion, assist in facilitating communications but shall have no obligation to resolve the dispute or participate in any proceedings.',
        '7.3. If the parties are unable to resolve the dispute through negotiation, the dispute shall be resolved by a court or other competent authority in accordance with the applicable laws and jurisdiction.',
      ],
    },
    {
      title: '8. Final Provisions',
      paragraphs: [
        '8.1. This Agreement remains effective until terminated or replaced by a revised version.',
        '8.2. The Owner reserves the right to amend this Agreement at any time by publishing an updated version on the Platform. Continued use of the Platform after publication of the updated Agreement constitutes the User’s acceptance of the revised terms.',
        '8.3. If any provision of this Agreement is held to be invalid or unenforceable, the remaining provisions shall remain in full force and effect.',
        '8.4. This Agreement constitutes the entire agreement between the User and the Owner regarding the use of the Platform and supersedes all prior understandings relating to its subject matter.',
      ],
    },
  ],
};

const ru: LegalDocument = {
  title: 'Клиентское соглашение',
  updatedLabel: 'Обновлено: 23 июля 2026',
  intro: `Настоящее Пользовательское соглашение («Соглашение») определяет условия использования онлайн-платформы ${LEGAL_PLATFORM_NAME} («Платформа»), доступной по адресу ${LEGAL_PLATFORM_URL}, и является публичной офертой в соответствии с применимым правом.`,
  sections: [
    {
      title: '1. Определения',
      paragraphs: [
        `Владелец Платформы означает ${LEGAL_PLATFORM_NAME}, которому принадлежит и который эксплуатирует онлайн-маркетплейс по адресу ${LEGAL_PLATFORM_URL} и предоставляет доступ к Платформе.`,
        'Пользователь (Клиент) означает физическое лицо, юридическое лицо, индивидуального предпринимателя или самозанятого, обладающего правоспособностью, который использует Платформу для поиска, заказа, приобретения или иного получения Товаров либо Строительных и проектных услуг.',
        'Строительные и проектные услуги означают планирование, проектирование, инжиниринг, архитектурные работы, чертежи, сметы, управление проектом, строительство, ремонт, монтаж, обслуживание, инспекции, консалтинг и иные связанные услуги, которые могут предлагать независимые Исполнители через Платформу.',
        'Платформа обеспечивает размещение, поиск, взаимодействие и коммуникацию между Пользователями и независимыми Исполнителями. Если прямо не указано иное, Платформа сама не оказывает, не выполняет, не контролирует и не гарантирует Строительные и проектные услуги; договор на такие услуги заключается исключительно между Пользователем и соответствующим Исполнителем.',
        'Товар означает любые физические или цифровые товары, предлагаемые к продаже независимыми Продавцами через Платформу.',
        'Продавец означает независимое лицо или бизнес, предлагающий Товары через Платформу.',
        'Исполнитель (Service Provider) означает независимое лицо или бизнес, предлагающий Строительные и проектные услуги через Платформу.',
      ],
    },
    {
      title: '2. Предмет Соглашения',
      paragraphs: [
        '2.1. Владелец предоставляет Пользователю неисключительное, отзывное, непередаваемое и безвозмездное право доступа к функциональности Платформы, включая регистрацию, управление аккаунтом, поиск Товаров и услуг, общение с Продавцами и Исполнителями, запрос предложений и размещение заявок.',
        '2.2. Платформа действует исключительно как посредник. Любой договор купли-продажи Товаров или оказания услуг заключается напрямую между Пользователем и соответствующим Продавцом или Исполнителем.',
      ],
    },
    {
      title: '3. Использование Платформы',
      paragraphs: [
        '3.1. Базовая функциональность Платформы предоставляется Пользователям бесплатно, если иное прямо не указано.',
        '3.2. Для размещения заказа, заявки или привлечения Исполнителя Пользователь обязан пройти регистрацию и предоставить точные, полные и актуальные сведения.',
        '3.3. Владелец не отвечает за качество, безопасность, законность, цену, сроки, лицензии, квалификацию и иные характеристики Товаров или услуг, предлагаемых Продавцами и Исполнителями. Споры разрешаются напрямую между Пользователем и соответствующим Продавцом или Исполнителем.',
      ],
    },
    {
      title: '4. Персональные данные',
      paragraphs: [
        '4.1. Используя Платформу, Пользователь соглашается на сбор, хранение, использование, обработку и передачу персональных данных в соответствии с Политикой конфиденциальности Платформы и применимым законодательством.',
        '4.2. Персональные данные обрабатываются согласно Политике конфиденциальности, опубликованной на Платформе.',
      ],
    },
    {
      title: '5. Права и обязанности сторон',
      paragraphs: [
        '5.1. Пользователь обязуется использовать Платформу законно; предоставлять точные сведения; хранить конфиденциальность учётных данных; уважительно взаимодействовать с другими пользователями и не размещать ложный или незаконный контент.',
        'Пользователь соглашается, что любой Поставщик, найденный или привлечённый через Платформу, стал доступен благодаря услугам Платформы. Пользователь не вправе прямо или косвенно заключать сделки с таким Поставщиком вне Платформы с целью обхода комиссий или условий Платформы. Обязательство действует в период использования Платформы и в течение 24 месяцев после последнего взаимодействия через Платформу.',
        'Нарушение этого раздела является существенным нарушением. Платформа может приостановить или закрыть аккаунты сторон, отказать в дальнейшем доступе и потребовать выплату неустойки в размере 5% от суммы сделки, заключённой вне Платформы.',
        '5.2. Владелец обязуется прилагать разумные усилия для работоспособности Платформы, применять разумные меры безопасности и обеспечивать функциональность взаимодействия Пользователей с Продавцами и Исполнителями.',
      ],
    },
    {
      title: '6. Ответственность и отказ от гарантий',
      paragraphs: [
        '6.1. Платформа предоставляется «как есть» и «по мере доступности». Владелец не гарантирует бесперебойную и безошибочную работу.',
        '6.2. Владелец не является стороной договоров между Пользователем и Продавцом/Исполнителем и не отвечает за их действия, качество работ, сроки и обязательства.',
        '6.3. Стороны не отвечают за неисполнение обязательств вследствие обстоятельств непреодолимой силы.',
      ],
    },
    {
      title: '7. Разрешение споров',
      paragraphs: [
        `7.1. До обращения в суд Пользователь направляет письменную жалобу на ${LEGAL_CONTACT_EMAIL}. Владелец по возможности отвечает в течение десяти (10) рабочих дней.`,
        '7.2. Споры по Товарам или услугам Пользователь сначала пытается урегулировать напрямую с Продавцом или Исполнителем. Владелец может содействовать коммуникации, но не обязан разрешать спор.',
        '7.3. При невозможности урегулирования спор разрешается судом или иным компетентным органом по применимому праву.',
      ],
    },
    {
      title: '8. Заключительные положения',
      paragraphs: [
        '8.1. Соглашение действует до прекращения или замены новой редакцией.',
        '8.2. Владелец вправе изменять Соглашение, публикуя обновлённую версию на Платформе. Продолжение использования означает согласие с новой редакцией.',
        '8.3. Недействительность отдельного положения не влияет на остальные.',
        '8.4. Соглашение составляет полное соглашение сторон относительно использования Платформы.',
      ],
    },
  ],
};

const th: LegalDocument = {
  title: 'ข้อตกลงลูกค้า',
  updatedLabel: 'อัปเดตล่าสุด: 23 กรกฎาคม 2026',
  intro: `ข้อตกลงผู้ใช้ฉบับนี้ ("ข้อตกลง") กำหนดเงื่อนไขการใช้แพลตฟอร์มออนไลน์ ${LEGAL_PLATFORM_NAME} ("แพลตฟอร์ม") ที่ ${LEGAL_PLATFORM_URL} และถือเป็นคำเสนอต่อสาธารณะตามกฎหมายที่เกี่ยวข้อง`,
  sections: [
    {
      title: '1. คำนิยาม',
      paragraphs: [
        `เจ้าของแพลตฟอร์ม หมายถึง ${LEGAL_PLATFORM_NAME} ซึ่งเป็นเจ้าของและดำเนินตลาดกลางออนไลน์ที่ ${LEGAL_PLATFORM_URL} และให้สิทธิ์เข้าใช้แพลตฟอร์ม`,
        'ผู้ใช้ (ลูกค้า) หมายถึง บุคคล นิติบุคคล ผู้ประกอบการรายเดียว หรือผู้ประกอบอาชีพอิสระที่มีความสามารถทางกฎหมาย ซึ่งใช้แพลตฟอร์มเพื่อค้นหา ร้องขอ ซื้อ หรือรับสินค้า หรือบริการก่อสร้างและออกแบบ',
        'บริการก่อสร้างและออกแบบ หมายถึง การวางแผน ออกแบบ วิศวกรรม สถาปัตยกรรม การเขียนแบบ ปริมาณงาน การบริหารโครงการ ก่อสร้าง ปรับปรุง ติดตั้ง บำรุงรักษา ตรวจสอบ ที่ปรึกษา และบริการที่เกี่ยวข้อง ซึ่งผู้ให้บริการอิสระอาจเสนอผ่านแพลตฟอร์ม',
        'แพลตฟอร์มเป็นเพียงสื่อกลางในการค้นหาและติดต่อระหว่างผู้ใช้กับผู้ให้บริการอิสระ เว้นแต่ระบุไว้เป็นอย่างอื่น แพลตฟอร์มไม่ได้ให้ ควบคุม หรือรับประกันบริการก่อสร้างและออกแบบเอง สัญญาสำหรับบริการดังกล่าวอยู่ระหว่างผู้ใช้กับผู้ให้บริการที่เกี่ยวข้องเท่านั้น',
        'สินค้า หมายถึง สินค้ากายภาพหรือดิจิทัลที่ผู้ขายอิสระเสนอขายผ่านแพลตฟอร์ม',
        'ผู้ขาย หมายถึง ธุรกิจอิสระที่เสนอสินค้าผ่านแพลตฟอร์ม',
        'ผู้ให้บริการ หมายถึง ธุรกิจอิสระที่เสนอบริการก่อสร้างและออกแบบผ่านแพลตฟอร์ม',
      ],
    },
    {
      title: '2. วัตถุแห่งข้อตกลง',
      paragraphs: [
        '2.1. เจ้าของให้สิทธิ์ผู้ใช้แบบไม่ผูกขาด เพิกถอนได้ โอนไม่ได้ และไม่คิดค่าใช้จ่าย ในการเข้าใช้ฟังก์ชันของแพลตฟอร์ม รวมถึงการลงทะเบียน จัดการบัญชี ค้นหาสินค้าและบริการ สื่อสารกับผู้ขายและผู้ให้บริการ ขอใบเสนอราคา และส่งคำสั่งหรือคำขอ',
        '2.2. แพลตฟอร์มทำหน้าที่เป็นตัวกลางเท่านั้น สัญญาซื้อขายสินค้าหรือจ้างบริการจะเกิดขึ้นโดยตรงระหว่างผู้ใช้กับผู้ขายหรือผู้ให้บริการ',
      ],
    },
    {
      title: '3. การใช้แพลตฟอร์ม',
      paragraphs: [
        '3.1. ฟังก์ชันพื้นฐานของแพลตฟอร์มให้บริการแก่ผู้ใช้โดยไม่คิดค่าใช้จ่าย เว้นแต่ระบุไว้เป็นอย่างอื่น',
        '3.2. เพื่อสั่งซื้อ ส่งคำขอ หรือว่าจ้างผู้ให้บริการ ผู้ใช้ต้องลงทะเบียนและให้ข้อมูลที่ถูกต้อง ครบถ้วน และเป็นปัจจุบัน',
        '3.3. เจ้าของไม่รับผิดชอบต่อคุณภาพ ความปลอดภัย ความชอบด้วยกฎหมาย ราคา กำหนดเวลา ใบอนุญาต หรือคุณสมบัติอื่นของสินค้าหรือบริการ ข้อพิพาทให้ระงับระหว่างผู้ใช้กับผู้ขายหรือผู้ให้บริการโดยตรง',
      ],
    },
    {
      title: '4. ข้อมูลส่วนบุคคล',
      paragraphs: [
        '4.1. การใช้แพลตฟอร์มถือว่าผู้ใช้ยินยอมให้เก็บ ใช้ ประมวลผล และโอนข้อมูลส่วนบุคคลตามนโยบายความเป็นส่วนตัวและกฎหมายคุ้มครองข้อมูล',
        '4.2. ข้อมูลส่วนบุคคลประมวลผลตามนโยบายความเป็นส่วนตัวที่เผยแพร่บนแพลตฟอร์ม',
      ],
    },
    {
      title: '5. สิทธิและหน้าที่ของคู่สัญญา',
      paragraphs: [
        '5.1. ผู้ใช้ตกลงใช้แพลตฟอร์มโดยชอบด้วยกฎหมาย ให้ข้อมูลที่ถูกต้อง รักษาความลับของข้อมูลเข้าสู่ระบบ และสื่อสารอย่างสุภาพโดยไม่ส่งเนื้อหาเท็จหรือผิดกฎหมาย',
        'ผู้ใช้ตกลงว่าผู้ให้บริการใดที่พบหรือว่าจ้างผ่านแพลตฟอร์มมีขึ้นเพราะบริการของแพลตฟอร์ม ผู้ใช้ต้องไม่ติดต่อ เจรจา หรือทำสัญญานอกแพลตฟอร์มเพื่อเลี่ยงค่าธรรมเนียม พันธะนี้มีผลระหว่างการใช้และ 24 เดือนหลังการติดต่อครั้งสุดท้ายผ่านแพลตฟอร์ม',
        'การฝ่าฝืนถือเป็นการผิดสัญญาอย่างร้ายแรง แพลตฟอร์มอาจระงับหรือยกเลิกบัญชี ปฏิเสธการเข้าใช้ในอนาคต และเรียกค่าเสียหายกำหนดไว้ร้อยละ 5 ของมูลค่าธุรกรรมนอกแพลตฟอร์ม',
        '5.2. เจ้าของตกลงใช้ความพยายามตามสมควรเพื่อให้แพลตฟอร์มใช้งานได้ มีมาตรการรักษาความปลอดภัยตามสมควร และจัดเครื่องมือให้ผู้ใช้ติดต่อผู้ขายและผู้ให้บริการ',
      ],
    },
    {
      title: '6. ความรับผิดและการปฏิเสธการรับประกัน',
      paragraphs: [
        '6.1. แพลตฟอร์มให้บริการแบบ "ตามสภาพ" และ "ตามที่มี" เจ้าของไม่รับประกันว่าจะทำงานต่อเนื่องหรือปราศจากข้อผิดพลาด',
        '6.2. เจ้าของไม่ใช่คู่สัญญาในข้อตกลงระหว่างผู้ใช้กับผู้ขายหรือผู้ให้บริการ และไม่รับผิดต่อการกระทำ คุณภาพงาน ความล่าช้า หรือภาระผูกพันของบุคคลเหล่านั้น',
        '6.3. คู่สัญญาไม่รับผิดต่อความล้มเหลวที่เกิดจากเหตุสุดวิสัย',
      ],
    },
    {
      title: '7. การระงับข้อพิพาท',
      paragraphs: [
        `7.1. ก่อนดำเนินคดี ผู้ใช้ควรส่งคำร้องเป็นลายลักษณ์อักษรไปที่ ${LEGAL_CONTACT_EMAIL} เจ้าของจะพยายามตอบภายในสิบ (10) วันทำการ`,
        '7.2. ข้อพิพาทเกี่ยวกับสินค้าหรือบริการ ผู้ใช้ต้องพยายามระงับกับผู้ขายหรือผู้ให้บริการก่อน เจ้าของอาจช่วยสื่อสารแต่ไม่มีหน้าที่ระงับข้อพิพาท',
        '7.3. หากเจรจาไม่สำเร็จ ให้ระงับโดยศาลหรือหน่วยงานที่มีอำนาจตามกฎหมายที่ใช้บังคับ',
      ],
    },
    {
      title: '8. บทบัญญัติสุดท้าย',
      paragraphs: [
        '8.1. ข้อตกลงมีผลจนกว่าจะสิ้นสุดหรือถูกแทนที่ด้วยฉบับปรับปรุง',
        '8.2. เจ้าของสงวนสิทธิ์แก้ไขข้อตกลงโดยเผยแพร่ฉบับใหม่บนแพลตฟอร์ม การใช้ต่อถือว่ายอมรับเงื่อนไขใหม่',
        '8.3. หากข้อใดใช้บังคับไม่ได้ ข้ออื่นยังมีผล',
        '8.4. ข้อตกลงนี้เป็นข้อตกลงทั้งหมดระหว่างผู้ใช้กับเจ้าของเกี่ยวกับการใช้แพลตฟอร์ม',
      ],
    },
  ],
};

const byLocale: Record<Locale, LegalDocument> = { en, ru, th };

export function getClientAgreement(locale: Locale): LegalDocument {
  return byLocale[locale] ?? byLocale.en;
}
