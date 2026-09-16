/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { Doc } from 'yjs';
import {
  applyAwarenessUpdate,
  Awareness,
  encodeAwarenessUpdate
} from 'y-protocols/awareness';

import { collectWritersFromAwareness } from '../model';

// The current user, occupying the local awareness slot. `IChatModel.name`-style
// identity: writers are matched/excluded by `user.username`.
const ME = { username: 'me', name: 'Me', display_name: 'Me' };

function makeAwareness(): Awareness {
  return new Awareness(new Doc());
}

/**
 * Copy every client state from `source` into `target`, exactly as the awareness
 * protocol does over the wire. After this, `target.getStates()` contains its own
 * local client plus every client of `source`.
 */
function sync(source: Awareness, target: Awareness): void {
  const clients = Array.from(source.getStates().keys());
  applyAwarenessUpdate(target, encodeAwarenessUpdate(source, clients), 'test');
}

/**
 * A "local" awareness whose own slot is the current user, plus any remote
 * client states merged in.
 */
function localAwarenessWith(...remotes: Awareness[]): Awareness {
  const local = makeAwareness();
  local.setLocalStateField('user', ME);
  for (const remote of remotes) {
    sync(remote, local);
  }
  return local;
}

describe('collectWritersFromAwareness', () => {
  it('reads a server-published set of writers from a single slot', () => {
    const server = makeAwareness();
    server.setLocalState({
      user: { username: 'server' },
      writers: [
        { user: { username: 'bot' }, messageID: 'm1' },
        { user: { username: 'bot-2' }, typingIndicator: 'Writing...' }
      ]
    });

    const writers = collectWritersFromAwareness(
      localAwarenessWith(server).getStates(),
      ME.username
    );

    expect(writers).toEqual([
      { user: { username: 'bot' }, messageID: 'm1' },
      { user: { username: 'bot-2' }, typingIndicator: 'Writing...' }
    ]);
  });

  it('reads a peer advertising its own typing on its own slot', () => {
    const peer = makeAwareness();
    peer.setLocalState({ user: { username: 'peer' }, isWriting: 'msg-9' });

    const writers = collectWritersFromAwareness(
      localAwarenessWith(peer).getStates(),
      ME.username
    );

    expect(writers).toEqual([
      {
        user: { username: 'peer' },
        messageID: 'msg-9',
        typingIndicator: undefined
      }
    ]);
  });

  it('maps isWriting===true to no messageID', () => {
    const peer = makeAwareness();
    peer.setLocalState({ user: { username: 'peer' }, isWriting: true });

    const writers = collectWritersFromAwareness(
      localAwarenessWith(peer).getStates(),
      ME.username
    );

    expect(writers).toHaveLength(1);
    expect(writers[0].messageID).toBeUndefined();
  });

  it('does not show the current user when they broadcast their own typing', () => {
    // The local client advertises its own writing status on its own slot...
    const local = makeAwareness();
    local.setLocalState({ user: ME, isWriting: 'my-msg' });
    // ...while a real peer is also typing.
    const peer = makeAwareness();
    peer.setLocalState({ user: { username: 'peer' }, isWriting: 'p1' });
    sync(peer, local);

    const writers = collectWritersFromAwareness(local.getStates(), ME.username);

    // Only the peer shows; the current user never sees themselves.
    expect(writers.map(w => w.user.username)).toEqual(['peer']);
  });

  it('excludes the current user even from a server-published writer set', () => {
    const server = makeAwareness();
    server.setLocalState({
      user: { username: 'server' },
      writers: [{ user: ME, messageID: 'm1' }]
    });

    const writers = collectWritersFromAwareness(
      localAwarenessWith(server).getStates(),
      ME.username
    );

    expect(writers).toEqual([]);
  });

  it('ignores malformed or untrusted awareness state', () => {
    // Real clients can write anything into their own slot.
    const p1 = makeAwareness();
    p1.setLocalState({ writers: 'not-an-array', isWriting: 123 });
    const p2 = makeAwareness();
    p2.setLocalState({
      writers: ['garbage', { messageID: 'm1' }, { user: 'nope' }]
    });
    const p3 = makeAwareness();
    p3.setLocalState({ user: 'not-an-object', isWriting: true });
    const p4 = makeAwareness();
    p4.setLocalState({ user: { name: 'no-username' }, isWriting: true });
    const p5 = makeAwareness();
    // A valid server writer, but with a wrong-typed typingIndicator.
    p5.setLocalState({
      writers: [{ user: { username: 'bot' }, typingIndicator: 42 }]
    });

    const writers = collectWritersFromAwareness(
      localAwarenessWith(p1, p2, p3, p4, p5).getStates(),
      ME.username
    );

    // Only the one well-formed writer survives, with the bad field dropped.
    expect(writers).toEqual([{ user: { username: 'bot' } }]);
  });

  it('merges concurrent server writers and a typing peer', () => {
    const server = makeAwareness();
    server.setLocalState({
      user: { username: 'server' },
      writers: [
        { user: { username: 'bot' }, messageID: 'm1' },
        { user: { username: 'bot-2' }, messageID: 'm2' }
      ]
    });
    const peer = makeAwareness();
    peer.setLocalState({ user: { username: 'peer' }, isWriting: true });

    const writers = collectWritersFromAwareness(
      localAwarenessWith(server, peer).getStates(),
      ME.username
    );

    expect(writers.map(w => w.user.username).sort()).toEqual([
      'bot',
      'bot-2',
      'peer'
    ]);
  });
});
