import { MutableRefObject } from 'react';

/**
 * Gets the current (space-separated) word around the user's cursor. The current
 * word is used to generate a list of matching chat commands.
 */
export function getCurrentWord(
  inputRef: MutableRefObject<HTMLInputElement | undefined>
): string | null {
  const input = inputRef.current;
  if (!input) {
    return null;
  }

  const value = input.value;
  const cursorPosition = input.selectionStart;

  if (cursorPosition === null) {
    return null;
  }

  // Find the start of the word
  let start = cursorPosition;
  while (start > 0 && value[start - 1] !== ' ') {
    start--;
  }

  // Find the end of the word
  let end = cursorPosition;
  while (end < value.length && value[end] !== ' ') {
    end++;
  }

  // Extract the word
  const word = value.substring(start, end);
  return word;
}

/**
 * Replaces the (space-separated) current word around the user's cursor with
 * `newWord`.
 */
export function replaceCurrentWord(
  inputRef: MutableRefObject<HTMLInputElement | undefined>,
  newWord: string
): void {
  const input = inputRef.current;
  if (!input) {
    return;
  }

  const value = input.value;
  const cursorPosition = input.selectionStart;

  if (cursorPosition === null) {
    return;
  }

  // Find the start of the current word
  let start = cursorPosition;
  while (start > 0 && value[start - 1] !== ' ') {
    start--;
  }

  // Find the end of the current word
  let end = cursorPosition;
  while (end < value.length && value[end] !== ' ') {
    end++;
  }

  // Text before and after the current word
  const textBeforeWord = value.substring(0, start);
  const textAfterWord = value.substring(end);

  // Replace the word
  const newValue = textBeforeWord + newWord + textAfterWord;

  // Update the input's value
  input.value = newValue;

  // Set the cursor position right after the inserted word
  input.setSelectionRange(start + newWord.length, start + newWord.length);
}
