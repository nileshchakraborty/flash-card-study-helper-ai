export class StudyPlanService {
  generatePlan(stats) {
    const { total, remaining, left, right } = stats;

    if (total === 0) {
      return `
        <div class="text-center p-4">
          <span class="material-icons text-gray-300 text-4xl mb-2">style</span>
          <p class="text-gray-500 italic text-sm">Generate some flashcards to get a study plan.</p>
        </div>
      `;
    }

    const answered = total - remaining;
    const progress = Math.round((answered / total) * 100);

    // Status Logic
    let statusTitle = "";
    let statusMessage = "";
    let state = "start"; // start, progress, almost, done

    if (progress === 0) {
      statusTitle = "Ready to Begin";
      statusMessage = `You have <strong>${total}</strong> cards to master.`;
      state = "start";
    } else if (progress < 50) {
      statusTitle = "Off to a Good Start";
      statusMessage = `You've reviewed <strong>${answered}</strong> cards. Keep the momentum!`;
      state = "progress";
    } else if (progress < 100) {
      statusTitle = "Almost There";
      statusMessage = `Only <strong>${remaining}</strong> cards left. You're crushing it!`;
      state = "almost";
    } else {
      statusTitle = "Deck Complete!";
      statusMessage = `You've reviewed all <strong>${total}</strong> cards. Excellent work!`;
      state = "done";
    }

    // Recommendation based on state
    let recommendation = "";
    if (left > right && progress > 0) {
      recommendation = this.createRecommendation('review', 'High miss rate detected. Review "Mastered" cards again just to be safe.');
    } else if (state === 'done') {
      recommendation = this.createRecommendation('quiz', 'Now is a great time to take a quiz and verify your knowledge.');
    } else {
      recommendation = this.createRecommendation('continue', 'Focus on understanding, not just memorizing.');
    }

    return `
      <div class="space-y-4">
        <!-- Progress Ring / Header -->
        <div class="flex items-center gap-4">
           <div class="relative w-12 h-12 flex-shrink-0">
              <svg class="w-full h-full transform -rotate-90">
                <circle cx="24" cy="24" r="20" stroke="currentColor" stroke-width="4" fill="transparent" class="text-gray-100" />
                <circle cx="24" cy="24" r="20" stroke="currentColor" stroke-width="4" fill="transparent" class="text-indigo-600 transition-all duration-1000 ease-out" stroke-dasharray="125.6" stroke-dashoffset="${125.6 - (125.6 * progress) / 100}" />
              </svg>
              <span class="absolute inset-0 flex items-center justify-center text-xs font-bold text-indigo-700">${progress}%</span>
           </div>
           <div>
              <h4 class="text-gray-900 font-bold text-sm leading-tight">${statusTitle}</h4>
              <p class="text-xs text-gray-500 mt-0.5">${answered} of ${total} cards reviewed</p>
           </div>
        </div>

        <div class="h-px bg-gray-100 w-full"></div>

        <!-- Action Item -->
        <div class="bg-indigo-50/50 rounded-xl p-3 border border-indigo-100/50">
             <p class="text-sm text-gray-700 leading-relaxed">${statusMessage}</p>
        </div>
        
        ${recommendation}

      </div>
    `;
  }

  createRecommendation(type: string, text: string) {
    const icons = {
      review: 'refresh',
      quiz: 'quiz',
      continue: 'lightbulb'
    };

    const colors = {
      review: 'text-orange-500 bg-orange-50',
      quiz: 'text-purple-500 bg-purple-50',
      continue: 'text-yellow-500 bg-yellow-50'
    };

    const style = colors[type] || colors.continue;

    return `
      <div class="flex gap-3 items-start">
         <div class="w-6 h-6 rounded-full ${style} flex items-center justify-center flex-shrink-0 mt-0.5">
            <span class="material-icons text-xs">${icons[type]}</span>
         </div>
         <p class="text-xs text-gray-500 italic leading-relaxed pt-0.5">${text}</p>
      </div>
    `;
  }
}

export const studyPlanService = new StudyPlanService();
