import json
import logging
import os
import shutil
import time
from typing import List, Optional, Union

from deepmerge import always_merger as Merger
from jsonschema import Draft202012Validator as Validator
from .models import DescribeConfigResponse, GlobalConfig, UpdateConfigRequest

from jupyter_core.paths import jupyter_data_dir
from traitlets import Integer, Unicode
from traitlets.config import Configurable

Logger = Union[logging.Logger, logging.LoggerAdapter]

# default path to config
DEFAULT_CONFIG_PATH = os.path.join(
    jupyter_data_dir(),
    "jupyter_chat_extension",
    "config.json"
)

# default path to config JSON Schema
DEFAULT_SCHEMA_PATH = os.path.join(
    jupyter_data_dir(), "jupyter_chat_extension", "config_schema.json"
)

# default no. of spaces to use when formatting config
DEFAULT_INDENTATION_DEPTH = 4

# path to the default schema defined in this project
# if a file does not exist at SCHEMA_PATH, this file is used as a default.
OUR_SCHEMA_PATH = os.path.join(
    os.path.dirname(__file__), "config", "config_schema.json"
)


class AuthError(Exception):
    pass


class WriteConflictError(Exception):
    pass


class ConfigManager(Configurable):
    """Provides model and embedding provider id along
    with the credentials to authenticate providers.
    """

    config_path = Unicode(
        default_value=DEFAULT_CONFIG_PATH,
        help="Path to the configuration file.",
        allow_none=False,
        config=True,
    )

    schema_path = Unicode(
        default_value=DEFAULT_SCHEMA_PATH,
        help="Path to the configuration's corresponding JSON Schema file.",
        allow_none=False,
        config=True,
    )

    indentation_depth = Integer(
        default_value=DEFAULT_INDENTATION_DEPTH,
        help="Indentation depth, in number of spaces per level.",
        allow_none=False,
        config=True,
    )

    def __init__(
        self,
        log: Logger,
        defaults: dict,
        *args,
        **kwargs,
    ):
        super().__init__(*args, **kwargs)
        self.log = log

        self._defaults = defaults

        self._last_read: Optional[int] = None
        """When the server last read the config file. If the file was not
        modified after this time, then we can return the cached
        `self._config`."""

        self._config: Optional[GlobalConfig] = None
        """In-memory cache of the `GlobalConfig` object parsed from the config
        file."""

        self._init_config_schema()
        self._init_validator()
        self._init_config()

    def _init_config_schema(self):
        if not os.path.exists(self.schema_path):
            os.makedirs(os.path.dirname(self.schema_path), exist_ok=True)
            shutil.copy(OUR_SCHEMA_PATH, self.schema_path)

    def _init_validator(self) -> Validator:
        with open(OUR_SCHEMA_PATH, encoding="utf-8") as f:
            schema = json.loads(f.read())
            Validator.check_schema(schema)
            self.validator = Validator(schema)

    def _init_config(self):
        default_config = self._init_defaults()
        if os.path.exists(self.config_path):
            self._process_existing_config(default_config)
        else:
            self._create_default_config(default_config)

    def _process_existing_config(self, default_config):
        with open(self.config_path, encoding="utf-8") as f:
            existing_config = json.loads(f.read())
            merged_config = Merger.merge(
                default_config,
                {k: v for k, v in existing_config.items() if v is not None},
            )
            config = GlobalConfig(**merged_config)

            # re-write to the file to validate the config and apply any
            # updates to the config file immediately
            self._write_config(config)

    def _create_default_config(self, default_config):
        self._write_config(GlobalConfig(**default_config))

    def _init_defaults(self):
        field_list = GlobalConfig.__fields__.keys()
        properties = self.validator.schema.get("properties", {})
        field_dict = {
            field: properties.get(field).get("default") for field in field_list
        }
        if self._defaults is None:
            return field_dict

        for field in field_list:
            default_value = self._defaults.get(field)
            if default_value is not None:
                field_dict[field] = default_value
        return field_dict

    def _read_config(self) -> GlobalConfig:
        """Returns the user's current configuration as a GlobalConfig object.
        This should never be sent to the client as it includes API keys. Prefer
        self.get_config() for sending the config to the client."""
        if self._config and self._last_read:
            last_write = os.stat(self.config_path).st_mtime_ns
            if last_write <= self._last_read:
                return self._config

        with open(self.config_path, encoding="utf-8") as f:
            self._last_read = time.time_ns()
            raw_config = json.loads(f.read())
            config = GlobalConfig(**raw_config)
            self._validate_config(config)
            return config

    def _validate_config(self, config: GlobalConfig):
        """Method used to validate the configuration. This is called after every
        read and before every write to the config file. Guarantees that the
        config file conforms to the JSON Schema."""
        self.validator.validate(config.dict())


    def _write_config(self, new_config: GlobalConfig):
        """Updates configuration and persists it to disk. This accepts a
        complete `GlobalConfig` object, and should not be called publicly."""
        # remove any empty field dictionaries
        # new_config.fields = {k: v for k, v in new_config.fields.items() if v}

        self._validate_config(new_config)
        with open(self.config_path, "w") as f:
            json.dump(new_config.dict(), f, indent=self.indentation_depth)

    def update_config(self, config_update: UpdateConfigRequest):
        last_write = os.stat(self.config_path).st_mtime_ns
        if config_update.last_read and config_update.last_read < last_write:
            raise WriteConflictError(
                "Configuration was modified after it was read from disk."
            )

        config_dict = self._read_config().dict()
        Merger.merge(config_dict, config_update.dict(exclude_unset=True))
        self._write_config(GlobalConfig(**config_dict))

    # this cannot be a property, as the parent Configurable already defines the
    # self.config attr.
    def get_config(self):
        config = self._read_config()
        config_dict = config.dict(exclude_unset=True)
        return DescribeConfigResponse(
            **config_dict, last_read=self._last_read
        )

