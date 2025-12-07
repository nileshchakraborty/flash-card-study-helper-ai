export type GenerateRequestBody = {
  topic?: unknown;
  count?: unknown;
  mode?: unknown;
  knowledgeSource?: unknown;
  runtime?: unknown;
  parentTopic?: unknown;
};

export function isValidGenerateBody(body: GenerateRequestBody): body is Required<Pick<GenerateRequestBody, 'topic'>> & { count?: number } {
  // Topic validation
  if (typeof body.topic !== 'string' || body.topic.trim().length === 0) {
    return false;
  }

  // Topic length check (max 200 chars)
  if (body.topic.length > 200) {
    return false;
  }

  // Count validation (if provided)
  if (body.count !== undefined) {
    const count = typeof body.count === 'string' ? parseInt(body.count, 10) : body.count;
    if (typeof count !== 'number' || isNaN(count) || count < 1 || count > 50) {
      return false;
    }
  }

  return true;
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
