# @jupyter/chat

The `@jupyter/chat` package is a frontend package (React) compatible with jupyterlab.
It is not an extension, and cannot be used on its own. It is designed to be used in an
extension.\
In this repository, it is currently used in `jupyterlab-collaborative-chat` and
`jupyterlab-ws-chat`.

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
