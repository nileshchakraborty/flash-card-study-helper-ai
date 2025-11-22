import {beforeEach, describe, expect, it, jest} from '@jest/globals';
import {QuizModel} from '../../../../public/js/models/quiz.model.js';
import {apiService} from '../../../../public/js/services/api.service.js';
import {eventBus} from '../../../../public/js/utils/event-bus.js';

jest.mock('../../../../public/js/utils/event-bus.js');
jest.mock('../../../../public/js/services/api.service.js');

describe('QuizModel', () => {
  let quizModel: QuizModel;
  let apiPostSpy: any;
  
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(eventBus, 'emit');
    apiPostSpy = jest.spyOn(apiService, 'post');
    quizModel = new QuizModel();
  });
  
  describe('submitQuiz', () => {
    it('should calculate score correctly', async () => {
      const questions = [
        {id: '1', correctAnswer: 'A'},
        {id: '2', correctAnswer: 'B'}
      ];
      quizModel.startQuiz(questions);
      quizModel.answerQuestion('1', 'A'); // Correct
      quizModel.answerQuestion('2', 'C'); // Incorrect
      
      apiPostSpy.mockResolvedValue({id: 'quiz-1'});
      
      const result = await quizModel.submitQuiz();
      
      expect(result.score).toBe(1);
      expect(result.total).toBe(2);
      expect(result.results[0].correct).toBe(true);
      expect(result.results[1].correct).toBe(false);
    });
  });
});
