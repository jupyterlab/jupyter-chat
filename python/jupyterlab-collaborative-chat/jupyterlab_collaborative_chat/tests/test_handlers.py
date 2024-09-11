# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.

import json


async def test_get_example(jp_fetch):
    # When
    response = await jp_fetch("jupyterlab-collaborative-chat", "get-example")

    # Then
    assert response.code == 200
    payload = json.loads(response.body)
    assert payload == {
        "data": "This is /jupyterlab-collaborative-chat/get-example endpoint!"
    }