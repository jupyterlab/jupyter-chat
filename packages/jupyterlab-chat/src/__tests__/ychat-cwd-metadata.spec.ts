/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { YChat } from '../ychat';

describe('YChat metadata', () => {
  it('should store and retrieve cwd metadata', () => {
    const ychat = new YChat();
    ychat.ydoc.getMap('metadata').set('cwd', 'projects/my-repo');

    const source = ychat.getSource();
    expect((source.metadata as Record<string, unknown>)['cwd']).toBe(
      'projects/my-repo'
    );
  });

  it('should not include cwd when not set', () => {
    const ychat = new YChat();

    const source = ychat.getSource();
    expect((source.metadata as Record<string, unknown>)['cwd']).toBeUndefined();
  });

  it('should overwrite cwd metadata', () => {
    const ychat = new YChat();
    const metadataMap = ychat.ydoc.getMap('metadata');

    metadataMap.set('cwd', 'old-dir');
    metadataMap.set('cwd', 'new-dir');

    const source = ychat.getSource();
    expect((source.metadata as Record<string, unknown>)['cwd']).toBe('new-dir');
  });

  it('should preserve other metadata when cwd is set', () => {
    const ychat = new YChat();
    const metadataMap = ychat.ydoc.getMap('metadata');

    metadataMap.set('id', 'chat-123');
    metadataMap.set('cwd', 'projects/my-repo');

    const source = ychat.getSource();
    const metadata = source.metadata as Record<string, unknown>;
    expect(metadata['id']).toBe('chat-123');
    expect(metadata['cwd']).toBe('projects/my-repo');
  });
});
