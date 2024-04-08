#!/bin/bash
# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.

EXTENSION=$1

[ "${EXTENSION}" = "websocket" ] && PACKAGE="jupyterlab-ws-chat" || PACKAGE="jupyterlab-${EXTENSION}-chat"


# install core packages
pip install jupyterlab~=4.0
jlpm install

if [ -z "${EXTENSION}" ]; then
  jlpm build
  # install the collaborative chat extension
  pip install -e packages/jupyterlab-collaborative-chat[test]

  # install websocket chat extension
  pip install -e packages/jupyterlab-ws-chat[test]
else
  jlpm build:${EXTENSION}
  pip install -e packages/${PACKAGE}[test]
fi
