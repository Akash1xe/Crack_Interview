export function levenshtein(a, b) {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const old = prev[j];
      prev[j] = Math.min(
        prev[j] + 1,
        prev[j - 1] + 1,
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
      diagonal = old;
    }
  }
  return prev[b.length];
}

export function scoreText(typed, reference) {
  const errors = levenshtein(typed || '', reference || '');
  const accuracy = Math.max(0, 100 * (1 - errors / Math.max(1, reference.length)));
  return { errors, accuracy: Number(accuracy.toFixed(2)) };
}

export function classifyMistakes(typed, reference) {
  const mistakes = [];
  if (/\basync\b/.test(reference) && !/\basync\b/.test(typed)) mistakes.push('missing_async');
  if (reference.includes('$') && !typed.includes('$')) mistakes.push('missing_mongodb_operator');
  if (reference.includes('next(error)') && !typed.includes('next(error)')) mistakes.push('missing_error_propagation');
  return mistakes;
}
