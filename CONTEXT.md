# Device Telemetry

This context describes hardware identity, incoming events, and historical device
parameters collected from microcontroller installations.

## Language

**Gateway**:
The GSM-enabled controller that identifies one installation and relays events
from its devices.
_Avoid_: Device owner, owner device, gateway device

**Device**:
A metric-producing microcontroller identified locally within one Gateway.

**Device Type**:
A category describing which Parameters a Device supports and which payload
schemas can decode its events.

**Parameter**:
A typed, named property that can be observed over time for a Device.
_Avoid_: Attribute, device parameter

**Event Type**:
A stable category identifying the meaning of an incoming event.

**Payload Schema**:
A versioned description of how one Event Type from one Device Type is decoded.
_Avoid_: Payload structure

**Payload Field**:
A named byte range extracted from an event payload using a wire-level codec.
_Avoid_: Payload item

**Projection Rule**:
A mapping from a Payload Field or event-implied constant to a Parameter.

**Raw Event**:
The immutable event exactly as received, retained as source evidence regardless
of parsing outcome.

**Parameter Reading**:
One typed, historical observation of a Parameter for a Device, derived from one
Raw Event.
_Avoid_: Parameter value

**Ingestion**:
Acceptance of one Gateway event, preserving its Raw Event and deriving any
Parameter Readings.
