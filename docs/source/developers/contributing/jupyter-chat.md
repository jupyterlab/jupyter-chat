# @jupyter/chat

The `@jupyter/chat` package is a frontend package (React) compatible with jupyterlab.
It is not an extension, and cannot be used on its own. It can be used with one of the
extensions provided in this repo (jupyterlab-collaborative-chat or jupyterlab-ws-chat).

## Building the package

From the root of the repository:

```bash
# In the following command, 'jlpm' can be replaced with 'yarn'
jlpm build:core
```

From the package itself (`./packages/jupyter-chat`):

```bash
jlpm build
```
