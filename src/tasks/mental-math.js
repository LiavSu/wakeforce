// Mental Math task module — generates arithmetic problems

const OPERATIONS = ['+', '-', '×'];

/**
 * Generate an array of 3 math problems.
 * @returns {Array<{a: number, b: number, op: string, answer: number, display: string}>}
 */
export function generateProblems() {
  return [generateProblem(), generateProblem(), generateProblem()];
}

/**
 * Generate a single math problem.
 * @returns {{a: number, b: number, op: string, answer: number, display: string}}
 */
function generateProblem() {
  const op = OPERATIONS[Math.floor(Math.random() * OPERATIONS.length)];
  let a, b;

  if (op === '+') {
    a = randomInt(10, 99);
    b = randomInt(10, 99);
  } else if (op === '-') {
    a = randomInt(20, 99);
    b = randomInt(10, a - 1);
  } else {
    // multiplication
    a = randomInt(2, 12);
    b = randomInt(2, 12);
  }

  const answer = op === '+' ? a + b : op === '-' ? a - b : a * b;

  return {
    a,
    b,
    op,
    answer,
    display: `${a} ${op} ${b} = ?`,
  };
}

/**
 * Check if user input matches the correct answer.
 * @param {{ answer: number }} problem
 * @param {string} userInput
 * @returns {boolean}
 */
export function checkAnswer(problem, userInput) {
  const parsed = parseInt(userInput.trim(), 10);
  if (isNaN(parsed)) return false;
  return parsed === problem.answer;
}

/**
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
