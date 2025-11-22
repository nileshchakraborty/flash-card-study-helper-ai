import { FlashCardDeck, ResourceToFlashCardConverter, StudyPlanGenerator } from './flashcard-lib.js';

const topic = 'Neural Networks';
const uploadedResources = [
  {
    name: 'intro.pdf',
    mimeType: 'application/pdf',
    content:
      'A neural network is a series of algorithms that endeavors to recognize underlying relationships in a set of data. Neural networks can adapt to changing input.',
  },
  {
    name: 'diagram.png',
    mimeType: 'image/png',
    content: 'Layers include input, hidden, and output nodes. Backpropagation tunes weights to minimize loss.',
  },
];

const converter = new ResourceToFlashCardConverter(topic);
const deck = new FlashCardDeck();
uploadedResources.forEach((resource) => deck.addCards(converter.convert(resource)));
const planGenerator = new StudyPlanGenerator(deck);

let leftSwipes = 0;
let rightSwipes = 0;
let activeCard = null;

const stackEl = document.getElementById('card-stack');
const leftCountEl = document.getElementById('left-count');
const rightCountEl = document.getElementById('right-count');
const remainingEl = document.getElementById('cards-remaining');
const planOutputEl = document.getElementById('plan-output');
const rebuildBtn = document.getElementById('rebuild-plan');
const reviseBtn = document.getElementById('revise-btn');
const nextBtn = document.getElementById('next-btn');

function updateStats() {
  leftCountEl.textContent = leftSwipes.toString();
  rightCountEl.textContent = rightSwipes.toString();
  remainingEl.textContent = deck.getAll().length.toString();
}

function renderPlan() {
  const cardsRemaining = deck.getAll();
  if (!cardsRemaining.length) {
    planOutputEl.innerHTML = '<p class="empty-state">All cards mastered. Recreate to start over.</p>';
    return;
  }

  const plan = planGenerator.createPlan(topic, Math.min(5, cardsRemaining.length));
  planOutputEl.innerHTML = '';
  const summary = document.createElement('p');
  summary.textContent = `${leftSwipes} left swipes, ${rightSwipes} right swipes → ${cardsRemaining.length} cards to review.`;
  planOutputEl.appendChild(summary);

  plan.entries.forEach((entry) => {
    const entryEl = document.createElement('div');
    entryEl.className = 'plan-entry';
    entryEl.innerHTML = `
      <h3>Day ${entry.day}</h3>
      <p>${entry.flashcards.length} cards · Quiz size ${entry.quizSize}</p>
    `;
    const list = document.createElement('ul');
    entry.objectives.forEach((obj) => {
      const li = document.createElement('li');
      li.textContent = obj;
      list.appendChild(li);
    });
    entryEl.appendChild(list);
    planOutputEl.appendChild(entryEl);
  });
}

function createCardEl(card) {
  const template = document.getElementById('card-template');
  const clone = template.content.firstElementChild.cloneNode(true);
  clone.dataset.cardId = card.id;
  clone.querySelector('.card-question').textContent = card.question;
  clone.querySelector('.card-answer p').textContent = card.answer;

  const answerEl = clone.querySelector('.card-answer');
  const toggleBtn = clone.querySelector('.show-answer');
  toggleBtn.addEventListener('click', () => {
    const hidden = answerEl.hasAttribute('hidden');
    if (hidden) {
      answerEl.removeAttribute('hidden');
      toggleBtn.textContent = 'Hide answer';
    } else {
      answerEl.setAttribute('hidden', '');
      toggleBtn.textContent = 'Show answer';
    }
  });

  attachSwipeHandlers(clone);
  return clone;
}

function attachSwipeHandlers(cardEl) {
  let startX = 0;
  let currentX = 0;
  let dragging = false;

  const onPointerDown = (event) => {
    dragging = true;
    startX = event.clientX;
    cardEl.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event) => {
    if (!dragging) return;
    currentX = event.clientX - startX;
    cardEl.style.transform = `translateX(${currentX}px) rotate(${currentX / 20}deg)`;
  };

  const onPointerUp = (event) => {
    if (!dragging) return;
    dragging = false;
    cardEl.releasePointerCapture(event.pointerId);

    if (currentX < -80) {
      swipeCard(cardEl, 'left');
    } else if (currentX > 80) {
      swipeCard(cardEl, 'right');
    } else {
      cardEl.style.transform = 'translateX(0) rotate(0)';
    }

    startX = 0;
    currentX = 0;
  };

  cardEl.addEventListener('pointerdown', onPointerDown);
  cardEl.addEventListener('pointermove', onPointerMove);
  cardEl.addEventListener('pointerup', onPointerUp);
  cardEl.addEventListener('pointercancel', onPointerUp);
}

function updateActionButtons(hasCard) {
  reviseBtn.disabled = !hasCard;
  nextBtn.disabled = !hasCard;
  const stateMessage = hasCard ? '' : 'No cards available';
  reviseBtn.title = stateMessage;
  nextBtn.title = stateMessage;
}

function swipeCard(cardEl, direction) {
  const cardId = cardEl.dataset.cardId;
  const cardData = deck.getAll().find((c) => c.id === cardId);
  if (!cardData) return;

  updateActionButtons(false);
  const offscreenX = direction === 'right' ? 500 : -500;
  cardEl.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
  cardEl.style.transform = `translateX(${offscreenX}px) rotate(${direction === 'right' ? 12 : -12}deg)`;
  cardEl.style.opacity = '0';

  setTimeout(() => {
    cardEl.remove();
    if (direction === 'left') {
      leftSwipes += 1;
      deck.removeById(cardId);
      deck.addCard(cardData);
    } else {
      rightSwipes += 1;
      deck.removeById(cardId);
    }
    loadNextCard();
    updateStats();
    renderPlan();
  }, 180);
}

function loadNextCard() {
  stackEl.innerHTML = '';
  const cards = deck.getAll();
  if (!cards.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'You have mastered every card! Tap recreate to start over.';
    stackEl.appendChild(empty);
    activeCard = null;
    updateActionButtons(false);
    return;
  }

  activeCard = cards[0];
  const cardEl = createCardEl(activeCard);
  cardEl.style.zIndex = 2;
  stackEl.appendChild(cardEl);

  if (cards[1]) {
    const peek = createCardEl(cards[1]);
    peek.style.transform = 'scale(0.96) translateY(8px)';
    peek.style.opacity = '0.6';
    peek.style.pointerEvents = 'none';
    peek.style.zIndex = 1;
    stackEl.appendChild(peek);
  }

  updateActionButtons(true);
}

function rebuildDeck() {
  leftSwipes = 0;
  rightSwipes = 0;
  deck.cards = [];
  uploadedResources.forEach((resource) => deck.addCards(converter.convert(resource)));
  planOutputEl.innerHTML = 'Deck reset. Swipe to generate a new plan.';
  loadNextCard();
  updateStats();
}

function performAction(direction) {
  const topCard = stackEl.querySelector('.card');
  if (!topCard) return;
  swipeCard(topCard, direction);
}

rebuildBtn.addEventListener('click', () => {
  renderPlan();
});

reviseBtn.addEventListener('click', () => {
  performAction('left');
});

nextBtn.addEventListener('click', () => {
  performAction('right');
});

loadNextCard();
updateStats();
renderPlan();

window.recreateDeck = rebuildDeck;
