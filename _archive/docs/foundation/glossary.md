# Glossary

Status Label: Designed / Target

- **WCP**: Weekly Certified Payroll. A weekly payroll report used in regulated construction contexts.
- **DBWD**: Davis-Bacon Wage Determination. The prevailing wage source used to validate required pay.
- **Davis-Bacon**: Federal labor standards governing prevailing wage requirements on covered projects.
- **Deterministic validation**: Rule-driven logic where the system should not rely on model judgment for correctness.
- **Probabilistic reasoning**: Model-driven synthesis, explanation, or fuzzy interpretation over validated inputs.
- **RAG**: Retrieval-augmented generation. Here, the pattern of retrieving DBWD evidence before decision synthesis.
- **Hybrid search**: Retrieval that combines keyword-style relevance and vector similarity.
- **Reranking**: A secondary ranking pass, often with a cross-encoder, to improve result quality after initial retrieval.
- **Trace**: A structured record of what the system did and why, useful for replay, debugging, and auditability.
- **Confidence routing**: Using confidence thresholds or conflict rules to decide whether to approve, revise, reject, or escalate to human review.
- **Golden set**: A curated evaluation dataset with expected outputs used for regression testing.
- **False approve**: A case where the system approves a document that should have been revised or rejected. This is a critical risk metric.
- **Context assembly**: The process of deciding which facts, retrieval results, and findings are passed to the model for a given decision.
- **Ground-truth binding**: Tying model-facing facts back to stable source records or identifiers.
- **Corpus versioning**: Tracking which retrieval corpus version was used for a decision.
