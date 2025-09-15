BASE="https://se-demo.domino.tech/api/governance/v1"
BUNDLE_DEFS="76b8c6ad-9e2c-45e8-a696-fc3c8de4c5b5"     # where the artifact DEFS live
BUNDLE_ANS="ee11471a-4aa8-407b-bb72-ff59b95dab40"      # where the DRAFT answers live

# 1) Pull definitions (questions) and normalize to {artifactId, question, type, options}
curl -s "$BASE/bundles/$BUNDLE_DEFS" -H 'accept: application/json' \
| jq '[ .stageApprovals[]
        | .evidence as $ev
        | ($ev.artifacts // [])
        | map({
            artifactId: .id,
            evidence: $ev.name,
            question: (.details.label // .details.title // "—"),
            type: (.details.type // "text"),
            options: (.details.options // null)
          })
     ] | add' > defs.json

# 2) Pull answers (drafts) and keep {artifactId, answer}
curl -s "$BASE/drafts/latest?bundleId=$BUNDLE_ANS" -H 'accept: application/json' \
| jq '[ .[] | {artifactId, answer: .artifactContent, updatedAt} ]' > drafts.json

# 3) Join defs ↔ answers on artifactId
jq -s '
  {defs: .[0], drafts: .[1]} as $d
  | $d.defs
  | map(. + {answer: ($d.drafts[]? | select(.artifactId == .artifactId) | .answer)})' \
  defs.json drafts.json
