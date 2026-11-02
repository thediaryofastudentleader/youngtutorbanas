export type BoardLineKind = "working" | "result" | "note";

export type BoardLine = {
  text: string;
  kind: BoardLineKind;
};

export type ClassroomQuestion = {
  id: string;
  label: string;
  prompt: string;
  marks: number | null;
  page: number | null;
  answerLines?: BoardLine[];
  answerGrounded?: boolean;
};

export type AiProviderStatus = {
  provider: "DeepSeek";
  modelId: string;
  supportsImages: boolean;
};
