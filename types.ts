
export interface Dialogue {
  speaker: string;
  jp: string;
  zh: string;
}

export interface Scenario {
  id: number;
  title: string;
  dialogues: Dialogue[];
}

export interface Feedback {
  text: string;
  color: string;
}
