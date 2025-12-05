export type GenerateRequestBody = {
  topic?: unknown;
  count?: unknown;
  mode?: unknown;
  knowledgeSource?: unknown;
  runtime?: unknown;
  parentTopic?: unknown;
};

export function isValidGenerateBody(body: GenerateRequestBody): body is Required<Pick<GenerateRequestBody, 'topic'>> & { count?: number } {
  return typeof body.topic === 'string' && body.topic.trim().length > 0;
}

export type QuizRequestBody = {
  topic?: unknown;
  numQuestions?: unknown;
  count?: unknown;
  flashcardIds?: unknown;
  cards?: unknown;
};

export function isValidQuizBody(body: QuizRequestBody): boolean {
  const hasTopic = typeof body.topic === 'string' && body.topic.trim().length > 0;
  const hasFlashcards = Array.isArray(body.flashcardIds) || Array.isArray(body.cards);
  return hasTopic || hasFlashcards;
}
