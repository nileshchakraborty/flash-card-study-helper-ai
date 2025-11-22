/**
 * Flash Card Study Helper (runtime JS)
 * Provides utilities to build flashcard decks, generate study plans, and create quizzes.
 */

class FlashCardDeck {
  constructor(initialCards = []) {
    this.cards = [...initialCards];
  }

  addCard(card) {
    this.cards.push(card);
  }

  addCards(cards) {
    this.cards.push(...cards);
  }

  removeById(cardId) {
    this.cards = this.cards.filter((card) => card.id !== cardId);
  }

  findByTag(tag) {
    return this.cards.filter((card) => card.tags.includes(tag));
  }

  sample(size) {
    const shuffled = [...this.cards].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(size, shuffled.length));
  }

  getAll() {
    return [...this.cards];
  }
}

class StudyPlanGenerator {
  constructor(deck) {
    this.deck = deck;
  }

  createPlan(topic, durationDays = 5) {
    const cards = this.deck.getAll();
    const dailyQuota = Math.max(1, Math.ceil(cards.length / durationDays));

    const entries = Array.from({ length: durationDays }, (_, idx) => {
      const day = idx + 1;
      const dayCards = cards.slice(idx * dailyQuota, (idx + 1) * dailyQuota);
      return {
        day,
        objectives: this.buildObjectives(topic, day, dayCards.length),
        flashcards: dayCards.map((card) => card.id),
        quizSize: Math.min(5, dayCards.length || 5),
      };
    }).filter((entry) => entry.flashcards.length > 0);

    return {
      topic,
      durationDays: entries.length,
      entries,
    };
  }

  buildObjectives(topic, day, cardCount) {
    const focus = day === 1 ? "core definitions" : day === 2 ? "applications" : "mixed review";
    return [
      `Review ${cardCount} flashcards on ${topic}`,
      `Focus on ${focus}`,
      `Complete quiz for day ${day}`,
    ];
  }
}

class QuizEngine {
  constructor(deck) {
    this.deck = deck;
  }

  generateQuiz(size = 5) {
    return this.deck.sample(size);
  }

  gradeQuiz(answers) {
    const cards = this.deck.getAll();
    return answers.map((answer) => {
      const card = cards.find((c) => c.id === answer.cardId);
      if (!card) {
        throw new Error(`Card with id ${answer.cardId} not found`);
      }
      const normalizedExpected = card.answer.trim().toLowerCase();
      const normalizedResponse = answer.response.trim().toLowerCase();
      return {
        cardId: answer.cardId,
        correct: normalizedExpected === normalizedResponse,
        expected: card.answer,
        response: answer.response,
      };
    });
  }
}

class ResourceToFlashCardConverter {
  constructor(topic) {
    this.topic = topic;
  }

  convert(resource) {
    const baseId = resource.name.replace(/\W+/g, "-").toLowerCase();
    const sentences = resource.content
      .split(/[.!?]/g)
      .map((s) => s.trim())
      .filter(Boolean);

    return sentences.map((sentence, idx) => {
      const question = this.buildQuestion(sentence, idx);
      const answer = sentence;
      return {
        id: `${baseId}-${idx + 1}`,
        question,
        answer,
        tags: [this.topic, resource.mimeType],
      };
    });
  }

  buildQuestion(sentence, idx) {
    const snippet = sentence.length > 80 ? `${sentence.slice(0, 77)}...` : sentence;
    return `Q${idx + 1}: What does this statement refer to? ${snippet}`;
  }
}

function demo() {
  const topic = "Neural Networks";
  const uploadedResources = [
    {
      name: "intro.pdf",
      mimeType: "application/pdf",
      content:
        "A neural network is a series of algorithms that endeavors to recognize underlying relationships in a set of data. Neural networks can adapt to changing input.",
    },
    {
      name: "diagram.png",
      mimeType: "image/png",
      content: "Layers include input, hidden, and output nodes. Backpropagation tunes weights to minimize loss.",
    },
  ];

  const converter = new ResourceToFlashCardConverter(topic);
  const deck = new FlashCardDeck();
  uploadedResources.forEach((resource) => {
    const cards = converter.convert(resource);
    deck.addCards(cards);
  });

  const planGenerator = new StudyPlanGenerator(deck);
  const plan = planGenerator.createPlan(topic, 4);

  const quizEngine = new QuizEngine(deck);
  const quiz = quizEngine.generateQuiz(3);

  console.log("Study Plan:\n", JSON.stringify(plan, null, 2));
  console.log("\nSample Quiz Questions:\n", quiz.map((card) => card.question));

  const sampleAnswers = quiz.map((card) => ({ cardId: card.id, response: card.answer }));
  const results = quizEngine.gradeQuiz(sampleAnswers);
  console.log("\nQuiz Results:\n", results);
}

if (require.main === module) {
  demo();
}

module.exports = {
  FlashCardDeck,
  StudyPlanGenerator,
  QuizEngine,
  ResourceToFlashCardConverter,
};
