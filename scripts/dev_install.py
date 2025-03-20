# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.

import subprocess
from pathlib import Path
from typing import Optional


def execute(cmd: str, cwd: Optional[Path] = None) -> None:
    subprocess.run(cmd.split(" "), check=True, cwd=cwd)


def install_dev() -> None:
    execute( "python -m pip install jupyterlab~=4.0")
    execute("jlpm install")

    execute("pip uninstall jupyterlab_chat -y")
    execute("pip install -e python/jupyterlab-chat")
    execute("jupyter labextension develop --overwrite python/jupyterlab-chat --overwrite")


if __name__ == "__main__":
    install_dev()
