# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.

"""
Model pricing database for LLM token usage cost calculation.

Pricing is specified as cost per 1 million tokens (input and output).
Prices are in USD and should be updated periodically to reflect current rates.

Sources:
- OpenAI: https://openai.com/api/pricing/
- Anthropic: https://anthropic.com/pricing
- Google: https://ai.google.dev/pricing
- Other providers: respective documentation
"""

from typing import Optional

# Pricing database: model_name -> (input_cost_per_1m, output_cost_per_1m)
# Costs are in USD per 1 million tokens
MODEL_PRICING = {
    # OpenAI GPT-4 models
    "gpt-4": (30.0, 60.0),
    "gpt-4-32k": (60.0, 120.0),
    "gpt-4-turbo": (10.0, 30.0),
    "gpt-4-turbo-preview": (10.0, 30.0),
    "gpt-4o": (2.5, 10.0),
    "gpt-4o-mini": (0.15, 0.6),

    # OpenAI GPT-3.5 models
    "gpt-3.5-turbo": (0.5, 1.5),
    "gpt-3.5-turbo-16k": (3.0, 4.0),

    # OpenAI O1 models
    "o1-preview": (15.0, 60.0),
    "o1-mini": (3.0, 12.0),

    # Anthropic Claude models
    "claude-3-opus-20240229": (15.0, 75.0),
    "claude-3-sonnet-20240229": (3.0, 15.0),
    "claude-3-haiku-20240307": (0.25, 1.25),
    "claude-3-5-sonnet-20241022": (3.0, 15.0),
    "claude-3-5-haiku-20241022": (0.8, 4.0),
    "claude-3-5-sonnet-20250929": (3.0, 15.0),
    "claude-opus-4-5-20251101": (15.0, 75.0),

    # Shorter model names (common aliases)
    "claude-3-opus": (15.0, 75.0),
    "claude-3-sonnet": (3.0, 15.0),
    "claude-3-haiku": (0.25, 1.25),
    "claude-3.5-sonnet": (3.0, 15.0),
    "claude-3-5-sonnet": (3.0, 15.0),
    "claude-3.5-haiku": (0.8, 4.0),
    "claude-3-5-haiku": (0.8, 4.0),
    "claude-opus-4.5": (15.0, 75.0),
    "claude-opus-4-5": (15.0, 75.0),

    # Google Gemini models
    "gemini-pro": (0.5, 1.5),
    "gemini-1.5-pro": (3.5, 10.5),
    "gemini-1.5-flash": (0.075, 0.3),
    "gemini-2.0-flash-exp": (0.075, 0.3),

    # Meta Llama models (via various providers)
    "llama-2-70b": (0.7, 0.9),
    "llama-3-70b": (0.88, 0.88),
    "llama-3.1-405b": (5.0, 15.0),
    "llama-3.1-70b": (0.88, 0.88),
    "llama-3.1-8b": (0.2, 0.2),
    "llama-3.2-90b": (0.88, 0.88),
    "llama-3.2-11b": (0.3, 0.3),
    "llama-3.2-3b": (0.1, 0.1),
    "llama-3.2-1b": (0.05, 0.05),

    # Mistral models
    "mistral-large": (4.0, 12.0),
    "mistral-medium": (2.7, 8.1),
    "mistral-small": (1.0, 3.0),
    "mistral-tiny": (0.25, 0.25),

    # Cohere models
    "command": (1.0, 2.0),
    "command-light": (0.3, 0.6),
    "command-r": (0.5, 1.5),
    "command-r-plus": (3.0, 15.0),
}


def calculate_cost(
    model: str,
    input_tokens: int = 0,
    output_tokens: int = 0
) -> Optional[float]:
    """
    Calculate the cost of token usage for a given model.

    Args:
        model: The model identifier (e.g., 'gpt-4', 'claude-3-opus')
        input_tokens: Number of input tokens
        output_tokens: Number of output tokens

    Returns:
        The estimated cost in USD, or None if pricing is not available for the model
    """
    # Normalize model name: remove provider prefixes and version suffixes
    normalized_model = _normalize_model_name(model)

    # Look up pricing
    pricing = MODEL_PRICING.get(normalized_model)
    if not pricing:
        # Try to find a partial match
        for model_name, model_pricing in MODEL_PRICING.items():
            if model_name in normalized_model or normalized_model in model_name:
                pricing = model_pricing
                break

    if not pricing:
        return None

    input_cost_per_1m, output_cost_per_1m = pricing

    # Calculate cost
    input_cost = (input_tokens / 1_000_000) * input_cost_per_1m
    output_cost = (output_tokens / 1_000_000) * output_cost_per_1m

    return input_cost + output_cost


def _normalize_model_name(model: str) -> str:
    """
    Normalize a model name by removing common prefixes and making lowercase.

    Examples:
        'openai/gpt-4' -> 'gpt-4'
        'anthropic.claude-3-opus-20240229' -> 'claude-3-opus-20240229'
        'bedrock/anthropic.claude-3-opus-20240229-v1:0' -> 'claude-3-opus-20240229'
    """
    # Remove provider prefixes
    prefixes = [
        "openai/", "openai.", "anthropic/", "anthropic.", "google/", "google.",
        "meta/", "meta.", "mistral/", "mistral.", "cohere/", "cohere.",
        "bedrock/", "bedrock.", "azure/", "azure.", "together/", "together.",
        "replicate/", "replicate.", "huggingface/", "huggingface.",
        "ollama/", "ollama."
    ]

    normalized = model.lower()
    for prefix in prefixes:
        if normalized.startswith(prefix):
            normalized = normalized[len(prefix):]
            break

    # Remove version suffixes like '-v1:0'
    if "-v" in normalized:
        normalized = normalized.split("-v")[0]

    # Remove trailing version patterns
    if normalized.endswith(":latest") or normalized.endswith(":0"):
        normalized = normalized.rsplit(":", 1)[0]

    return normalized


def add_custom_pricing(model: str, input_cost_per_1m: float, output_cost_per_1m: float) -> None:
    """
    Add or update pricing for a custom model.

    Args:
        model: The model identifier
        input_cost_per_1m: Cost per 1 million input tokens in USD
        output_cost_per_1m: Cost per 1 million output tokens in USD
    """
    MODEL_PRICING[model.lower()] = (input_cost_per_1m, output_cost_per_1m)
