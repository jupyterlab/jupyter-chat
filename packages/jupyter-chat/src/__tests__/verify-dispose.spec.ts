/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import {
  RenderMimeRegistry,
  standardRendererFactories
} from '@jupyterlab/rendermime';
import { MessageLoop } from '@lumino/messaging';
import { Widget } from '@lumino/widgets';

import { disposeRenderer } from '../utils';

const MD = 'text/markdown';

const registry = new RenderMimeRegistry({
  initialFactories: standardRendererFactories
});

async function makeRenderer() {
  const renderer = registry.createRenderer(MD);
  await renderer.renderModel(
    registry.createModel({ data: { [MD]: 'hello $x^2$' } })
  );
  return renderer;
}

describe('VERIFY the assumptions behind disposeRenderer', () => {
  it('sending AfterAttach by hand sets the IsAttached flag', async () => {
    const renderer = await makeRenderer();
    expect(renderer.isAttached).toBe(false);

    MessageLoop.sendMessage(renderer, Widget.Msg.AfterAttach);

    // This is the crux: the widget now believes it is attached, even though
    // Widget.attach() was never called.
    expect(renderer.isAttached).toBe(true);
  });

  it('naive dispose() THROWS when the node is not in the DOM', async () => {
    const renderer = await makeRenderer();
    MessageLoop.sendMessage(renderer, Widget.Msg.AfterAttach);
    expect(renderer.node.isConnected).toBe(false);

    expect(() => renderer.dispose()).toThrow('Widget is not attached.');
  });

  it('naive dispose() REMOVES the node when it is in the DOM', async () => {
    const renderer = await makeRenderer();
    MessageLoop.sendMessage(renderer, Widget.Msg.AfterAttach);
    const host = document.createElement('div');
    document.body.appendChild(host);
    host.appendChild(renderer.node);
    expect(renderer.node.isConnected).toBe(true);

    renderer.dispose();

    // The rendered content silently disappears from the page.
    expect(host.contains(renderer.node)).toBe(false);
  });

  it('disposeRenderer() disposes without throwing and keeps the node', async () => {
    const renderer = await makeRenderer();
    MessageLoop.sendMessage(renderer, Widget.Msg.AfterAttach);
    const host = document.createElement('div');
    document.body.appendChild(host);
    host.appendChild(renderer.node);
    const html = renderer.node.innerHTML;

    expect(() => disposeRenderer(renderer)).not.toThrow();

    expect(renderer.isDisposed).toBe(true);
    expect(renderer.isAttached).toBe(false);
    expect(host.contains(renderer.node)).toBe(true);
    expect(renderer.node.innerHTML).toBe(html);
  });

  it('disposeRenderer() is safe on a never-attached renderer', async () => {
    const renderer = await makeRenderer();
    expect(() => disposeRenderer(renderer)).not.toThrow();
    expect(renderer.isDisposed).toBe(true);
  });

  it('disposeRenderer() is idempotent', async () => {
    const renderer = await makeRenderer();
    MessageLoop.sendMessage(renderer, Widget.Msg.AfterAttach);
    disposeRenderer(renderer);
    expect(() => disposeRenderer(renderer)).not.toThrow();
  });

  it('disposeRenderer(renderer, true) removes the node', async () => {
    const renderer = await makeRenderer();
    MessageLoop.sendMessage(renderer, Widget.Msg.AfterAttach);
    const host = document.createElement('div');
    document.body.appendChild(host);
    host.appendChild(renderer.node);

    disposeRenderer(renderer, true);

    expect(host.contains(renderer.node)).toBe(false);
    expect(renderer.isDisposed).toBe(true);
  });

  it('disposeRenderer(renderer, true) is safe on a never-appended node', async () => {
    const renderer = await makeRenderer();
    expect(() => disposeRenderer(renderer, true)).not.toThrow();
    expect(renderer.isDisposed).toBe(true);
  });
});
