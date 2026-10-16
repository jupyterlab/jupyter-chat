/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { isCursorInsideCodeBlock } from '../components/input/use-chat-commands';

describe('isCursorInsideCodeBlock', () => {
  it('should return false for plain text', () => {
    const text = 'Hello world, how are you?';
    expect(isCursorInsideCodeBlock(text, 0)).toBe(false);
    expect(isCursorInsideCodeBlock(text, 5)).toBe(false);
    expect(isCursorInsideCodeBlock(text, text.length)).toBe(false);
  });

  it('should return true when inside inline code', () => {
    const text = 'Check `this out` please';
    // index 6 is '`', index 7 is 't', index 15 is '`'
    expect(isCursorInsideCodeBlock(text, 6)).toBe(false); // at the opening backtick
    expect(isCursorInsideCodeBlock(text, 7)).toBe(true); // inside
    expect(isCursorInsideCodeBlock(text, 10)).toBe(true); // inside
    expect(isCursorInsideCodeBlock(text, 14)).toBe(true); // inside
    expect(isCursorInsideCodeBlock(text, 15)).toBe(true); // right before closing backtick
    expect(isCursorInsideCodeBlock(text, 16)).toBe(false); // after closing backtick
    expect(isCursorInsideCodeBlock(text, 18)).toBe(false); // outside
  });

  it('should return true when typing an unclosed inline code block', () => {
    const text = 'Here is `@command';
    expect(isCursorInsideCodeBlock(text, text.length)).toBe(true);
  });

  it('should return true when inside a multi-line code block', () => {
    const text = '```python\nprint("hello")\n```\noutside';
    const insideIndex = text.indexOf('print');
    const outsideIndex = text.indexOf('outside');
    expect(isCursorInsideCodeBlock(text, insideIndex)).toBe(true);
    expect(isCursorInsideCodeBlock(text, outsideIndex)).toBe(false);
  });

  it('should return true when typing an unclosed multi-line code block', () => {
    const text = '```typescript\nconst a = /help';
    expect(isCursorInsideCodeBlock(text, text.length)).toBe(true);
  });

  it('should handle single backticks inside a multi-line code block', () => {
    const text = '```\nconst x = `template`;\n/command\n```\n';
    const commandIndex = text.indexOf('/command');
    expect(isCursorInsideCodeBlock(text, commandIndex)).toBe(true);
  });

  it('should handle multiple inline code blocks', () => {
    const text = 'prefix `first block` middle `second block` suffix';
    const firstInside = text.indexOf('first');
    const middleIndex = text.indexOf('middle');
    const secondInside = text.indexOf('second');
    const suffixIndex = text.indexOf('suffix');

    expect(isCursorInsideCodeBlock(text, firstInside)).toBe(true);
    expect(isCursorInsideCodeBlock(text, middleIndex)).toBe(false);
    expect(isCursorInsideCodeBlock(text, secondInside)).toBe(true);
    expect(isCursorInsideCodeBlock(text, suffixIndex)).toBe(false);
  });

  it('should return false when cursor is before any backtick', () => {
    const text = 'command here then `code later`';
    const cursor = text.indexOf('command');
    expect(isCursorInsideCodeBlock(text, cursor)).toBe(false);
  });

  it('should return false for empty or non-positive cursor index', () => {
    expect(isCursorInsideCodeBlock('', 0)).toBe(false);
    expect(isCursorInsideCodeBlock('`code`', 0)).toBe(false);
    expect(isCursorInsideCodeBlock('`code`', -1)).toBe(false);
  });
});
