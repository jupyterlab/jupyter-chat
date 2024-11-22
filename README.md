# jupyter-chat

[![Github Actions Status](https://github.com/jupyterlab/jupyter-chat/workflows/Build/badge.svg)](https://github.com/jupyterlab/jupyter-chat/actions/workflows/build.yml)
[![Binder](https://mybinder.org/badge_logo.svg)](https://mybinder.org/v2/gh/jupyterlab/jupyter-chat/main?urlpath=lab)

This project is a monorepo containing:

- an extension to add a chat in jupyterlab
- the frontend components to build a chat extension for Jupyter application

Many components of this chat project come from [jupyter-ai](https://github.com/jupyterlab/jupyter-ai).

![a screenshot showing the jupyter-chat extension used in two browser windows](https://github.com/jupyterlab/jupyter-chat/assets/591645/5dac0b00-43ed-4458-ab67-18207644b92b)

> [!WARNING]
> This project is still in early development stage and its API may change often before
a stable release.

## Install chat extension

The chat extension is available on [PyPI](https://pypi.org/project/jupyterlab-chat/).

```bash
pip install jupyterlab-chat
```

To uninstall the package:

```bash
pip uninstall jupyterlab-chat
```

> [!NOTE]
> The extension was released as [jupyterlab-collaborative-chat](https://pypi.org/project/jupyterlab-collaborative-chat/) until version 0.5.0.

## Composition

### Typescript package

#### @jupyter/chat

The typescript package is located in *packages/jupyter-chat* and builds an NPM
package named `@jupyter/chat`.

This package provides a frontend library (using react), and is intended to be
used by a jupyterlab extension to create a chat.

#### jupyterlab-chat

The typescript package is located in *packages/jupyterlab-chat* and
builds an NPM package named `jupyterlab-chat`.

This package relies on `@jupyter/chat` and provides a typescript library.
It is intended to be used by a jupyterlab extension to create a chat.

### Jupyterlab extensions

#### Chat extension based on shared document: *python/jupyterlab-chat*

This extension is an implementation of the `jupyter-chat` package, relying
on shared document (see [jupyter_ydoc](https://github.com/jupyter-server/jupyter_ydoc)).

It is composed of:

- a Python package named `jupyterlab_chat`, which register
  the `YChat` shared document in jupyter_ydoc
- a NPM package named `jupyterlab-chat-extension`.

#### REMOVED - Chat extension based on websocket

This extension has been moved to its own [repository](https://github.com/brichet/jupyterlab-ws-chat)

## Contributing

See the contributing part of the [documentation](https://jupyter-chat.readthedocs.io/en/latest/developers/contributing/index.html).
