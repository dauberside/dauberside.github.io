export type TextPreview = {
  key: string;
  fileName: string;
  mimeType?: string;
  size?: number;
  hasText: boolean;
  text?: string;
};

export type DirectAgentInput = {
  message: string;
  previews?: TextPreview[];
  useKb?: boolean;
  kbQuery?: string;
};

export type DirectAgentResult = {
  reply: string;
  usedKb: boolean;
  previews: number;
};
