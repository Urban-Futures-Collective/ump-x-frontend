# Frontend flow

Which paths a user can take through UMP-X, depending on sign-in and roles, and
how much of it is built.

**As of 2026-08-28**, checked against the code (`c9a893e`). Anyone changing a
route, a middleware or a state updates this document with it. See "Keeping this
current" at the end.

Colours throughout:

- **green** built and running
- **orange** placeholder, the page exists with "coming soon"
- **red** not there yet, from the workshop target picture

## The entry point decides everything

```mermaid
flowchart TD
    Start([Visitor opens the site])
    Start --> Landing["Landing page<br/>sign in or browse the catalogue"]

    Landing --> Q{Signed in?}

    Q -->|no| Anon["Model catalogue<br/><i>open models only</i>"]
    Q -->|sign in| KC[/"Keycloak"/]

    KC --> Roles{Which roles<br/>in the token?}

    Roles -->|none in particular| Basic["Model catalogue<br/><i>open models only</i>"]
    Roles -->|model role| More["Model catalogue<br/><i>plus permitted models</i>"]
    Roles -->|ump_admin| Admin["Administration"]

    Anon --> Run
    Basic --> Run
    More --> Run

    Run["Scenario<br/>set parameters, run"]
    Run --> Wait{{"Computing<br/>minutes to hours"}}
    Wait --> Map["Result on the map"]

    Basic --> Mine
    More --> Mine
    Map --> Mine
    Mine["My scenarios<br/><i>your own runs, newest first</i>"]
    Mine --> Detail["A run in detail<br/>status, time, result"]
    Detail --> Map

    Admin --> Matrix["Access management<br/>who may use which model"]

    classDef built fill:#1f6f3f,stroke:#2ea05a,color:#fff
    classDef placeholder fill:#7a4b1f,stroke:#c07a2a,color:#fff
    classDef missing fill:#7a1f2a,stroke:#c02a3a,color:#fff
    classDef external fill:#2a3550,stroke:#4a6090,color:#fff

    class Landing,Anon,Basic,More,Run,Map,Mine,Detail built
    class Admin placeholder
    class Matrix missing
    class KC external
```

The catalogue is the same screen three times, it just shows different amounts.
Without signing in you see the models marked `anonymous-access: true`, with a
matching role the rest appears as well.

## Who may do what

| | signed out | signed in | with model role | ump_admin |
|---|---|---|---|---|
| Landing page | yes | yes | yes | yes |
| See and run open models | yes | yes | yes | yes |
| Restricted models | no | no | yes | yes |
| My scenarios | no | yes | yes | yes |
| Administration | no | no | no | yes |

Two different kinds of role govern this:

**Model access** through roles on `ump-client`, named after the model server:
`<modelserver>` for all its processes, `<modelserver>_<process>` for a single
one. Which process is open, however, is not decided in Keycloak but in the
backend's `providers.yaml` via `anonymous-access`.

**Administration** through the realm role `ump_admin`.

The frontend enforces this per page via `definePageMeta`, not globally. What
ends up in the catalogue is decided by the backend anyway.

## What is missing today

```mermaid
flowchart LR
    Run["Run a scenario"] --> W{{"Computing"}}
    W --> M["Map"]
    Run --> S["My scenarios"]
    W -.->|leave the page<br/>or reload| S
    S --> D["A run in detail"]
    D --> M
    W -.->|no progress,<br/>no message| G>"you are not told<br/>when it finishes"]

    classDef built fill:#1f6f3f,stroke:#2ea05a,color:#fff
    classDef gap fill:#7a1f2a,stroke:#c02a3a,color:#fff
    class Run,M,S,D built
    class G gap
```

**Finding a run again has been built since 2026-08-27.** A run survives a
reload, appears under "My scenarios" and can be reopened together with its
result. Starting a scenario now leads straight to the run it created.

What remains is the wait itself. A run shows its status when the page loads and
nothing more: no progress, no notification, no signal when it is done. With
runtimes of minutes to hours that is the remaining hole, and it grows once
models are chained.

What needs deciding is less how a list looks and more what happens during the
wait: does someone stay on the page, come back later and get notified, and how
do they recognise a failed run?

One quirk belongs here: **the API recognises identical requests** and returns
the same run, possibly with its earlier failure. Starting the same scenario
again therefore creates no second run. The detail page says so, otherwise the
button looks stuck.

## Where this is meant to go

From the workshop, six components. Today's state covers parts of two, the rest
is absent.

```mermaid
flowchart TD
    Question([The question: how should mobility develop here?])

    Question --> Commons
    Commons["<b>Commons</b><br/>Which models exist,<br/>can I trust them?"]
    Data["<b>Data</b><br/>Does my data fit<br/>the model?"]
    Build["<b>Assemble a plan</b><br/>chain models together"]
    Compute{{Computing}}
    Map["<b>Map</b><br/>What does this mean<br/>spatially?"]
    Weigh["<b>Trade-off</b><br/>environment, economy,<br/>society"]
    Done([A decision someone can defend])

    Commons --> Data --> Build --> Compute --> Map --> Weigh --> Done
    Weigh -.->|change an assumption| Build
    Map -.->|different model| Commons

    Contribute["<b>Contribute a model</b>"] --> Commons

    classDef partial fill:#4a6f3f,stroke:#6aa05a,color:#fff
    classDef missing fill:#7a1f2a,stroke:#c02a3a,color:#fff
    classDef endpoint fill:#2a3550,stroke:#4a6090,color:#fff
    class Commons,Map partial
    class Data,Build,Weigh,Contribute missing
    class Done,Question endpoint
```

Lighter green means partly there. The model catalogue is not a Commons yet, it
lists what has been configured, without trust, provenance or reuse. The map
renders GeoJSON results, but not necessarily in a way that convinces anyone.

The dashed arrows matter. This is not a form you fill in once: whoever weighs
trade-offs changes assumptions and recomputes, whoever sees the map notices a
model is missing.

## Not everyone starts at the same place

From the persona check. This argues against a wizard that sends everyone
through the same order.

```mermaid
flowchart LR
    R([Researcher]) --> R1["Contribute a model"]
    A([Analyst, planner]) --> A1["Commons, assemble a plan"]
    P([Practitioner]) --> P1["Trade-off, map"]
    D([Data infrastructure]) --> D1["Data"]
    C([Commercial intermediary]) --> C1["Assemble a plan, trade-off"]

    classDef persona fill:#2a3550,stroke:#4a6090,color:#fff
    class R,A,P,D,C persona
```

Today there is exactly one entry point for everyone, the landing page with the
model catalogue behind it. Alongside it the sidebar shows Projects, Contribute,
Data repository and Report greyed out: visible so the direction is legible,
disabled so nobody clicks into nothing.

## Keeping this current

This document goes stale faster than anything else in the folder, because it
describes states rather than procedures. It is only useful if it can be
believed.

Update it as soon as any of these changes:

- a route appears or disappears (`app/pages/`)
- a page moves between placeholder and built
- a middleware changes, that is, who may go where (`definePageMeta`)
- a path between two pages appears or disappears

When updating, check the colours against the code rather than from memory:
green means built and running, orange means placeholder with "coming soon",
red means not there, then set the date at the top. This document is kept in
English only: a second language version drifted out of sync faster than it
helped.

## Related

- `add-new-model-de.md`, which places a new model touches technically
- `runbook-growbike-modelserver-de.md`, model servers and roles
- `deployment-de.md`, branch chain and environments
