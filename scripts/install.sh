#!/bin/bash
# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.


# install core packages
pip install jupyterlab~=4.0
jlpm install
jlpm build

# install the collaborative chat extension
pip install -e packages/jupyterlab-collaborative-chat[test]

# install websocket chat extension
pip install -e packages/jupyterlab-ws-chat[test]
