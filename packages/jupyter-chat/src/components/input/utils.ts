function getCurrentWordBoundaries(
  input: string,
  cursorIndex: number
): [number, number] {
  let start = cursorIndex;
  let end = cursorIndex;
  const n = input.length;

  while (start > 0 && input[start - 1] !== ' ') {
    start--;
  }

  while (end < n && input[end] !== ' ') {
    end++;
  }

  return [start, end];
}

/**
 * Gets the current (space-separated) word around the user's cursor. The current
 * word is used to generate a list of matching chat commands.
 */
export function getCurrentWord(
  input: string,
  cursorIndex: number
): string | null {
  const [start, end] = getCurrentWordBoundaries(input, cursorIndex);
  return input.slice(start, end);
}

/**
 * Replaces the (space-separated) current word around the user's cursor with
 * `newWord`.
 */
export function replaceCurrentWord(
  input: string,
  cursorIndex: number,
  newWord: string,
  replaceInput: (newInput: string) => unknown
): void {
  const [start, end] = getCurrentWordBoundaries(input, cursorIndex);
  replaceInput(input.slice(0, start) + newWord + input.slice(end));
}
