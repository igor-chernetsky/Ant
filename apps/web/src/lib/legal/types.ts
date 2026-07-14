export type LegalSection = {
  title: string;
  paragraphs: string[];
};

export type LegalDocument = {
  title: string;
  updatedLabel: string;
  intro: string;
  sections: LegalSection[];
};
