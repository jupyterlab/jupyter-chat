/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import {
  MessagePreambleRegistry,
  MessagePreambleProps
} from '../registers/preambles';

describe('MessagePreambleRegistry', () => {
  let registry: MessagePreambleRegistry;

  beforeEach(() => {
    registry = new MessagePreambleRegistry();
  });

  it('should start with no components', () => {
    expect(registry.getComponents()).toEqual([]);
  });

  it('should add a component', () => {
    const component: (props: MessagePreambleProps) => JSX.Element | null = () => null;
    registry.addComponent(component);
    expect(registry.getComponents()).toHaveLength(1);
    expect(registry.getComponents()[0]).toBe(component);
  });

  it('should preserve insertion order', () => {
    const first: (props: MessagePreambleProps) => JSX.Element | null = () => null;
    const second: (props: MessagePreambleProps) => JSX.Element | null = () => null;
    registry.addComponent(first);
    registry.addComponent(second);
    const components = registry.getComponents();
    expect(components).toHaveLength(2);
    expect(components[0]).toBe(first);
    expect(components[1]).toBe(second);
  });

  it('should return a copy from getComponents', () => {
    const component: (props: MessagePreambleProps) => JSX.Element | null = () => null;
    registry.addComponent(component);
    const result = registry.getComponents();
    result.push(() => null);
    expect(registry.getComponents()).toHaveLength(1);
  });
});
