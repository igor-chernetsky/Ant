import type { Locale } from '@/lib/i18n';
import type { LegalDocument } from './types';

const en: LegalDocument = {
  title: 'Privacy Policy',
  updatedLabel: 'Last updated: 14 July 2026',
  intro:
    'This Privacy Policy explains how Ant (“we”, “us”) collects, uses, and protects personal information when you use the Ant construction marketplace website and related services (the “Service”).',
  sections: [
    {
      title: '1. Who we are',
      paragraphs: [
        'Ant is a construction marketplace that helps clients publish projects and receive contractor proposals. For privacy questions about this Service, contact us through your Ant account or using the contact details published on the website.',
      ],
    },
    {
      title: '2. Information we collect',
      paragraphs: [
        'Account information: name, email address, preferred language, role (client, contractor, or designer), and authentication data processed via our identity provider.',
        'Profile and business details: company name, service regions, specialties, verification documents, and portfolio materials you choose to upload.',
        'Project and tender data: project descriptions, documents, clarifications, bids, commercial proposal terms, messages, and contract-related records needed to run the marketplace.',
        'Usage and technical data: device and browser information, approximate location derived from network data, cookies or similar technologies, and logs needed for security and performance.',
      ],
    },
    {
      title: '3. How we use information',
      paragraphs: [
        'We use personal information to operate and improve the Service; create and manage accounts; match clients and contractors; process tenders, bids, and notifications; provide estimates and support features; verify contractors; prevent fraud and abuse; comply with legal obligations; and communicate about the Service.',
        'We do not sell your personal information. We may share limited data with service providers that host, authenticate, store files, send email, or help us operate the platform, under appropriate contractual safeguards.',
      ],
    },
    {
      title: '4. Legal bases',
      paragraphs: [
        'Where required by applicable law, we process personal information based on contract performance (to provide the Service you requested), legitimate interests (security, product improvement, marketplace integrity), consent (where we ask for it), and legal obligations.',
      ],
    },
    {
      title: '5. Project visibility and messaging',
      paragraphs: [
        'Information you include in public or tender-visible project materials may be seen by other users according to project and tender settings. Messages and commercial proposals are shared with the counterparties involved in that project or bid.',
        'Do not upload sensitive documents you are not authorised to share. You remain responsible for the content you submit.',
      ],
    },
    {
      title: '6. Retention',
      paragraphs: [
        'We retain personal information for as long as your account is active and as needed to provide the Service, resolve disputes, enforce agreements, and meet legal, tax, or accounting requirements. Some records related to tenders and contracts may be retained longer where necessary for legal and operational reasons.',
      ],
    },
    {
      title: '7. Security',
      paragraphs: [
        'We use administrative, technical, and organisational measures designed to protect personal information. No method of transmission or storage is completely secure, and we cannot guarantee absolute security.',
      ],
    },
    {
      title: '8. International transfers',
      paragraphs: [
        'Your information may be processed in countries other than where you live, including by hosting and authentication providers. Where required, we take steps intended to protect transferred information in accordance with applicable law.',
      ],
    },
    {
      title: '9. Your choices and rights',
      paragraphs: [
        'Depending on where you live, you may have rights to access, correct, delete, or restrict certain personal information, or to object to certain processing. You can update some account settings in Ant, and you can contact us to request assistance.',
        'You can manage email notification preferences in your account. You may also disable non-essential cookies in your browser where available.',
      ],
    },
    {
      title: '10. Children',
      paragraphs: [
        'The Service is intended for adults acting in a business or property-owner capacity. We do not knowingly collect personal information from children.',
      ],
    },
    {
      title: '11. Changes',
      paragraphs: [
        'We may update this Privacy Policy from time to time. We will post the updated version on this page and revise the “Last updated” date. Continued use of the Service after changes become effective constitutes acceptance of the updated policy where permitted by law.',
      ],
    },
  ],
};

const ru: LegalDocument = {
  title: 'Политика конфиденциальности',
  updatedLabel: 'Обновлено: 14 июля 2026',
  intro:
    'Эта Политика конфиденциальности объясняет, как Ant («мы») собирает, использует и защищает персональные данные при использовании маркетплейса Ant и связанных сервисов (далее — «Сервис»).',
  sections: [
    {
      title: '1. Кто мы',
      paragraphs: [
        'Ant — строительный маркетплейс, который помогает заказчикам публиковать проекты и получать предложения подрядчиков. По вопросам конфиденциальности свяжитесь с нами через аккаунт Ant или по контактам, указанным на сайте.',
      ],
    },
    {
      title: '2. Какие данные мы собираем',
      paragraphs: [
        'Данные аккаунта: имя, email, язык, роль (заказчик, подрядчик или дизайнер), а также данные аутентификации через провайдера входа.',
        'Профиль и бизнес-сведения: название компании, регионы услуг, специализации, документы верификации и материалы портфолио, которые вы загружаете.',
        'Данные проектов и тендеров: описания, документы, уточнения, заявки, условия коммерческих предложений, сообщения и связанные с договором записи.',
        'Технические данные: сведения об устройстве и браузере, приблизительное местоположение по сетевым данным, cookies и журналы безопасности/производительности.',
      ],
    },
    {
      title: '3. Как мы используем данные',
      paragraphs: [
        'Мы используем персональные данные для работы и улучшения Сервиса, управления аккаунтами, сопоставления заказчиков и подрядчиков, проведения тендеров, уведомлений, оценок и поддержки, верификации подрядчиков, предотвращения злоупотреблений и соблюдения закона.',
        'Мы не продаём персональные данные. Ограниченный объём данных может передаваться провайдерам хостинга, аутентификации, хранения файлов и email на договорных условиях.',
      ],
    },
    {
      title: '4. Правовые основания',
      paragraphs: [
        'Там, где это требуется законом, мы обрабатываем данные для исполнения договора, на основании законных интересов (безопасность, улучшение продукта, целостность маркетплейса), согласия (где мы его запрашиваем) и юридических обязательств.',
      ],
    },
    {
      title: '5. Видимость проектов и сообщения',
      paragraphs: [
        'Сведения в публичных или доступных для тендера материалах могут видеть другие пользователи согласно настройкам проекта. Сообщения и коммерческие предложения доступны соответствующим сторонам сделки.',
        'Не загружайте документы, которыми вы не вправе делиться. Вы отвечаете за загружаемый контент.',
      ],
    },
    {
      title: '6. Хранение',
      paragraphs: [
        'Мы храним данные, пока аккаунт активен и пока это нужно для предоставления Сервиса, разрешения споров, исполнения соглашений и соблюдения юридических требований. Записи по тендерам и договорам могут храниться дольше при необходимости.',
      ],
    },
    {
      title: '7. Безопасность',
      paragraphs: [
        'Мы применяем организационные и технические меры для защиты персональных данных. Однако ни один способ передачи или хранения не является абсолютно безопасным.',
      ],
    },
    {
      title: '8. Международные передачи',
      paragraphs: [
        'Ваши данные могут обрабатываться в странах, отличных от страны вашего проживания, в том числе провайдерами хостинга и аутентификации. При необходимости мы принимаем меры, соответствующие применимому праву.',
      ],
    },
    {
      title: '9. Ваши права и настройки',
      paragraphs: [
        'В зависимости от вашей юрисдикции вы можете иметь права на доступ, исправление, удаление или ограничение обработки данных. Часть настроек можно изменить в аккаунте Ant; по остальным вопросам свяжитесь с нами.',
        'Уведомления по email можно настроить в аккаунте. Необязательные cookies можно отключить в браузере, если это доступно.',
      ],
    },
    {
      title: '10. Дети',
      paragraphs: [
        'Сервис предназначен для взрослых, действующих в деловых или собственнических целях. Мы сознательно не собираем данные детей.',
      ],
    },
    {
      title: '11. Изменения',
      paragraphs: [
        'Мы можем обновлять эту Политику. Актуальная версия публикуется на этой странице с новой датой обновления. Продолжение использования Сервиса после вступления изменений в силу означает принятие обновлённой политики, где это допускается законом.',
      ],
    },
  ],
};

const th: LegalDocument = {
  title: 'นโยบายความเป็นส่วนตัว',
  updatedLabel: 'อัปเดตล่าสุด: 14 กรกฎาคม 2026',
  intro:
    'นโยบายความเป็นส่วนตัวนี้อธิบายว่า Ant (“เรา”) เก็บ ใช้ และปกป้องข้อมูลส่วนบุคคลอย่างไร เมื่อคุณใช้ตลาดกลางงานก่อสร้าง Ant และบริการที่เกี่ยวข้อง (“บริการ”)',
  sections: [
    {
      title: '1. เราคือใคร',
      paragraphs: [
        'Ant เป็นตลาดกลางงานก่อสร้างที่ช่วยให้ลูกค้าเผยแพร่โครงการและรับข้อเสนอจากผู้รับเหมา หากมีคำถามด้านความเป็นส่วนตัว ติดต่อเราผ่านบัญชี Ant หรือช่องทางติดต่อบนเว็บไซต์',
      ],
    },
    {
      title: '2. ข้อมูลที่เราเก็บ',
      paragraphs: [
        'ข้อมูลบัญชี: ชื่อ อีเมล ภาษา บทบาท (ลูกค้า ผู้รับเหมา หรือนักออกแบบ) และข้อมูลการยืนยันตัวตนผ่านผู้ให้บริการเข้าสู่ระบบ',
        'โปรไฟล์และข้อมูลธุรกิจ: ชื่อบริษัท พื้นที่ให้บริการ ความเชี่ยวชาญ เอกสารยืนยันตัวตน และพอร์ตโฟลิโอที่คุณอัปโหลด',
        'ข้อมูลโครงการและประกวดราคา: คำอธิบาย เอกสาร คำถามชี้แจง ข้อเสนอ เงื่อนไขข้อเสนอเชิงพาณิชย์ ข้อความ และการบันทึกที่เกี่ยวข้องกับสัญญา',
        'ข้อมูลทางเทคนิค: อุปกรณ์และเบราว์เซอร์ ตำแหน่งโดยประมาณจากเครือข่าย คุกกี้ และบันทึกเพื่อความปลอดภัยและประสิทธิภาพ',
      ],
    },
    {
      title: '3. การใช้ข้อมูล',
      paragraphs: [
        'เราใช้ข้อมูลเพื่อให้บริการและปรับปรุงแพลตฟอร์ม จัดการบัญชี จับคู่ลูกค้ากับผู้รับเหมา ดำเนินการประกวดราคา การแจ้งเตือน การประมาณราคา การยืนยันผู้รับเหมา การป้องกันการทุจริต และการปฏิบัติตามกฎหมาย',
        'เราไม่ได้ขายข้อมูลส่วนบุคคล อาจแบ่งปันข้อมูลที่จำเป็นกับผู้ให้บริการโฮสติ้ง การยืนยันตัวตน การจัดเก็บไฟล์ และอีเมลภายใต้ข้อตกลงที่เหมาะสม',
      ],
    },
    {
      title: '4. ฐานทางกฎหมาย',
      paragraphs: [
        'ตามที่กฎหมายกำหนด เราประมวลผลข้อมูลเพื่อปฏิบัติตามสัญญา ผลประโยชน์โดยชอบด้วยกฎหมาย (ความปลอดภัย การปรับปรุงผลิตภัณฑ์ ความน่าเชื่อถือของตลาด) ความยินยอม (เมื่อเราขอ) และหน้าที่ตามกฎหมาย',
      ],
    },
    {
      title: '5. การมองเห็นโครงการและการส่งข้อความ',
      paragraphs: [
        'ข้อมูลในเอกสารโครงการที่เป็นสาธารณะหรือเปิดให้ในประกวดราคาอาจถูกผู้ใช้รายอื่นเห็นตามการตั้งค่า ข้อความและข้อเสนอเชิงพาณิชย์จะแชร์กับคู่สัญญาที่เกี่ยวข้อง',
        'โปรดอย่าอัปโหลดเอกสารที่คุณไม่มีสิทธิ์แบ่งปัน คุณรับผิดชอบต่อเนื้อหาที่ส่ง',
      ],
    },
    {
      title: '6. การเก็บรักษา',
      paragraphs: [
        'เราเก็บข้อมูลตราบเท่าที่บัญชีใช้งานอยู่และจำเป็นต่อการให้บริการ การระงับข้อพิพาท และการปฏิบัติตามกฎหมาย บันทึกประกวดราคาและสัญญาอาจเก็บไว้นานกว่านั้นหากจำเป็น',
      ],
    },
    {
      title: '7. ความปลอดภัย',
      paragraphs: [
        'เราใช้มาตรการทางเทคนิคและองค์กรเพื่อปกป้องข้อมูล อย่างไรก็ตามไม่มีวิธีส่งหรือจัดเก็บข้อมูลใดที่ปลอดภัยอย่างสมบูรณ์',
      ],
    },
    {
      title: '8. การโอนข้อมูลข้ามประเทศ',
      paragraphs: [
        'ข้อมูลของคุณอาจถูกประมวลผลในประเทศอื่นนอกเหนือจากที่คุณอาศัย รวมถึงโดยผู้ให้บริการโฮสติ้งและการยืนยันตัวตน ทั้งนี้เราดำเนินการตามที่กฎหมายกำหนดเพื่อคุ้มครองข้อมูล',
      ],
    },
    {
      title: '9. สิทธิและการตั้งค่าของคุณ',
      paragraphs: [
        'ขึ้นอยู่กับกฎหมายในพื้นที่ของคุณ คุณอาจมีสิทธิ์เข้าถึง แก้ไข ลบ หรือจำกัดการประมวลผลข้อมูล ส่วนหนึ่งสามารถจัดการได้ในบัญชี Ant หรือติดต่อเราเพื่อขอความช่วยเหลือ',
        'คุณสามารถตั้งค่าการแจ้งเตือนอีเมลในบัญชี และปิดคุกกี้ที่ไม่จำเป็นในเบราว์เซอร์ได้หากรองรับ',
      ],
    },
    {
      title: '10. เด็ก',
      paragraphs: [
        'บริการนี้ออกแบบสำหรับผู้ใหญ่ที่ใช้เพื่อธุรกิจหรือการเป็นเจ้าของทรัพย์สิน เราไม่ได้เจตนาเก็บข้อมูลของเด็ก',
      ],
    },
    {
      title: '11. การเปลี่ยนแปลง',
      paragraphs: [
        'เราอาจปรับปรุงนโยบายนี้เป็นครั้งคราว โดยเผยแพร่เวอร์ชันล่าสุดบนหน้านี้และอัปเดตวันที่ หากคุณยังใช้บริการต่อไปหลังจากมีผลถือว่าคุณยอมรับนโยบายฉบับปรับปรุงตามที่กฎหมายอนุญาต',
      ],
    },
  ],
};

const privacyByLocale: Record<Locale, LegalDocument> = { en, ru, th };

export function getPrivacyPolicy(locale: Locale): LegalDocument {
  return privacyByLocale[locale] ?? privacyByLocale.en;
}
