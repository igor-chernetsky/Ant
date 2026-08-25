import type { Messages } from './en';
import { thExtended } from './th-extended';

const { homePage, common: commonExtended, ...extendedNamespaces } = thExtended;

export const th: Messages = {
  common: {
    cancel: 'ยกเลิก',
    confirm: 'ยืนยัน',
    pleaseWait: 'กรุณารอสักครู่…',
    close: 'ปิด',
    loading: 'กำลังโหลด…',
    email: 'อีเมล',
    password: 'รหัสผ่าน',
    home: 'หน้าแรก',
    optional: 'ไม่บังคับ',
    saved: 'บันทึกแล้ว',
    dash: '—',
    ...commonExtended,
  },
  header: {
    admin: 'ผู้ดูแล',
    contractors: 'ผู้รับเหมา',
    supplyRegistry: 'ทะเบียน',
    signatureRequests: 'คำขอลงนาม',
    settings: 'การตั้งค่า',
    ads: 'โฆษณา',
    projectsTable: 'ตารางโครงการ',
    clients: 'ลูกค้า',
    contractor: 'ผู้รับเหมา',
    designer: 'ผู้ออกแบบ',
    account: 'บัญชี',
    materials: 'วัสดุ',
    projects: 'โครงการ',
    help: 'ช่วยเหลือ',
    primaryNav: 'เมนูหลัก',
    signIn: 'เข้าสู่ระบบ',
    signOut: 'ออกจากระบบ',
    signedIn: 'เข้าสู่ระบบแล้ว',
    language: 'ภาษา',
    lang_en: 'English',
    lang_th: 'ไทย',
    lang_ru: 'Русский',
  },
  notifications: {
    title: 'การแจ้งเตือน',
    ariaLabel: 'การแจ้งเตือน',
    empty: 'ยังไม่มีการแจ้งเตือน',
    markAllRead: 'อ่านทั้งหมด',
    open: 'เปิด',
    kinds: {
      clientBidSubmittedTitle: 'ได้รับข้อเสนอเชิงพาณิชย์',
      clientBidSubmittedBody:
        '{company} ส่งข้อเสนอสำหรับ {project} ({amount} THB)',
      clientBidEnrolledTitle: 'ใบสมัครเข้าร่วมใหม่',
      clientBidEnrolledBody:
        '{company} สมัครเป็นผู้เข้าแข่ง #{n} ใน {project}',
      clientClarificationQuestionsTitle: 'ได้รับคำถามชี้แจง',
      clientClarificationQuestionsBody:
        '{company} ส่งคำถามชี้แจง ({count}) สำหรับ {project}',
      clientBidMessageTitle: 'ข้อความใหม่ในโครงการของคุณ',
      clientBidMessageBody: '{project}: {preview}',
      clientTenderDeadlineTitle: 'ครบกำหนดรับใบสมัคร',
      clientTenderDeadlineBody:
        'ครบกำหนดรับใบสมัครสำหรับ {project} แล้ว',
      clientDeclinedProposalTitle: 'ผู้รับเหมาปฏิเสธการเสนอ',
      clientDeclinedProposalBody:
        '{company} ปฏิเสธการส่งข้อเสนอสำหรับ {project}',
      contractorCounterOfferTitle: 'ได้รับข้อเสนอตอบกลับ',
      contractorBidSelectedTitle: 'คุณถูกเลือก',
      contractTermsUpdatedTitle: 'อัปเดตเงื่อนไขสัญญาแล้ว',
      contractTermsUpdatedBody:
        'เงื่อนไขสัญญาของ {project} ถูกอัปเดตแล้ว ตรวจสอบและลงนามอีกครั้งหากจำเป็น',
      contractCustomFileUpdatedBody:
        'มีการอัปโหลดไฟล์สัญญาสำหรับ {project} ลายเซ็นก่อนหน้าถูกล้างแล้ว',
      contractPartySignedTitle: 'มีการลงนามในสัญญา',
      contractFullySignedTitle: 'ลงนามสัญญาครบแล้ว',
      contractAddendumCreatedTitle: 'สร้างข้อตกลงเพิ่มเติมแล้ว',
      contractAddendumCreatedBody:
        'สร้าง “{addendum}” ใน {project} แล้ว ผู้รับเหมาต้องลงนามก่อน',
      contractAddendumPartySignedTitle: 'มีการลงนามข้อตกลงเพิ่มเติม',
      contractAddendumPartySignedBody:
        'มีฝ่ายหนึ่งลงนาม “{addendum}” ใน {project}',
      contractAddendumFullySignedTitle: 'ลงนามข้อตกลงเพิ่มเติมครบแล้ว',
      contractAddendumFullySignedBody:
        '“{addendum}” ลงนามครบแล้วใน {project}',
      adminSignatureRequestCreatedTitle: 'คำขออนุญาตลงนาม',
      adminSignatureRequestCreatedBody:
        '{company} ขออนุญาตลงนามใน {project}',
      contractorSignatureRequestApprovedTitle: 'อนุญาตให้ลงนามแล้ว',
      contractorSignatureRequestApprovedBody:
        'คุณสามารถลงนามสัญญาใน {project} ได้แล้ว',
      contractorSignatureRequestRejectedTitle: 'คำขอลงนามถูกปฏิเสธ',
      contractorSignatureRequestRejectedBody:
        'คำขออนุญาตสำหรับ {project} ถูกปฏิเสธ',
      clientProgressClaimSubmittedTitle: 'ได้รับ progress claim',
      clientProgressClaimSubmittedBody:
        '{company} ส่ง claim #{n} สำหรับ {project} ({amount} THB)',
      contractorProgressClaimApprovedTitle: 'อนุมัติ progress claim แล้ว',
      contractorProgressClaimApprovedBody:
        'Claim #{n} ของ {project} ได้รับการอนุมัติ ({amount} THB)',
      contractorProgressClaimRejectedTitle: 'progress claim ถูกปฏิเสธ',
      contractorProgressClaimRejectedBody:
        'Claim #{n} ของ {project} ถูกปฏิเสธ',
      contractorAdvancePaymentSlipAttachedTitle: 'ส่งสลิปเงินล่วงหน้าแล้ว',
      contractorAdvancePaymentSlipAttachedBody:
        'ลูกค้าส่งสลิปเงินล่วงหน้า {count} ไฟล์ใน {project} ({amount} THB)',
      contractorProgressClaimPaymentSlipAttachedTitle: 'ส่งสลิปการชำระแล้ว',
      contractorProgressClaimPaymentSlipAttachedBody:
        'ลูกค้าส่งสลิป {count} ไฟล์สำหรับ claim #{n} ใน {project} ({amount} THB)',
      contractorDefectReportedTitle: 'มีการรายงานข้อบกพร่อง',
      contractorDefectReportedBody:
        'มีการรายงานข้อบกพร่อง #{n} ใน {project}',
      contractorDefectResubmittedTitle: 'ส่งข้อบกพร่องใหม่',
      contractorDefectResubmittedBody:
        'ข้อบกพร่อง #{n} ใน {project} ถูกส่งใหม่',
      contractorDefectCompletionRejectedTitle: 'ปฏิเสธการแก้ไข',
      contractorDefectCompletionRejectedBody:
        'การแก้ไขข้อบกพร่อง #{n} ใน {project} ถูกปฏิเสธ',
      contractorDefectClosedTitle: 'ปิดข้อบกพร่องแล้ว',
      contractorDefectClosedBody:
        'ข้อบกพร่อง #{n} ใน {project} ถูกปิดแล้ว',
      clientDefectDeclinedTitle: 'ปฏิเสธข้อบกพร่อง',
      clientDefectDeclinedBody:
        'ข้อบกพร่อง #{n} ใน {project} ถูกปฏิเสธ',
      clientDefectAcceptedTitle: 'รับข้อบกพร่องเข้าทำงาน',
      clientDefectAcceptedBody:
        'ข้อบกพร่อง #{n} ใน {project} ถูกรับเข้าทำงาน',
      clientDefectCompletedTitle: 'ทำเครื่องหมายว่าแก้เสร็จ',
      clientDefectCompletedBody:
        'ข้อบกพร่อง #{n} ใน {project} ถูกทำเครื่องหมายว่าแก้เสร็จ',
      clientProjectCompletionRequestedTitle: 'ลูกค้าขอปิดโครงการ',
      clientProjectCompletionRequestedBody:
        'ลูกค้าขอปิดโครงการ {project} ยืนยันบนหน้าโครงการ',
      contractorProjectCompletionRequestedTitle: 'ผู้รับเหมาขอปิดโครงการ',
      contractorProjectCompletionRequestedBody:
        'ผู้รับเหมาขอปิดโครงการ {project} ยืนยันบนหน้าโครงการ',
      clientProjectCompletionConfirmedTitle: 'ลูกค้ายืนยันการปิดโครงการ',
      clientProjectCompletionConfirmedBody:
        'ลูกค้ายืนยันการปิดโครงการ {project} โครงการปิดแล้ว',
      contractorProjectCompletionConfirmedTitle: 'ผู้รับเหมายืนยันการปิดโครงการ',
      contractorProjectCompletionConfirmedBody:
        'ผู้รับเหมายืนยันการปิดโครงการ {project} โครงการปิดแล้ว',
      genericProjectBody: 'เกี่ยวข้องกับ {project}',
    },
  },
  footer: {
    copyright: '© {year} BuilTHAI. สงวนลิขสิทธิ์',
    legalNav: 'ข้อมูลทางกฎหมาย',
    privacyPolicy: 'นโยบายความเป็นส่วนตัว',
    termsOfService: 'เงื่อนไขการใช้บริการ',
    clientAgreement: 'ข้อตกลงลูกค้า',
    contractorAgreement: 'ข้อตกลงผู้รับเหมา',
    materials: 'แพลตฟอร์มวัสดุ',
    help: 'ช่วยเหลือ',
    forClients: 'สำหรับลูกค้า',
    forContractors: 'สำหรับผู้รับเหมา',
  },
  auth: {
    welcomeBack: 'ยินดีต้อนรับกลับ',
    createAccount: 'สร้างบัญชีของคุณ',
    signInSubtitle: 'เข้าสู่ระบบเพื่อจัดการโครงการและข้อเสนอจากผู้รับเหมา',
    signUpSubtitle: 'เข้าร่วม BuilTHAI เพื่อเผยแพร่โครงการหรือตอบรับการประมูล',
    fullName: 'ชื่อ-นามสกุล',
    showPassword: 'แสดงรหัสผ่าน',
    hidePassword: 'ซ่อนรหัสผ่าน',
    emailPlaceholder: 'you@example.com',
    roleLegend: 'บทบาทของคุณ',
    roleHint: 'เลือกวิธีใช้งานแพลตฟอร์ม คุณสามารถเปลี่ยนได้ภายหลัง',
    signingIn: 'กำลังเข้าสู่ระบบ…',
    creatingAccount: 'กำลังสร้างบัญชี…',
    createAccountButton: 'สร้างบัญชี',
    newToAnt: 'ใหม่กับ BuilTHAI?',
    createAnAccount: 'สร้างบัญชี',
    alreadyHaveAccount: 'มีบัญชีอยู่แล้ว?',
    signInFailed: 'เข้าสู่ระบบไม่สำเร็จ',
    signUpFailed: 'สร้างบัญชีไม่สำเร็จ',
    forgotPasswordLink: 'ลืมรหัสผ่าน?',
    forgotPasswordTitle: 'รีเซ็ตรหัสผ่าน',
    forgotPasswordSubtitle:
      'กรอกอีเมล แล้วเราจะส่งลิงก์ให้ตั้งรหัสผ่านใหม่',
    sendResetLink: 'ส่งลิงก์รีเซ็ต',
    sendingResetLink: 'กำลังส่ง…',
    forgotPasswordSent:
      'หากมีบัญชีที่ใช้อีเมลนี้ คุณจะได้รับลิงก์รีเซ็ตรหัสผ่านในไม่ช้า ตรวจสอบกล่องจดหมายและสแปม',
    forgotPasswordFailed: 'ส่งอีเมลรีเซ็ตรหัสผ่านไม่สำเร็จ ลองอีกครั้งภายหลัง',
    rememberedPassword: 'จำรหัสผ่านได้แล้ว?',
    verifyEmailDefault:
      'สร้างบัญชีแล้ว ตรวจสอบอีเมลและยืนยันที่อยู่อีเมลก่อนเข้าสู่ระบบ',
    roleClient: 'ลูกค้า',
    roleContractor: 'ผู้รับเหมา',
    roleDesigner: 'นักออกแบบ',
    acceptPrivacyPrefix: 'ฉันยอมรับ',
    acceptTermsPrefix: 'ฉันยอมรับ',
    acceptClientAgreementPrefix: 'ฉันยอมรับ',
    acceptContractorAgreementPrefix: 'ฉันยอมรับ',
    acceptLegalRequired:
      'โปรดยอมรับนโยบายความเป็นส่วนตัวและข้อตกลงสำหรับบทบาทที่เลือกเพื่อสร้างบัญชี',
  },
  home: {
    kicker: 'ตลาด BuilTHAI',
    title: 'โครงการก่อสร้าง',
    lead:
      'เรียกดูโอกาสการปรับปรุงและก่อสร้าง เผยแพร่โครงการของคุณ รับประมาณการเบื้องต้น และรวบรวมข้อเสนอจากผู้รับเหมา',
    addProject: 'เพิ่มโครงการ',
    signInToPublish: 'เข้าสู่ระบบเพื่อเผยแพร่',
    contractorPortal: 'พอร์ทัลผู้รับเหมา',
    ...homePage,
  },
  account: {
    title: 'บัญชีของคุณ',
    breadcrumb: 'บัญชี',
    signInPrompt: 'เข้าสู่ระบบเพื่อจัดการบัญชีและการแจ้งเตือน',
    loadFailed: 'โหลดการตั้งค่าไม่สำเร็จ',
    saveFailed: 'บันทึกไม่สำเร็จ',
    profile: 'โปรไฟล์',
    companyName: 'ชื่อบริษัท',
    name: 'ชื่อ',
    role: 'บทบาท',
    roleClient: 'ลูกค้า',
    roleContractor: 'ผู้รับเหมา',
    roleDesigner: 'ผู้ออกแบบ',
    roleAdmin: 'ผู้ดูแล',
    contractorHint: 'อัปเดตโปรไฟล์ผู้รับเหมาและความเชี่ยวชาญได้ที่',
    contractorPortal: 'พอร์ทัลผู้รับเหมา',
    designerHint: 'อัปเดตโปรไฟล์ผู้ออกแบบและความเชี่ยวชาญได้ที่',
    designerPortal: 'พอร์ทัลผู้ออกแบบ',
    emailNotifications: 'การแจ้งเตือนทางอีเมล',
    emailNotificationsHint:
      'เลือกการอัปเดตที่เราส่งไปยัง {email} คุณสามารถปิดทั้งหมดได้ตลอดเวลา',
    allEmailNotifications: 'การแจ้งเตือนทางอีเมลทั้งหมด',
    allEmailNotificationsDesc: 'สวิตช์หลักสำหรับอีเมลจาก BuilTHAI',
    bidsOnProjects: 'การประมูลในโครงการของฉัน',
    bidsOnProjectsDesc:
      'ใบสมัคร ข้อเสนอ และข้อความใหม่จากผู้รับเหมา',
    myBidActivity: 'กิจกรรมการประมูลของฉัน',
    myBidActivityDesc:
      'ข้อความจากลูกค้า ข้อเสนอตอบกลับ และผลการประมูล',
    matchingProjects: 'โครงการใหม่ที่ตรงกับความเชี่ยวชาญ',
    matchingProjectsDesc:
      'โครงการที่ตรงกับความเชี่ยวชาญของคุณ (สูงสุด {cap} อีเมลต่อวัน)',
  },
  ...extendedNamespaces,
};
