# jupyter_chat

[![Github Actions Status](https://github.com/QuantStack/jupyter-chat/workflows/Build/badge.svg)](https://github.com/QuantStack/jupyter-chat/actions/workflows/build.yml)

A chat package for Jupyterlab extension, but also an extension for Jupyterab.

A lot of the components of this chat project come from
[jupyter-ai](https://github.com/jupyterlab/jupyter-ai).

## Composition

### Typescript package

The typescript package is located in *packages/jupyter-chat* and build an NPM
package named `@jupyter/chat`.

This package provides a frontend library (using react), and is intended to be
used by a jupyterlab extension.

### Jupyterab extension

The Jupyterlab extension is located in *packages/jupyter-chat-extension*.

It is composed of a Python package named `jupyter_chat_extension`
for the server side and a NPM package named `@jupyter/chat-extension`.

This extension is an implementation of the `@jupyter/chat` package, relying on
websocket for the communication between server and front end.

## Contributing

See the contributing part of each package for details.
