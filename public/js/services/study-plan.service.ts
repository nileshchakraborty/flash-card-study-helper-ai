export class StudyPlanService {
  generatePlan(stats) {
    const {total, remaining, left, right} = stats;
    
    if (total === 0) {
      return '<p class="text-gray-500 italic">Generate some flashcards to get a study plan.</p>';
    }
    
    let plan = '<ul class="space-y-3">';
    
    // Progress analysis
    const progress = ((total - remaining) / total) * 100;
    
    if (progress === 0) {
      plan += this.createPlanItem('start', 'Start by reviewing 5 cards today.');
      plan += this.createPlanItem('tip', 'Focus on understanding the core concepts first.');
    } else if (progress < 50) {
      plan += this.createPlanItem('continue', `You're ${Math.round(progress)}% through. Keep going!`);
      if (left > right) {
        plan += this.createPlanItem('review', 'You seem to be struggling with some cards. Review them twice.');
      }
    } else if (progress < 100) {
      plan += this.createPlanItem('push', 'Almost there! Finish the remaining cards.');
    } else {
      plan += this.createPlanItem('done', 'Great job! You have reviewed all cards.');
      if (left > 0) {
        plan += this.createPlanItem('review', `Review the ${left} cards you missed.`);
      }
    }
    
    plan += '</ul>';
    return plan;
  }
  
  createPlanItem(type, text) {
    const icons = {
      start: 'play_circle',
      tip: 'lightbulb',
      continue: 'trending_up',
      review: 'refresh',
      push: 'flag',
      done: 'check_circle'
    };
    
    const colors = {
      start: 'text-blue-500',
      tip: 'text-yellow-500',
      continue: 'text-indigo-500',
      review: 'text-orange-500',
      push: 'text-purple-500',
      done: 'text-green-500'
    };
    
    return `
      <li class="flex items-start gap-3 text-sm text-gray-600">
        <span class="material-icons text-lg ${colors[type] || 'text-gray-400'}">${icons[type] || 'info'}</span>
        <span>${text}</span>
      </li>
    `;
  }
}

export const studyPlanService = new StudyPlanService();
