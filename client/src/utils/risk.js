export const formatScoringMode = (mode) => {
  if (mode === 'ml_model') return 'AI model';
  if (mode === 'heuristic_fallback') return 'Risk rules';
  return 'Risk screening';
};
