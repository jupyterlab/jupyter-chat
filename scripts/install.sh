#!/bin/bash
# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.

EXTENSION=$1

# install core packages
pip install jupyterlab~=4.0
jlpm install

if [ -z "${EXTENSION}" ]; then
  jlpm build
  # install the collaborative chat extension
  pip install -e python/jupyterlab-collaborative-chat[test]
  jupyter labextension develop --overwrite python/jupyterlab-collaborative-chat

  # install websocket chat extension
  pip install -e python/jupyterlab-ws-chat[test]
  jupyter labextension develop --overwrite python/jupyterlab-ws-chat
else
  PACKAGE="jupyterlab-${EXTENSION}-chat"
  jlpm build:${EXTENSION}
  pip install -e python/${PACKAGE}[test]
  jupyter labextension develop --overwrite python/${PACKAGE}
fi
