# Jupyterlab chat

The `jupyterlab-chat` extension adds chats to jupyterlab based on collaborative documents.

## Development installation

Installing this extension in development mode requires an environment with _python_ and
_nodejs_.

```bash
# In the following commands, 'mamba' can be replaced with 'conda'
mamba create -n jupyter-chat python nodejs
mamba activate jupyter-chat
```

The following commands install the extension in development mode:

```bash
# Install the extension
./scripts/dev_install.sh

# Symlink the assets
jupyter labextension develop --overwrite python/jupyterlab-chat
```

To uninstall it, run:

```bash
pip uninstall jupyterlab-chat
```

## Building the assets

Changes in typescript sources of `@jupyter/chat` or `jupyterlab-chat` must
be built again to be available in the jupyterlab.

```bash
jlpm build
```

## Testing locally the extension

`jupyterlab-chat` package has unit tests and integration tests.

### Unit tests

There are a few unit tests in `python/jupyterlab-chat/src/\_\_tests\_\_`.

They make use of [jest](https://jestjs.io/).

The following commands run them:

```bash
cd ./python/jupyterlab-chat
jlpm test
```

### Integration tests

The integration tests are located in _ui-tests_.

They make use of [playwright](https://playwright.dev/).

The following commands run them:

```bash
cd ./ui-tests

# Install the tests dependencies
jlpm install

# Install the tests browser
jlpm playwright install

# Run the tests
jlpm test
```
