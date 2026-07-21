import type { SupportedLocale } from '../users/locale.types';
import { DEFAULT_LOCALE, isSupportedLocale } from '../users/locale.types';

export interface CommercialProposalCopy {
  documentTitle: (projectTitle: string) => string;
  contractHeading: string;
  of: string;
  byAndBetween: string;
  employerLabel: string;
  contractorLabel: string;
  employerReferred: string;
  contractorReferred: string;
  andConnector: string;
  partiesAgree: string;
  clause1: string;
  constructionWorks: string;
  theProject: string;
  propertySiteRights: string;
  meansAt: (subject: string, site: string) => string;
  projectMeans: string;
  clause2: string;
  implementationApproach: string;
  commentsAssumptions: string;
  clause3: string;
  employerAgreesToPay: (amount: string, numeric: string) => string;
  noAdjustment: string;
  annex1Boq: string;
  annex2Drawings: string;
  clause5: string;
  worksCommencementDate: string;
  worksCompletedWithin: (period: string) => string;
  delayDamages: string;
  clause6: string;
  advancePayment: string;
  termsOfPayment: string;
  retention: string;
  releaseOfRetention: string;
  defectWarranty: string;
  clarifications: string;
  specialConditions: string;
  clauseForceMajeure: string;
  forceMajeureDefinitionTitle: string;
  forceMajeureDefinition: string;
  forceMajeureEvents: string[];
  forceMajeureNoticeTitle: string;
  forceMajeureNotice: string;
  forceMajeureReliefTitle: string;
  forceMajeureRelief: string;
  footerNote: string;
  signaturesHeading: string;
  forContractor: string;
  forEmployer: string;
  signatureLabel: string;
  nameLabel: string;
  titleLabel: string;
  dateLabel: string;
  defaultContractorTitle: string;
  defaultEmployerTitle: string;
  siteToBeConfirmed: string;
  registrationNo: (value: string) => string;
  representedBy: (value: string) => string;
  scopeFallback: string;
  dash: string;
  noAdvancePayment: string;
  advancePercentOf: (pct: number, amount: string) => string;
  paymentAdvanceTiming: string;
  paymentShortPeriodFinal: string;
  paymentMonthlyProgress: string;
  retentionShallBe: (pct: number, limit: number) => string;
  periodMonthsFromStart: (months: number) => string;
  periodDaysFromStart: (days: number) => string;
  periodMasterSchedule: string;
  defaultPropertyOwnership: string;
  defaultRetentionRelease: string;
  defaultWarranty: (months: number) => string;
  defaultDelayDamages: string;
  annex2EmptyIntro: string;
  annex2EmptyNote: string;
  annex2ListIntro: string;
  annex2FilesNote: string;
  boqTrade: string;
  boqDescription: string;
  boqAmount: string;
  boqSubtotal: string;
  employerFallback: string;
  contractorFallback: string;
}

const EN: CommercialProposalCopy = {
  documentTitle: (projectTitle) => `Commercial Proposal — ${projectTitle}`,
  contractHeading: 'CONSTRUCTION CONTRACT',
  of: 'of',
  byAndBetween: 'By and between:',
  employerLabel: 'Employer',
  contractorLabel: 'Contractor',
  employerReferred: 'hereinafter referred to as the',
  contractorReferred: 'hereinafter referred to as the',
  andConnector: 'and',
  partiesAgree:
    'Both Parties agree to make this Contract subject to the following terms and conditions:',
  clause1: 'Clause 1 — Definitions',
  constructionWorks: '“Construction Works”',
  theProject: '“The Project”',
  propertySiteRights: 'Property / site rights:',
  meansAt: (subject, site) => `means ${subject} at ${site}.`,
  projectMeans:
    'means completion of the Works as described in Annex #2 (Drawings and Specifications) and this Contract.',
  clause2: 'Clause 2 — Scope of Works',
  implementationApproach: 'Implementation approach:',
  commentsAssumptions: 'Comments / assumptions:',
  clause3: 'Clause 3 — Contract Amount',
  employerAgreesToPay: (amount, numeric) =>
    `The Employer agrees to pay the Contract Amount (including applicable taxes) of ${amount} (THB ${numeric}) (the “Contract Amount”).`,
  noAdjustment:
    'No adjustment shall be allowed for changes in cost of materials, labour, equipment or services during the Contract period unless agreed in writing as a Variation Order.',
  annex1Boq: 'Annex #1 — Bill of Quantity',
  annex2Drawings: 'Annex #2 — Drawings and Specifications',
  clause5: 'Clause 5 — Contract Period',
  worksCommencementDate: 'Works Commencement Date:',
  worksCompletedWithin: (period) =>
    `The whole scope of the Works shall be completed within ${period}.`,
  delayDamages: 'Delay damages:',
  clause6: 'Clause 6 — Payment, Retention & Warranty',
  advancePayment: '6.1 Advance Payment:',
  termsOfPayment: '6.2 Terms of Payment:',
  retention: '6.5 Retention:',
  releaseOfRetention: '6.6 Release of Retention:',
  defectWarranty: '6.7 Defect Notification / Warranty:',
  clarifications: 'Contractor Clarifications',
  specialConditions: 'Special Conditions',
  clauseForceMajeure: 'Clause 7 — Force Majeure',
  forceMajeureDefinitionTitle: '7.1 Definition of Force Majeure Event',
  forceMajeureDefinition:
    'Neither Party shall be held liable or responsible to the other Party, nor be deemed to have defaulted or breached this Agreement, for any failure or delay in fulfilling or performing any term of this Agreement when and to the extent such failure or delay is caused by or results from acts beyond the impacted Party’s reasonable control (“Force Majeure Event”), including, without limitation:',
  forceMajeureEvents: [
    'Acts of God, natural disasters (such as earthquakes, floods, hurricanes, or tsunamis), or extreme weather events.',
    'Epidemics or pandemics.',
    'War (declared or undeclared), armed conflict, acts of terrorism, riots, or civil unrest.',
    'Government actions, embargoes, blockades, or changes in laws or regulations.',
    'Labor disputes, strikes, or lockouts.',
    'Interruption or failure of utilities, transportation, or telecommunication networks.',
  ],
  forceMajeureNoticeTitle: '7.2 Notice and Mitigation',
  forceMajeureNotice:
    'The Party suffering a Force Majeure Event shall give written notice to the other Party stating the nature of the event, its estimated duration, and the extent to which performance will be delayed or prevented. The affected Party shall use all reasonable efforts to mitigate the impact of the event and to resume the performance of its obligations as soon as reasonably practicable.',
  forceMajeureReliefTitle: '7.3 Relief of Performance and Termination',
  forceMajeureRelief:
    'If the Force Majeure Event continues for a continuous period of more than 90 days, either Party may terminate this Agreement by providing written notice to the other Party. During the duration of the event, the affected Party’s performance obligations—excluding any obligation to make payments that accrued prior to the event—shall be suspended.',
  footerNote:
    'Draft commercial proposal generated by the platform from submitted bid data. This document is intended for review and execution by both Parties; legal review is recommended before signing.',
  signaturesHeading: 'Signatures',
  forContractor: 'For the Contractor',
  forEmployer: 'For the Employer',
  signatureLabel: 'Signature',
  nameLabel: 'Name',
  titleLabel: 'Position / Title',
  dateLabel: 'Date',
  defaultContractorTitle: 'Authorized Representative',
  defaultEmployerTitle: 'Authorized Representative',
  siteToBeConfirmed: 'To be confirmed on site',
  registrationNo: (value) => `Registration no. ${value}`,
  representedBy: (value) => `Represented by ${value}`,
  scopeFallback:
    'As shown and described in the Contract Documents, Drawings and Specifications (Annex #2).',
  dash: '—',
  noAdvancePayment: 'No advance payment.',
  advancePercentOf: (pct, amount) =>
    `${pct}% of the Contract Amount (${amount})`,
  paymentAdvanceTiming:
    'The Advance Payment (if any) shall be paid by the Employer no later than two (2) weeks before the Works Commencement Date, unless the Parties agree otherwise when preparing this Commercial Proposal.',
  paymentShortPeriodFinal:
    'Given the Contract Period is less than two (2) months, the Final Payment shall be due within one (1) month after acceptance of the Works (Practical Completion).',
  paymentMonthlyProgress:
    'Progress payments shall be based on monthly interim valuation in accordance with this Contract.',
  retentionShallBe: (pct, limit) =>
    `Retention shall be ${pct}% of the value of work executed, subject to a limit of ${limit}% of the Accepted Contract Amount.`,
  periodMonthsFromStart: (months) =>
    `${months} month${months === 1 ? '' : 's'} from the Works Commencement Date`,
  periodDaysFromStart: (days) =>
    `${days} days from the Works Commencement Date`,
  periodMasterSchedule: 'As per the Master Schedule (Annex #3)',
  defaultPropertyOwnership:
    'The Employer holds lawful title to the Site and right to commission the Works.',
  defaultRetentionRelease:
    '5% on Taking-Over Certificate; 5% after 12 months from Practical Completion.',
  defaultWarranty: (months) =>
    `Defect Notification Period: ${months} months from Practical Completion.`,
  defaultDelayDamages:
    'Delay damages at 0.2% per day of the Contract Amount, maximum 20% of the Contract Amount.',
  annex2EmptyIntro:
    'Drawings, specifications, and other technical documents uploaded to the project on the platform are deemed part of this Contract when listed here.',
  annex2EmptyNote:
    'No project documents are recorded on the platform yet. Annex #2 to be supplemented with drawings and specifications before Works commence.',
  annex2ListIntro:
    'The following project documents form Annex #2 (Drawings and Specifications):',
  annex2FilesNote:
    'Full files are available in the project workspace on the platform.',
  boqTrade: 'Trade / item',
  boqDescription: 'Description',
  boqAmount: 'Amount (THB)',
  boqSubtotal: 'Subtotal',
  employerFallback: 'Employer',
  contractorFallback: 'Contractor',
};

const RU: CommercialProposalCopy = {
  documentTitle: (projectTitle) => `Коммерческое предложение — ${projectTitle}`,
  contractHeading: 'ДОГОВОР ПОДРЯДА',
  of: 'по проекту',
  byAndBetween: 'Между:',
  employerLabel: 'Заказчик',
  contractorLabel: 'Подрядчик',
  employerReferred: 'далее именуемый',
  contractorReferred: 'далее именуемый',
  andConnector: 'и',
  partiesAgree:
    'Стороны соглашаются заключить настоящий Договор на следующих условиях:',
  clause1: 'Пункт 1 — Определения',
  constructionWorks: '«Строительные работы»',
  theProject: '«Проект»',
  propertySiteRights: 'Права на объект / участок:',
  meansAt: (subject, site) => `означает ${subject} по адресу ${site}.`,
  projectMeans:
    'означает выполнениешение Работ, описанных в Приложении №2 (Чертежи и спецификации) и в настоящем Договоре.',
  clause2: 'Пункт 2 — Объём работ',
  implementationApproach: 'Подход к выполнению:',
  commentsAssumptions: 'Комментарии / допущения:',
  clause3: 'Пункт 3 — Сумма договора',
  employerAgreesToPay: (amount, numeric) =>
    `Заказчик обязуется уплатить Сумму договора (включая применимые налоги) в размере ${amount} (THB ${numeric}) («Сумма договора»).`,
  noAdjustment:
    'Корректировка стоимости материалов, труда, оборудования или услуг в течение срока Договора не допускается, если иное не согласовано письменно как Variation Order.',
  annex1Boq: 'Приложение №1 — Ведомость объёмов (BOQ)',
  annex2Drawings: 'Приложение №2 — Чертежи и спецификации',
  clause5: 'Пункт 5 — Срок выполнения работ',
  worksCommencementDate: 'Дата начала работ:',
  worksCompletedWithin: (period) =>
    `Весь объём Работ должен быть выполнен в течение ${period}.`,
  delayDamages: 'Неустойка за просрочку:',
  clause6: 'Пункт 6 — Оплата, удержание и гарантия',
  advancePayment: '6.1 Авансовый платёж:',
  termsOfPayment: '6.2 Условия оплаты:',
  retention: '6.5 Удержание:',
  releaseOfRetention: '6.6 Выплата удержания:',
  defectWarranty: '6.7 Период уведомления о дефектах / гарантия:',
  clarifications: 'Разъяснения подрядчика',
  specialConditions: 'Особые условия',
  clauseForceMajeure: 'Пункт 7 — Форс-мажор',
  forceMajeureDefinitionTitle: '7.1 Определение события форс-мажора',
  forceMajeureDefinition:
    'Ни одна из Сторон не несёт ответственности перед другой Стороной и не считается допустившей нарушение настоящего Договора за неисполнение или просрочку исполнения любого обязательства по настоящему Договору, если и в той мере, в какой такое неисполнение или просрочка вызваны обстоятельствами вне разумного контроля пострадавшей Стороны («Событие форс-мажора»), включая, без ограничения:',
  forceMajeureEvents: [
    'Стихийные бедствия и иные обстоятельства непреодолимой силы (в том числе землетрясения, наводнения, ураганы, цунами) либо экстремальные погодные явления.',
    'Эпидемии или пандемии.',
    'Война (объявленная или необъявленная), вооружённый конфликт, акты терроризма, беспорядки или гражданские волнения.',
    'Действия органов власти, эмбарго, блокады либо изменения законодательства или нормативных актов.',
    'Трудовые споры, забастовки или локауты.',
    'Перебои или отказ коммунальных сетей, транспорта либо сетей связи.',
  ],
  forceMajeureNoticeTitle: '7.2 Уведомление и меры по снижению последствий',
  forceMajeureNotice:
    'Сторона, затронутая Событием форс-мажора, обязана направить другой Стороне письменное уведомление с указанием характера события, его предполагаемой продолжительности и степени, в которой исполнение обязательств будет задержано или невозможно. Затронутая Сторона обязана прилагать все разумные усилия для снижения последствий события и возобновить исполнение своих обязательств при первой разумной возможности.',
  forceMajeureReliefTitle: '7.3 Освобождение от исполнения и расторжение',
  forceMajeureRelief:
    'Если Событие форс-мажора продолжается непрерывно более 90 дней, любая из Сторон вправе расторгнуть настоящий Договор, направив письменное уведомление другой Стороне. В течение действия события обязательства пострадавшей Стороны по исполнению — за исключением обязанности произвести платежи, начисленные до наступления события, — приостанавливаются.',
  footerNote:
    'Черновик коммерческого предложения сформирован платформой на основе данных заявки. Документ предназначен для согласования и подписания Сторонами; перед подписанием рекомендуется юридическая проверка.',
  signaturesHeading: 'Подписи сторон',
  forContractor: 'От Подрядчика',
  forEmployer: 'От Заказчика',
  signatureLabel: 'Подпись',
  nameLabel: 'ФИО',
  titleLabel: 'Должность',
  dateLabel: 'Дата',
  defaultContractorTitle: 'Уполномоченный представитель',
  defaultEmployerTitle: 'Уполномоченный представитель',
  siteToBeConfirmed: 'Уточняется на объекте',
  registrationNo: (value) => `Рег. № ${value}`,
  representedBy: (value) => `В лице ${value}`,
  scopeFallback:
    'Как показано и описано в договорных документах, чертежах и спецификациях (Приложение №2).',
  dash: '—',
  noAdvancePayment: 'Авансовый платёж не предусмотрен.',
  advancePercentOf: (pct, amount) =>
    `${pct}% от Суммы договора (${amount})`,
  paymentAdvanceTiming:
    'Авансовый платёж (при наличии) выплачивается Заказчиком не позднее чем за две (2) недели до Даты начала работ, если иное не согласовано Сторонами при составлении настоящего Коммерческого предложения.',
  paymentShortPeriodFinal:
    'Если срок Договора менее двух (2) месяцев, Окончательный платёж подлежит уплате в течение одного (1) месяца после приёмки Работ (Practical Completion).',
  paymentMonthlyProgress:
    'Промежуточные платежи производятся на основании ежемесячной оценки выполненных работ в соответствии с настоящим Договором.',
  retentionShallBe: (pct, limit) =>
    `Удержание составляет ${pct}% стоимости выполненных работ, но не более ${limit}% от Принятой суммы договора.`,
  periodMonthsFromStart: (months) =>
    `${months} мес. с Даты начала работ`,
  periodDaysFromStart: (days) => `${days} дн. с Даты начала работ`,
  periodMasterSchedule: 'Согласно Генеральному графику (Приложение №3)',
  defaultPropertyOwnership:
    'Заказчик обладает законным правом на участок и правом поручать выполнение Работ.',
  defaultRetentionRelease:
    '5% при сертификате Taking-Over; 5% через 12 месяцев после Practical Completion.',
  defaultWarranty: (months) =>
    `Период уведомления о дефектах: ${months} мес. с момента Practical Completion.`,
  defaultDelayDamages:
    'Неустойка за просрочку: 0,2% Суммы договора в день, максимум 20% Суммы договора.',
  annex2EmptyIntro:
    'Чертежи, спецификации и иные технические документы, загруженные в проект на платформе, считаются частью настоящего Договора при их включении в перечень.',
  annex2EmptyNote:
    'Документы проекта на платформе пока не загружены. Приложение №2 подлежит дополнению чертежами и спецификациями до начала Работ.',
  annex2ListIntro:
    'Следующие документы проекта составляют Приложение №2 (Чертежи и спецификации):',
  annex2FilesNote:
    'Полные файлы доступны в рабочем пространстве проекта на платформе.',
  boqTrade: 'Раздел / позиция',
  boqDescription: 'Описание',
  boqAmount: 'Сумма (THB)',
  boqSubtotal: 'Итого',
  employerFallback: 'Заказчик',
  contractorFallback: 'Подрядчик',
};

const TH: CommercialProposalCopy = {
  documentTitle: (projectTitle) => `ข้อเสนอเชิงพาณิชย์ — ${projectTitle}`,
  contractHeading: 'สัญญาจ้างก่อสร้าง',
  of: 'ของ',
  byAndBetween: 'ระหว่าง:',
  employerLabel: 'ผู้ว่าจ้าง',
  contractorLabel: 'ผู้รับจ้าง',
  employerReferred: 'ซึ่งต่อไปในสัญญานี้เรียกว่า',
  contractorReferred: 'ซึ่งต่อไปในสัญญานี้เรียกว่า',
  andConnector: 'และ',
  partiesAgree:
    'คู่สัญญาทั้งสองฝ่ายตกลงทำสัญญานี้ภายใต้ข้อกำหนดและเงื่อนไขดังต่อไปนี้:',
  clause1: 'ข้อ 1 — คำนิยาม',
  constructionWorks: '“งานก่อสร้าง”',
  theProject: '“โครงการ”',
  propertySiteRights: 'สิทธิในทรัพย์สิน / ที่ดิน:',
  meansAt: (subject, site) => `หมายถึง ${subject} ณ ${site}`,
  projectMeans:
    'หมายถึงการทำงานให้แล้วเสร็จตามที่ระบุในภาคผนวก #2 (แบบและสเปก) และสัญญานี้',
  clause2: 'ข้อ 2 — ขอบเขตงาน',
  implementationApproach: 'แนวทางการดำเนินงาน:',
  commentsAssumptions: 'หมายเหตุ / ข้อสมมติ:',
  clause3: 'ข้อ 3 — มูลค่าสัญญา',
  employerAgreesToPay: (amount, numeric) =>
    `ผู้ว่าจ้างตกลงชำระมูลค่าสัญญา (รวมภาษีที่เกี่ยวข้อง) จำนวน ${amount} (THB ${numeric}) (“มูลค่าสัญญา”)`,
  noAdjustment:
    'ไม่อนุญาตให้ปรับราคาเนื่องจากต้นทุนวัสดุ แรงงาน อุปกรณ์ หรือบริการระหว่างอายุสัญญา เว้นแต่ตกลงเป็นลายลักษณ์อักษรในฐานะ Variation Order',
  annex1Boq: 'ภาคผนวก #1 — บัญชีปริมาณงาน (BOQ)',
  annex2Drawings: 'ภาคผนวก #2 — แบบและสเปก',
  clause5: 'ข้อ 5 — ระยะเวลางาน',
  worksCommencementDate: 'วันเริ่มงาน:',
  worksCompletedWithin: (period) =>
    `ขอบเขตงานทั้งหมดต้องแล้วเสร็จภายใน ${period}`,
  delayDamages: 'ค่าปรับความล่าช้า:',
  clause6: 'ข้อ 6 — การชำระเงิน การกันเงิน และระยะรับประกัน',
  advancePayment: '6.1 เงินล่วงหน้า:',
  termsOfPayment: '6.2 เงื่อนไขการชำระเงิน:',
  retention: '6.5 การกันเงิน:',
  releaseOfRetention: '6.6 การคืนเงินกัน:',
  defectWarranty: '6.7 ระยะแจ้งข้อบกพร่อง / การรับประกัน:',
  clarifications: 'คำชี้แจงของผู้รับจ้าง',
  specialConditions: 'เงื่อนไขพิเศษ',
  clauseForceMajeure: 'ข้อ 7 — เหตุสุดวิสัย (Force Majeure)',
  forceMajeureDefinitionTitle: '7.1 คำนิยามเหตุสุดวิสัย',
  forceMajeureDefinition:
    'คู่สัญญาฝ่ายใดฝ่ายหนึ่งไม่ต้องรับผิดชอบต่ออีกฝ่าย และไม่ถือว่าผิดนัดหรือผิดสัญญานี้ สำหรับความล้มเหลวหรือความล่าช้าในการปฏิบัติตามข้อกำหนดใด ๆ ของสัญญานี้ เมื่อและเท่าที่ความล้มเหลวหรือความล่าช้าดังกล่าวเกิดจากหรือเป็นผลจากเหตุการณ์ที่อยู่นอกเหนือการควบคุมโดยสมควรของคู่สัญญาที่ได้รับผลกระทบ (“เหตุสุดวิสัย”) รวมถึงแต่ไม่จำกัดเพียง:',
  forceMajeureEvents: [
    'ภัยพิบัติทางธรรมชาติหรือเหตุสุดวิสัย (เช่น แผ่นดินไหว น้ำท่วม พายุเฮอริเคน หรือสึนามิ) หรือสภาพอากาศสุดขั้ว',
    'โรคระบาดหรือการระบาดใหญ่',
    'สงคราม (ประกาศหรือไม่ประกาศ) ความขัดแย้งด้วยอาวุธ การก่อการร้าย การจลาจล หรือความไม่สงบเรียบร้อยของประชาชน',
    'การกระทำของรัฐบาล การห้ามส่งออก/นำเข้า การปิดล้อม หรือการเปลี่ยนแปลงกฎหมายหรือกฎระเบียบ',
    'ข้อพิพาทแรงงาน การนัดหยุดงาน หรือการปิดงาน',
    'การหยุดชะงักหรือความล้มเหลวของสาธารณูปโภค การขนส่ง หรือเครือข่ายโทรคมนาคม',
  ],
  forceMajeureNoticeTitle: '7.2 การแจ้งและการลดผลกระทบ',
  forceMajeureNotice:
    'คู่สัญญาที่ได้รับผลกระทบจากเหตุสุดวิสัยต้องแจ้งเป็นหนังสือแก่อีกฝ่าย โดยระบุลักษณะของเหตุการณ์ ระยะเวลาโดยประมาณ และขอบเขตที่การปฏิบัติตามสัญญาจะล่าช้าหรือเป็นไปไม่ได้ คู่สัญญาที่ได้รับผลกระทบต้องใช้ความพยายามโดยสมควรทั้งหมดเพื่อลดผลกระทบของเหตุการณ์ และกลับมาปฏิบัติตามภาระผูกพันโดยเร็วที่สุดเท่าที่สามารถทำได้อย่างสมเหตุสมผล',
  forceMajeureReliefTitle: '7.3 การผ่อนผันการปฏิบัติตามและการบอกเลิกสัญญา',
  forceMajeureRelief:
    'หากเหตุสุดวิสัยดำเนินต่อเนื่องเกิน 90 วัน คู่สัญญาฝ่ายใดฝ่ายหนึ่งอาจบอกเลิกสัญญานี้โดยแจ้งเป็นหนังสือแก่อีกฝ่าย ในระหว่างเหตุการณ์ดังกล่าว ภาระผูกพันในการปฏิบัติตามของคู่สัญญาที่ได้รับผลกระทบ—ยกเว้นภาระในการชำระเงินที่เกิดขึ้นก่อนเหตุการณ์—ให้ระงับไว้',
  footerNote:
    'ร่างข้อเสนอเชิงพาณิชย์สร้างโดยแพลตฟอร์มจากข้อมูลใบเสนอราคา เอกสารนี้มีไว้ให้คู่สัญญาตรวจทานและลงนาม แนะนำให้ตรวจสอบทางกฎหมายก่อนลงนาม',
  signaturesHeading: 'ลายเซ็นคู่สัญญา',
  forContractor: 'ฝ่ายผู้รับจ้าง',
  forEmployer: 'ฝ่ายผู้ว่าจ้าง',
  signatureLabel: 'ลายเซ็น',
  nameLabel: 'ชื่อ',
  titleLabel: 'ตำแหน่ง',
  dateLabel: 'วันที่',
  defaultContractorTitle: 'ผู้มีอำนาจลงนาม',
  defaultEmployerTitle: 'ผู้มีอำนาจลงนาม',
  siteToBeConfirmed: 'จะยืนยันที่หน้างาน',
  registrationNo: (value) => `เลขทะเบียน ${value}`,
  representedBy: (value) => `โดยผู้แทน ${value}`,
  scopeFallback:
    'ตามที่แสดงและอธิบายในเอกสารสัญญา แบบ และสเปก (ภาคผนวก #2)',
  dash: '—',
  noAdvancePayment: 'ไม่มีเงินล่วงหน้า',
  advancePercentOf: (pct, amount) =>
    `${pct}% ของมูลค่าสัญญา (${amount})`,
  paymentAdvanceTiming:
    'เงินล่วงหน้า (ถ้ามี) ต้องชำระโดยผู้ว่าจ้างไม่ช้ากว่าสอง (2) สัปดาห์ก่อนวันเริ่มงาน เว้นแต่คู่สัญญาจะตกลงเป็นอย่างอื่นเมื่อจัดทำข้อเสนอเชิงพาณิชย์นี้',
  paymentShortPeriodFinal:
    'หากระยะเวลาสัญญาน้อยกว่าสอง (2) เดือน การชำระเงินงวดสุดท้ายครบกำหนดภายในหนึ่ง (1) เดือนหลังการตรวจรับงาน (Practical Completion)',
  paymentMonthlyProgress:
    'การชำระเงินตามงวดความคืบหน้าอิงการประเมินรายเดือนตามสัญญานี้',
  retentionShallBe: (pct, limit) =>
    `กันเงิน ${pct}% ของมูลค่างานที่ทำแล้ว โดยไม่เกิน ${limit}% ของมูลค่าสัญญาที่รับแล้ว`,
  periodMonthsFromStart: (months) =>
    `${months} เดือนนับจากวันเริ่มงาน`,
  periodDaysFromStart: (days) => `${days} วันนับจากวันเริ่มงาน`,
  periodMasterSchedule: 'ตามตารางหลัก (ภาคผนวก #3)',
  defaultPropertyOwnership:
    'ผู้ว่าจ้างมีกรรมสิทธิ์หรือสิทธิโดยชอบในที่ดินและสิทธิมอบหมายงาน',
  defaultRetentionRelease:
    '5% เมื่อออก Taking-Over Certificate; 5% หลัง 12 เดือนจาก Practical Completion',
  defaultWarranty: (months) =>
    `ระยะแจ้งข้อบกพร่อง: ${months} เดือนนับจาก Practical Completion`,
  defaultDelayDamages:
    'ค่าปรับความล่าช้า 0.2% ของมูลค่าสัญญาต่อวัน สูงสุด 20% ของมูลค่าสัญญา',
  annex2EmptyIntro:
    'แบบ สเปก และเอกสารทางเทคนิคที่อัปโหลดในโครงการบนแพลตฟอร์มถือเป็นส่วนหนึ่งของสัญญานี้เมื่อระบุไว้ในรายการนี้',
  annex2EmptyNote:
    'ยังไม่มีเอกสารโครงการบนแพลตฟอร์ม ภาคผนวก #2 จะต้องเติมแบบและสเปกก่อนเริ่มงาน',
  annex2ListIntro:
    'เอกสารโครงการต่อไปนี้เป็นภาคผนวก #2 (แบบและสเปก):',
  annex2FilesNote:
    'ไฟล์ฉบับเต็มดูได้ในพื้นที่ทำงานของโครงการบนแพลตฟอร์ม',
  boqTrade: 'หมวด / รายการ',
  boqDescription: 'รายละเอียด',
  boqAmount: 'จำนวนเงิน (THB)',
  boqSubtotal: 'รวมย่อย',
  employerFallback: 'ผู้ว่าจ้าง',
  contractorFallback: 'ผู้รับจ้าง',
};

const COPY: Record<SupportedLocale, CommercialProposalCopy> = {
  en: EN,
  ru: RU,
  th: TH,
};

export function commercialProposalCopy(
  locale?: string | null,
): CommercialProposalCopy {
  if (locale && isSupportedLocale(locale)) {
    return COPY[locale];
  }
  return COPY[DEFAULT_LOCALE];
}

export function parseCommercialProposalLocales(
  raw?: string | string[] | null,
): SupportedLocale[] {
  const values = Array.isArray(raw)
    ? raw
    : raw
      ?.split(',')
      .map((part) => part.trim())
      .filter(Boolean) ?? [];

  const unique: SupportedLocale[] = [];
  for (const value of values) {
    if (isSupportedLocale(value) && !unique.includes(value)) {
      unique.push(value);
    }
  }
  return unique;
}

/** Contract PDF language order when multiple locales are selected. */
export const COMMERCIAL_PROPOSAL_LOCALE_ORDER: SupportedLocale[] = [
  'en',
  'th',
  'ru',
];

export function sortCommercialProposalLocales(
  locales: SupportedLocale[],
): SupportedLocale[] {
  return COMMERCIAL_PROPOSAL_LOCALE_ORDER.filter((locale) =>
    locales.includes(locale),
  );
}
