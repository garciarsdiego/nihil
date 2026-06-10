# @nihil/daemon (M1)

Node/TS sidecar — the brain. Will host: agent loop (event-stream), engine
layer (vendored open-design ACP runtime + OmniRoute BYOK), ExecutionTarget
implementations (local-process default), git transaction runner consuming
`@nihil/protocol` actions. Structure mirrors the technical spec §2.
