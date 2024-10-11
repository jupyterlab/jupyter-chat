#!/bin/bash
# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.

EXTENSION=$1

# install dependencies
pip install jupyterlab~=4.0

# install typescript dependencies
jlpm install

if [ -z "${EXTENSION}" ]; then
  jlpm dev-install
else
  jlpm dev-install:${EXTENSION}
fi
