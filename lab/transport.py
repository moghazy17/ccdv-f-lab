"""Provider-neutral messages transport with a deterministic, keyless test seam.

Demonstrates the blueprint sub-skills ``Claude API Mechanics``, ``LLM Fundamentals``, and
``Debugging and Error Handling``. See ``notes/02-applications-and-integration/``,
``notes/04-eval-testing-and-debugging/``, and ``notes/05-model-selection-and-optimization/`` for
the associated study notes.
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any, Protocol

from lab.config import CLASSIFY_MODEL, DRAFT_MODEL, ESCALATE_MODEL

ADAPTIVE_THINKING_MODELS = frozenset({DRAFT_MODEL, ESCALATE_MODEL})
EFFORT_LEVELS = frozenset({"low", "medium", "high", "xhigh", "max"})


@dataclass(frozen=True)
class ContentBlock:
    """A provider-neutral content block; cache control remains opt-in at the block boundary."""

    type: str
    text: str | None = None
    cache_control: bool = False


@dataclass(frozen=True)
class Message:
    """One normalised user message, separate from trusted system instructions."""

    role: str
    content: tuple[ContentBlock, ...]

    def __post_init__(self) -> None:
        """Disallow assistant prefill, which the pinned models reject."""
        if self.role != "user":
            raise ValueError(
                "Normalised requests only support user messages; assistant prefill is removed"
            )


@dataclass(frozen=True)
class ThinkingConfig:
    """An explicit request to use thinking, with a Haiku-only token budget when applicable."""

    budget_tokens: int | None = None


@dataclass(frozen=True)
class NormalisedRequest:
    """The complete, provider-neutral request accepted by every lab transport."""

    model: str
    max_tokens: int
    system: tuple[ContentBlock, ...]
    messages: tuple[Message, ...]
    output_config: Mapping[str, Any] | None = None
    thinking: ThinkingConfig | None = None
    effort: str | None = None
    scenario: str = "triage-json"

    def __post_init__(self) -> None:
        """Validate input shared by mock and live transports before either can send it."""
        if self.max_tokens < 1:
            raise ValueError("max_tokens must be at least 1")
        if not self.system:
            raise ValueError("A normalised request requires trusted system content")
        if not self.messages:
            raise ValueError("A normalised request requires at least one user message")
        if self.effort is not None and self.effort not in EFFORT_LEVELS:
            raise ValueError(f"Unsupported effort level: {self.effort!r}")


@dataclass(frozen=True)
class Usage:
    """Normalised token accounting, including cache reads when a provider reports them."""

    input_tokens: int = 0
    output_tokens: int = 0
    cache_read_input_tokens: int = 0


@dataclass(frozen=True)
class NormalisedResponse:
    """The provider-neutral response returned by every lab transport."""

    content: tuple[ContentBlock, ...]
    stop_reason: str
    usage: Usage
    stop_details: Mapping[str, Any] | None = None


class Transport(Protocol):
    """A single-send seam that keeps callers independent from a specific SDK."""

    def send(self, request: NormalisedRequest) -> NormalisedResponse:
        """Send one normalised request and return one normalised response."""


RECORDED_SCENARIOS: Mapping[str, NormalisedResponse] = {
    "triage-json": NormalisedResponse(
        content=(
            ContentBlock(
                type="text",
                text=(
                    '{"category":"account_access","severity":"medium",'
                    '"suggested_action":"Verify the account recovery details.",'
                    '"confidence":0.72,"needs_human":false}'
                ),
            ),
        ),
        stop_reason="end_turn",
        usage=Usage(input_tokens=42, output_tokens=31),
    ),
    "truncated": NormalisedResponse(
        content=(ContentBlock(type="text", text='{"category":"billing"'),),
        stop_reason="max_tokens",
        usage=Usage(input_tokens=42, output_tokens=4),
    ),
    "refusal": NormalisedResponse(
        content=(ContentBlock(type="text", text="I cannot process that request."),),
        stop_reason="refusal",
        usage=Usage(input_tokens=42, output_tokens=8),
        stop_details={"reason": "safety"},
    ),
}


class MockTransport:
    """Return immutable recorded scenarios without a network call, SDK import, or API key."""

    def __init__(self, scenarios: Mapping[str, NormalisedResponse] | None = None) -> None:
        """Use the supplied recorded scenarios, or the stable built-in teaching set."""
        self._scenarios = dict(RECORDED_SCENARIOS if scenarios is None else scenarios)

    def send(self, request: NormalisedRequest) -> NormalisedResponse:
        """Return the scenario named by the request, raising clearly for an unrecorded one."""
        try:
            return self._scenarios[request.scenario]
        except KeyError as error:
            raise ValueError(f"No recorded mock scenario named {request.scenario!r}") from error


class TransportError(RuntimeError):
    """Base error for a live-provider failure normalised for application callers."""


class ResourceNotFoundError(TransportError):
    """The provider did not find a requested resource such as a pinned model."""


class RateLimitedError(TransportError):
    """The provider rate limited a request and supplied an optional retry delay."""

    def __init__(self, message: str, retry_after: str | None) -> None:
        super().__init__(message)
        self.retry_after = retry_after


class ProviderStatusError(TransportError):
    """The provider returned an API status failure other than a rate limit or not found."""


class ProviderConnectionError(TransportError):
    """The provider could not be reached."""


class AnthropicTransport:
    """Wrap the live SDK while keeping all SDK imports out of the module import path."""

    def __init__(self) -> None:
        """Create the SDK client only when the explicitly selected live transport is constructed."""
        try:
            import anthropic
        except ImportError as error:
            raise RuntimeError(
                "Install the 'anthropic' dependency to use AnthropicTransport"
            ) from error
        self._anthropic = anthropic
        self._client = anthropic.Anthropic()

    def send(self, request: NormalisedRequest) -> NormalisedResponse:
        """Send a normalised request through ``client.messages.create`` with current parameters."""
        try:
            response = self._client.messages.create(**self._request_parameters(request))
        except self._anthropic.NotFoundError as error:
            raise ResourceNotFoundError(str(error)) from error
        except self._anthropic.RateLimitError as error:
            raise RateLimitedError(str(error), self._retry_after(error)) from error
        except self._anthropic.APIStatusError as error:
            raise ProviderStatusError(str(error)) from error
        except self._anthropic.APIConnectionError as error:
            raise ProviderConnectionError(str(error)) from error
        return self._normalise_response(response)

    @staticmethod
    def _retry_after(error: Any) -> str | None:
        """Read the provider's documented ``retry-after`` response header when it is present."""
        response = getattr(error, "response", None)
        headers = getattr(response, "headers", None)
        if headers is None:
            return None
        value = headers.get("retry-after")
        return str(value) if value is not None else None

    def _request_parameters(self, request: NormalisedRequest) -> dict[str, Any]:
        """Translate a normalised request without emitting removed or deprecated parameters."""
        parameters: dict[str, Any] = {
            "model": request.model,
            "max_tokens": request.max_tokens,
            "system": [self._content_parameter(block) for block in request.system],
            "messages": [
                {
                    "role": message.role,
                    "content": [self._content_parameter(block) for block in message.content],
                }
                for message in request.messages
            ],
        }
        output_config = dict(request.output_config or {})
        if request.effort is not None:
            if "effort" in output_config:
                raise ValueError("Set effort once, through NormalisedRequest.effort")
            output_config["effort"] = request.effort
        if output_config:
            parameters["output_config"] = output_config

        thinking = self._thinking_parameter(request)
        if thinking is not None:
            parameters["thinking"] = thinking
        return parameters

    @staticmethod
    def _content_parameter(block: ContentBlock) -> dict[str, Any]:
        """Render a content block and place ephemeral cache control on that block when requested."""
        parameter: dict[str, Any] = {"type": block.type}
        if block.text is not None:
            parameter["text"] = block.text
        if block.cache_control:
            parameter["cache_control"] = {"type": "ephemeral"}
        return parameter

    @staticmethod
    def _thinking_parameter(request: NormalisedRequest) -> dict[str, Any] | None:
        """Use adaptive thinking on Sonnet or Opus and the constrained budget form on Haiku."""
        if request.thinking is None:
            return None
        if request.model in ADAPTIVE_THINKING_MODELS:
            if request.thinking.budget_tokens is not None:
                raise ValueError("Adaptive thinking does not accept budget_tokens")
            return {"type": "adaptive"}
        if request.model == CLASSIFY_MODEL:
            budget = request.thinking.budget_tokens
            if budget is None or budget < 1024 or budget >= request.max_tokens:
                raise ValueError(
                    "Haiku thinking budget_tokens must be at least 1024 and below max_tokens"
                )
            return {"type": "enabled", "budget_tokens": budget}
        raise ValueError("Thinking is only configured for the explicitly pinned lab models")

    @staticmethod
    def _normalise_response(response: Any) -> NormalisedResponse:
        """Copy SDK content and usage fields into the provider-neutral response shape."""
        content = tuple(
            ContentBlock(
                type=str(getattr(block, "type", "unknown")),
                text=getattr(block, "text", None),
            )
            for block in getattr(response, "content", ())
        )
        raw_usage = getattr(response, "usage", None)
        usage = Usage(
            input_tokens=int(getattr(raw_usage, "input_tokens", 0)),
            output_tokens=int(getattr(raw_usage, "output_tokens", 0)),
            cache_read_input_tokens=int(getattr(raw_usage, "cache_read_input_tokens", 0)),
        )
        stop_reason = str(getattr(response, "stop_reason", "unknown"))
        raw_stop_details = (
            getattr(response, "stop_details", None) if stop_reason == "refusal" else None
        )
        stop_details = dict(raw_stop_details) if isinstance(raw_stop_details, Mapping) else None
        return NormalisedResponse(
            content=content,
            stop_reason=stop_reason,
            usage=usage,
            stop_details=stop_details,
        )
