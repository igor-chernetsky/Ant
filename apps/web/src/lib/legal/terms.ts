import type { Locale } from '@/lib/i18n';
import type { LegalDocument } from './types';

const en: LegalDocument = {
  title: 'Terms of Service',
  updatedLabel: 'Last updated: 14 July 2026',
  intro:
    'These Terms of Service (“Terms”) govern access to and use of the Ant construction marketplace website and related services (the “Service”). By creating an account or using the Service, you agree to these Terms.',
  sections: [
    {
      title: '1. The Service',
      paragraphs: [
        'Ant provides an online marketplace where clients can publish construction-related projects, request clarification, invite or receive contractor interest, and manage tender workflows. Contractors may create profiles, apply to projects, submit proposals, and communicate with clients.',
        'Ant is a technology platform. Unless expressly stated in writing, Ant is not a party to construction contracts between clients and contractors and does not itself perform construction works.',
      ],
    },
    {
      title: '2. Eligibility and accounts',
      paragraphs: [
        'You must be legally able to enter into binding agreements. You are responsible for the accuracy of account information and for keeping login credentials secure. You must promptly update details that become outdated.',
        'We may refuse, suspend, or terminate accounts that violate these Terms, fail verification, or create risk to the marketplace or other users.',
      ],
    },
    {
      title: '3. Roles and responsibilities',
      paragraphs: [
        'Clients are responsible for the accuracy of project scopes, documents, budgets expectations, and site access arrangements they communicate through the Service.',
        'Contractors are responsible for the accuracy of their profiles, capabilities, licensing/qualification claims, proposals, pricing, timelines, and any representations made to clients.',
        'Users must comply with applicable laws, building regulations, tax and employment rules, and professional licensing requirements in the jurisdictions where they operate.',
      ],
    },
    {
      title: '4. Estimates, proposals, and contracts',
      paragraphs: [
        'Ballpark estimates, suggested scopes, or AI-assisted summaries shown in the Service are indicative only and are not binding quotes, designs, engineered specifications, or legal advice.',
        'Commercial proposals, contract terms, and signatures exchanged through the Service are between the relevant client and contractor. Users should independently review all commercial and legal terms before signing.',
        'Ant does not guarantee that any project will receive bids, that any bid will be accepted, or that parties will complete a transaction.',
      ],
    },
    {
      title: '5. Acceptable use',
      paragraphs: [
        'You may not misuse the Service, including by posting unlawful, misleading, defamatory, or infringing content; uploading malware; attempting unauthorised access; scraping data without permission; harassing other users; or circumventing verification, fee, or security controls.',
        'You may not use Ant to solicit offline dealings in a way that is intended to evade marketplace rules or abuse other users’ personal data.',
      ],
    },
    {
      title: '6. Content and licences',
      paragraphs: [
        'You retain ownership of content you submit. You grant Ant a worldwide, non-exclusive licence to host, process, display, and transmit that content as needed to operate the Service and enforce these Terms.',
        'You represent that you have the rights to submit the content and that doing so does not violate third-party rights or confidentiality obligations.',
      ],
    },
    {
      title: '7. Verification and reviews',
      paragraphs: [
        'Contractor verification, portfolio displays, and project reviews are tools to support trust. They are not a warranty of quality, financial standing, insurance coverage, or regulatory compliance. Clients and contractors must perform their own due diligence.',
      ],
    },
    {
      title: '8. Fees',
      paragraphs: [
        'Use of certain features may be free or subject to fees disclosed in the Service. If fees apply, we will describe them before you accept a paid feature. Taxes may apply as required by law.',
      ],
    },
    {
      title: '9. Disclaimers',
      paragraphs: [
        'THE SERVICE IS PROVIDED “AS IS” AND “AS AVAILABLE” TO THE MAXIMUM EXTENT PERMITTED BY LAW. WE DISCLAIM WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.',
        'We do not warrant uninterrupted or error-free operation, that estimates or AI outputs are accurate, or that contractors or clients will perform as represented.',
      ],
    },
    {
      title: '10. Limitation of liability',
      paragraphs: [
        'To the maximum extent permitted by law, Ant and its affiliates will not be liable for indirect, incidental, special, consequential, exemplary, or punitive damages, or for lost profits, revenues, data, or business opportunities arising from use of the Service or dealings between users.',
        'Our aggregate liability for claims relating to the Service is limited to the greater of (a) the amounts you paid to Ant for the Service in the 3 months before the claim or (b) USD 100, except where liability cannot be limited by law.',
      ],
    },
    {
      title: '11. Indemnity',
      paragraphs: [
        'You agree to indemnify and hold harmless Ant from claims, damages, and expenses arising out of your content, your use of the Service, your projects or proposals, or your breach of these Terms or applicable law, except to the extent caused by Ant’s wilful misconduct.',
      ],
    },
    {
      title: '12. Suspension and termination',
      paragraphs: [
        'You may stop using the Service at any time. We may suspend or terminate access if you breach these Terms, create risk, or if we discontinue the Service. Provisions that by nature should survive termination will continue to apply.',
      ],
    },
    {
      title: '13. Governing law',
      paragraphs: [
        'These Terms are governed by the laws of Thailand, without regard to conflict-of-law principles, unless mandatory consumer protections in your country of residence require otherwise. Courts in Thailand shall have non-exclusive jurisdiction, subject to any non-waivable rights you may have.',
      ],
    },
    {
      title: '14. Changes',
      paragraphs: [
        'We may update these Terms by posting a revised version on this page. Material changes may also be communicated through the Service or by email. Continued use after the effective date constitutes acceptance of the updated Terms where permitted by law.',
      ],
    },
    {
      title: '15. Contact',
      paragraphs: [
        'For questions about these Terms, contact us through your Ant account or using the contact details published on the website.',
      ],
    },
  ],
};

const ru: LegalDocument = {
  title: 'Условия использования',
  updatedLabel: 'Обновлено: 14 июля 2026',
  intro:
    'Настоящие Условия использования («Условия») регулируют доступ к маркетплейсу Ant и связанным сервисам («Сервис»). Создавая аккаунт или используя Сервис, вы соглашаетесь с этими Условиями.',
  sections: [
    {
      title: '1. Сервис',
      paragraphs: [
        'Ant предоставляет онлайн-площадку, где заказчики публикуют строительные проекты, уточняют объём работ и ведут тендерные процессы, а подрядчики создают профили, подают заявки и общаются с заказчиками.',
        'Ant — технологическая платформа. Если прямо не указано иное, Ant не является стороной строительных договоров между заказчиками и подрядчиками и не выполняет строительные работы.',
      ],
    },
    {
      title: '2. Правоспособность и аккаунты',
      paragraphs: [
        'Вы должны быть правоспособны заключать договоры. Вы отвечаете за точность данных аккаунта и сохранность учётных данных и обязаны своевременно обновлять устаревшие сведения.',
        'Мы можем отказать в регистрации, приостановить или закрыть аккаунт при нарушении Условий, непрохождении верификации или создании рисков для площадки и пользователей.',
      ],
    },
    {
      title: '3. Роли и обязанности',
      paragraphs: [
        'Заказчики отвечают за точность объёма работ, документов, ожиданий по бюджету и условий доступа на объект, которые они сообщают через Сервис.',
        'Подрядчики отвечают за точность профиля, компетенций, заявлений о лицензиях/квалификации, предложений, цен, сроков и иных представлений заказчику.',
        'Пользователи обязаны соблюдать применимые законы, строительные нормы, налоговые и трудовые требования, а также правила лицензирования.',
      ],
    },
    {
      title: '4. Сметы, предложения и договоры',
      paragraphs: [
        'Ориентировочные оценки, подсказки по объёму и материалы с помощью ИИ носят справочный характер и не являются обязательным коммерческим предложением, проектом или юридической консультацией.',
        'Коммерческие предложения, условия договора и подписи через Сервис заключаются между соответствующими заказчиком и подрядчиком. Перед подписанием стороны должны самостоятельно проверить условия.',
        'Ant не гарантирует наличие заявок, принятие предложения или завершение сделки.',
      ],
    },
    {
      title: '5. Допустимое использование',
      paragraphs: [
        'Запрещено злоупотреблять Сервисом: публиковать незаконный, вводящий в заблуждение или нарушающий права контент; загружать вредоносное ПО; пытаться получить несанкционированный доступ; собирать данные без разрешения; преследовать пользователей; обходить проверки безопасности.',
        'Запрещено использовать Ant для сбора персональных данных других пользователей в нарушение правил площадки.',
      ],
    },
    {
      title: '6. Контент и лицензии',
      paragraphs: [
        'Вы сохраняете права на свой контент и предоставляете Ant неисключительную лицензию на его размещение, обработку и отображение в объёме, необходимом для работы Сервиса.',
        'Вы подтверждаете, что имеете права на размещение контента и не нарушаете права третьих лиц и режим конфиденциальности.',
      ],
    },
    {
      title: '7. Верификация и отзывы',
      paragraphs: [
        'Верификация подрядчиков, портфолио и отзывы помогают повышать доверие, но не являются гарантией качества, финансовой устойчивости, страхования или соответствия нормам. Стороны должны проводить собственную проверку.',
      ],
    },
    {
      title: '8. Платежи',
      paragraphs: [
        'Отдельные функции могут быть бесплатными или платными. Если вводятся сборы, мы сообщим о них до принятия платной функции. Могут применяться налоги.',
      ],
    },
    {
      title: '9. Отказ от гарантий',
      paragraphs: [
        'СЕРВИС ПРЕДОСТАВЛЯЕТСЯ «КАК ЕСТЬ» И «ПО МЕРЕ ДОСТУПНОСТИ» В МАКСИМАЛЬНО ДОПУСТИМОЙ ЗАКОНОМ СТЕПЕНИ. МЫ ОТКАЗЫВАЕМСЯ ОТ ПОДРАЗУМЕВАЕМЫХ ГАРАНТИЙ ТОВАРНОЙ ПРИГОДНОСТИ, ПРИГОДНОСТИ ДЛЯ ОПРЕДЕЛЁННОЙ ЦЕЛИ И НЕНАРУШЕНИЯ ПРАВ.',
        'Мы не гарантируем бесперебойную работу, точность оценок или результатов ИИ, а также исполнение обязательств пользователями.',
      ],
    },
    {
      title: '10. Ограничение ответственности',
      paragraphs: [
        'В максимально допустимой законом степени Ant не несёт ответственности за косвенные, случайные, особые, штрафные убытки, упущенную выгоду или потерю данных в связи с использованием Сервиса или взаимодействием пользователей.',
        'Совокупная ответственность Ant ограничена большей из сумм: (a) оплат, перечисленных вами Ant за 3 месяца до требования, или (b) 100 USD, кроме случаев, когда ограничение запрещено законом.',
      ],
    },
    {
      title: '11. Возмещение убытков',
      paragraphs: [
        'Вы соглашаетесь возместить Ant убытки и расходы, вызванные вашим контентом, использованием Сервиса, проектами или предложениями либо нарушением Условий или закона, за исключением случаев умышленного неправомерного поведения Ant.',
      ],
    },
    {
      title: '12. Приостановление и прекращение',
      paragraphs: [
        'Вы можете прекратить использование Сервиса в любое время. Мы можем приостановить доступ при нарушении Условий, создании рисков или прекращении работы Сервиса. Положения, которые по своей природе должны продолжать действовать, сохраняют силу.',
      ],
    },
    {
      title: '13. Применимое право',
      paragraphs: [
        'Условия регулируются законодательством Таиланда, если императивные нормы защиты потребителей вашей страны не требуют иного. Суды Таиланда имеют неисключительную юрисдикцию с учётом ваших неснижаемых прав.',
      ],
    },
    {
      title: '14. Изменения',
      paragraphs: [
        'Мы можем обновлять Условия, публикуя новую версию на этой странице. О существенных изменениях можем уведомить через Сервис или по email. Продолжение использования после даты вступления изменений в силу означает согласие, где это допускается законом.',
      ],
    },
    {
      title: '15. Контакты',
      paragraphs: [
        'По вопросам об Условиях свяжитесь с нами через аккаунт Ant или по контактам на сайте.',
      ],
    },
  ],
};

const th: LegalDocument = {
  title: 'เงื่อนไขการใช้บริการ',
  updatedLabel: 'อัปเดตล่าสุด: 14 กรกฎาคม 2026',
  intro:
    'เงื่อนไขการใช้บริการเหล่านี้ (“เงื่อนไข”) ควบคุมการเข้าถึงและใช้ตลาดกลางงานก่อสร้าง Ant และบริการที่เกี่ยวข้อง (“บริการ”) การสร้างบัญชีหรือใช้บริการถือว่าคุณตกลงตามเงื่อนไขนี้',
  sections: [
    {
      title: '1. บริการ',
      paragraphs: [
        'Ant ให้บริการตลาดออนไลน์ที่ลูกค้าสามารถเผยแพร่โครงการก่อสร้าง ชี้แจงขอบเขตงาน และจัดการกระบวนการประกวดราคา และผู้รับเหมาสามารถสร้างโปรไฟล์ สมัครงาน ส่งข้อเสนอ และติดต่อลูกค้าได้',
        'Ant เป็นแพลตฟอร์มเทคโนโลยี หากไม่ได้ระบุเป็นลายลักษณ์อักษร Ant ไม่ใช่คู่สัญญาในสัญญาก่อสร้างระหว่างลูกค้ากับผู้รับเหมา และไม่ได้เป็นผู้ดำเนินการก่อสร้างเอง',
      ],
    },
    {
      title: '2. คุณสมบัติและบัญชี',
      paragraphs: [
        'คุณต้องมีสิทธิ์ตามกฎหมายในการทำสัญญา และรับผิดชอบความถูกต้องของข้อมูลบัญชี รวมถึงการรักษาความปลอดภัยของข้อมูลเข้าสู่ระบบ',
        'เราอาจปฏิเสธ พัก หรือยกเลิกบัญชีที่ละเมิดเงื่อนไข ไม่ผ่านการยืนยันตัวตน หรือก่อให้เกิดความเสี่ยงต่อตลาดและผู้ใช้รายอื่น',
      ],
    },
    {
      title: '3. บทบาทและความรับผิดชอบ',
      paragraphs: [
        'ลูกค้ารับผิดชอบความถูกต้องของขอบเขตงาน เอกสาร ความคาดหวังด้านงบประมาณ และการจัดเตรียมการเข้าถึงหน้างานที่แจ้งผ่านบริการ',
        'ผู้รับเหมารับผิดชอบความถูกต้องของโปรไฟล์ ความสามารถ การอ้างสิทธิ์ใบอนุญาต/คุณวุฒิ ข้อเสนอ ราคา ระยะเวลา และข้อความใด ๆ ที่แสดงต่อลูกค้า',
        'ผู้ใช้ต้องปฏิบัติตามกฎหมาย ข้อบังคับอาคาร กฎภาษีและแรงงาน รวมถึงข้อกำหนดใบอนุญาตวิชาชีพที่เกี่ยวข้อง',
      ],
    },
    {
      title: '4. การประมาณราคา ข้อเสนอ และสัญญา',
      paragraphs: [
        'การประมาณราคาเบื้องต้น ขอบเขตที่แนะนำ หรือสรุปด้วย AI เป็นข้อมูลอ้างอิงเท่านั้น ไม่ใช่ใบเสนอราคาที่ผูกพัน แบบก่อสร้าง หรือคำปรึกษาทางกฎหมาย',
        'ข้อเสนอเชิงพาณิชย์ เงื่อนไขสัญญา และการลงนามผ่านบริการเป็นเรื่องระหว่างลูกค้ากับผู้รับเหมาที่เกี่ยวข้อง ควรตรวจสอบเงื่อนไขด้วยตนเองก่อนลงนาม',
        'Ant ไม่รับประกันว่าจะมีผู้ยื่นข้อเสนอ การยอมรับข้อเสนอ หรือการทำธุรกรรมสำเร็จ',
      ],
    },
    {
      title: '5. การใช้งานที่ยอมรับได้',
      paragraphs: [
        'ห้ามใช้บริการในทางที่ผิด รวมถึงการโพสต์เนื้อหาผิดกฎหมาย ทำให้เข้าใจผิด หรือละเมิดสิทธิ์ การอัปโหลดมัลแวร์ การเข้าถึงโดยไม่ได้รับอนุญาต การเก็บข้อมูลโดยไม่ได้รับอนุญาต การคุกคามผู้ใช้อื่น หรือการหลีกเลี่ยงระบบความปลอดภัย',
        'ห้ามใช้ Ant เพื่อรวบรวมข้อมูลส่วนบุคคลของผู้ใช้อื่นโดยฝ่าฝืนกฎของตลาด',
      ],
    },
    {
      title: '6. เนื้อหาและสิทธิ์ใช้งาน',
      paragraphs: [
        'คุณยังคงเป็นเจ้าของเนื้อหาที่ส่ง และมอบสิทธิ์ใช้งานแบบไม่เฉพาะแก่ Ant ในการโฮสต์ ประมวลผล และแสดงเนื้อหานั้นตามที่จำเป็นต่อการให้บริการ',
        'คุณรับรองว่ามีสิทธิ์ส่งเนื้อหาและไม่ละเมิดสิทธิ์ของบุคคลที่สามหรือข้อผูกพันด้านความลับ',
      ],
    },
    {
      title: '7. การยืนยันตัวตนและรีวิว',
      paragraphs: [
        'การยืนยันผู้รับเหมา พอร์ตโฟลิโอ และรีวิวเป็นเครื่องมือสร้างความเชื่อมั่น ไม่ใช่การรับประกันคุณภาพ สถานะการเงิน ประกันภัย หรือการปฏิบัติตามกฎหมาย คู่สัญญาต้องตรวจสอบด้วยตนเอง',
      ],
    },
    {
      title: '8. ค่าธรรมเนียม',
      paragraphs: [
        'ฟีเจอร์บางอย่างอาจใช้งานฟรีหรือมีค่าธรรมเนียม หากมีการเก็บค่าบริการ เราจะแจ้งก่อนที่คุณจะยอมรับฟีเจอร์แบบมีค่าใช้จ่าย อาจมีภาษีตามกฎหมาย',
      ],
    },
    {
      title: '9. ข้อจำกัดการรับประกัน',
      paragraphs: [
        'บริการนี้ให้บริการ “ตามสภาพ” และ “ตามที่มี” ในขอบเขตสูงสุดที่กฎหมายอนุญาต เราปฏิเสธการรับประกันโดยนัยด้านความเหมาะสมทางการค้า ความเหมาะสมสำหรับวัตถุประสงค์เฉพาะ และการไม่ละเมิดสิทธิ์',
        'เราไม่รับประกันว่าบริการจะไม่สะดุด การประมาณราคาหรือผลลัพธ์ AI จะถูกต้อง หรือผู้ใช้จะปฏิบัติตามที่แสดงไว้',
      ],
    },
    {
      title: '10. ข้อจำกัดความรับผิด',
      paragraphs: [
        'ในขอบเขตสูงสุดที่กฎหมายอนุญาต Ant ไม่รับผิดต่อความเสียหายทางอ้อม พิเศษ เชิงลงโทษ ผลกำไรที่เสียไป หรือการสูญเสียข้อมูลที่เกิดจากการใช้บริการหรือการติดต่อระหว่างผู้ใช้',
        'ความรับผิดรวมของ Ant จำกัดไว้ที่จำนวนที่มากกว่าระหว่าง (ก) จำนวนเงินที่คุณชำระให้ Ant ในช่วง 3 เดือนก่อนเรียกร้อง หรือ (ข) 100 ดอลลาร์สหรัฐ เว้นแต่กฎหมายห้ามจำกัดความรับผิด',
      ],
    },
    {
      title: '11. การชดใช้',
      paragraphs: [
        'คุณตกลงที่จะชดใช้ความเสียหายและค่าใช้จ่ายให้ Ant ที่เกิดจากเนื้อหาของคุณ การใช้บริการ โครงการหรือข้อเสนอ หรือการละเมิดเงื่อนไขหรือกฎหมาย เว้นแต่เกิดจากความประพฤติโดยเจตนาของ Ant',
      ],
    },
    {
      title: '12. การระงับและสิ้นสุด',
      paragraphs: [
        'คุณสามารถหยุดใช้บริการได้ทุกเมื่อ เราอาจระงับการเข้าถึงหากคุณละเมิดเงื่อนไข ก่อให้เกิดความเสี่ยง หรือหากเราหยุดบริการ ข้อกำหนดที่โดยลักษณะควรยังมีผลหลังสิ้นสุดจะยังมีผลต่อไป',
      ],
    },
    {
      title: '13. กฎหมายที่ใช้บังคับ',
      paragraphs: [
        'เงื่อนไขนี้อยู่ภายใต้กฎหมายไทย เว้นแต่สิทธิคุ้มครองผู้บริโภคที่บังคับใช้ในประเทศของคุณจะกำหนดไว้เป็นอย่างอื่น ศาลในประเทศไทยมีเขตอำนาจแบบไม่เฉพาะ โดยไม่ตัดสิทธิที่สละไม่ได้ของคุณ',
      ],
    },
    {
      title: '14. การเปลี่ยนแปลง',
      paragraphs: [
        'เราอาจปรับปรุงเงื่อนไขโดยเผยแพร่เวอร์ชันใหม่บนหน้านี้ การเปลี่ยนแปลงสำคัญอาจแจ้งผ่านบริการหรืออีเมล การใช้บริการต่อหลังจากมีผลถือเป็นการยอมรับตามที่กฎหมายอนุญาต',
      ],
    },
    {
      title: '15. ติดต่อ',
      paragraphs: [
        'หากมีคำถามเกี่ยวกับเงื่อนไข ติดต่อเราผ่านบัญชี Ant หรือช่องทางติดต่อบนเว็บไซต์',
      ],
    },
  ],
};

const termsByLocale: Record<Locale, LegalDocument> = { en, ru, th };

export function getTermsOfService(locale: Locale): LegalDocument {
  return termsByLocale[locale] ?? termsByLocale.en;
}
