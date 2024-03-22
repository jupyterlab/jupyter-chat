from jupyter_server.extension.application import ExtensionApp

from .config_manager import ConfigManager

from .handlers import ChatHandler, ChatHistoryHandler, GlobalConfigHandler

class ChatExtension(ExtensionApp):

    name = "jupyter_chat"
    base_url = 'api/chat/'

    def initialize_settings(self):
        defaults = {}

        self.settings["chat_config_manager"] = ConfigManager(
            # traitlets configuration.
            config=self.config,
            log=self.log,
            defaults=defaults,
        )

        # Store chat clients in a dictionary
        self.settings["chat_clients"] = {}
        self.settings["root_chat_handlers"] = {}

        # list of chat messages to broadcast to new clients
        # this is only used to render the UI, and is not the conversational
        # memory object used by the LM chain.
        self.settings["chat_history"] = []
        self.log.debug("Chat Settings initialized")

    def initialize_handlers(self):
        self.handlers.extend([
            (fr"{self.base_url}?", ChatHandler),
            (fr"{self.base_url}config/?", GlobalConfigHandler),
            (fr"{self.base_url}history/?", ChatHistoryHandler)
        ])

        self.log.debug("Chat Handlers initialized")
