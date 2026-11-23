/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { MENTION_REGEX } from '../utils';

function mentionNames(text: string): string[] {
  const names: string[] = [];
  // exec() with a 'g' regex advances lastIndex, so build a fresh regex each
  // call instead of reusing the shared one.
  const regex = new RegExp(MENTION_REGEX.source, MENTION_REGEX.flags);
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    names.push(match[1]);
  }
  return names;
}

describe('MENTION_REGEX', () => {
  it('should match a plain ASCII mention', () => {
    expect(mentionNames('@jovyan')).toEqual(['jovyan']);
  });

  it('should match a mention with an underscore', () => {
    expect(mentionNames('@jovyan_2')).toEqual(['jovyan_2']);
  });

  it('should match a mention with a hyphen', () => {
    expect(mentionNames('@test-user')).toEqual(['test-user']);
  });

  it('should match a mention with non-ASCII letters', () => {
    expect(mentionNames('@Pérez')).toEqual(['Pérez']);
    expect(mentionNames('@María-Pérez')).toEqual(['María-Pérez']);
    expect(mentionNames('@José')).toEqual(['José']);
  });

  it('should match a mention starting with a non-ASCII letter', () => {
    expect(mentionNames('@Élodie')).toEqual(['Élodie']);
  });

  it('should match non-Latin script mentions', () => {
    expect(mentionNames('@张三')).toEqual(['张三']);
    expect(mentionNames('@Иван')).toEqual(['Иван']);
  });

  it('should match several mentions in one message', () => {
    expect(mentionNames('hello @Pérez and @jovyan')).toEqual([
      'Pérez',
      'jovyan'
    ]);
  });

  it('should match an @ without a name', () => {
    expect(mentionNames('just an @ sign')).toEqual(['']);
  });

  it('should stop the mention at trailing punctuation', () => {
    expect(mentionNames('@Pérez, next')).toEqual(['Pérez']);
    expect(mentionNames('Hi @Pérez.')).toEqual(['Pérez']);
  });

  it('should not match text without an @', () => {
    expect(mentionNames('plain text')).toEqual([]);
  });
});
