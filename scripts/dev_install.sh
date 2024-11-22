#!/bin/bash
# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.

# install dependencies
pip install jupyterlab~=4.0

# install typescript dependencies
jlpm install

# install extension in dev mode
jlpm dev-install
