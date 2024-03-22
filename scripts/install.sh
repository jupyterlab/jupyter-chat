#!/bin/bash

# install core packages
pip install jupyterlab~=4.0
jlpm install
jlpm build

# install chat extension
pip install -e packages/jupyter-chat-extension[test]
