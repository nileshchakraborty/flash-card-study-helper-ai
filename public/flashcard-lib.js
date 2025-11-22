/**
 * Browser-friendly flashcard utilities used by the demo UI.
 */

export class FlashCardDeck {
  constructor(initialCards = []) {
    this.cards = [...initialCards];
  }

  addCard(card) {
    this.cards.push(card);
  }

  addCards(cards) {
    this.cards.push(...cards);
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

  removeById(cardId) {
    this.cards = this.cards.filter((card) => card.id !== cardId);
  }
}

export class StudyPlanGenerator {
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

export class ResourceToFlashCardConverter {
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
