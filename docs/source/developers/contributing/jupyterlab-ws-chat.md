# Websocket chat

The `jupyterlab-ws-chat` extension adds a chat panel relying on websocket for messaging.

## Development installation

Installing this extension in development mode requires an environment with *python* and
*nodejs*.

```bash
# In the following commands, 'mamba' can be replaced with 'conda'
mamba create -n jupyter-chat python nodejs
mamba activate jupyter-chat
```

The following commands install the extension in development mode:

```bash
# Install the extension
./scripts/dev_install.sh ws

# Symlink the assets
jupyter labextension develop --overwrite python/jupyterlab-ws-chat
```

To uninstall it, run:

```bash
pip uninstall jupyterlab-ws-chat
```

## Building the assets

Changes in typescript sources of `@jupyter/chat` or `jupyterlab-ws-chat` must
be build again to be available in the jupyterlab.

```bash
jlpm build:ws
```
